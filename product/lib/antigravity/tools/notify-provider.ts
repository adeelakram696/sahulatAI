/**
 * notify_provider — strategy chain: dashboard (implicit via Realtime) →
 *   WhatsApp Cloud API → Twilio SMS → mock_messages.
 *
 * Returns the channel actually used so it can be persisted on bookings.invitation_channel.
 */
import { z } from 'zod';
import { admin } from '@/lib/supabase/admin';
import { env, isTwilioConfigured, isWhatsappConfigured } from '@/lib/env';
import type { Tool } from '../types';

const Input = z.object({ booking_id: z.string() });
const Output = z.object({ channel: z.enum(['dashboard', 'whatsapp', 'sms', 'mock']) });

export const notifyProviderTool: Tool<typeof Input, typeof Output> = {
  name: 'notify_provider',
  description: 'Send invitation to provider via strategy chain.',
  input: Input,
  output: Output,
  async run({ booking_id }, ctx) {
    ctx.logger.tool('notify_provider', { booking_id });

    const { data: booking } = await admin
      .from('bookings')
      .select('id, invitation_token, slot_start, slot_end, service_category, customer_name_snapshot, location_text, provider_id, notes')
      .eq('id', booking_id)
      .single();
    if (!booking) throw new Error('booking not found');

    const { data: provider } = await admin
      .from('providers')
      .select('id, business_name, phone, whatsapp_opt_in, sms_opt_in, owner_user_id')
      .eq('id', booking.provider_id)
      .single();
    if (!provider) throw new Error('provider not found');

    const acceptUrl = `${env.NEXT_PUBLIC_APP_URL}/provider/accept/${booking.invitation_token}`;
    const lines = [
      `SahuliatAI: new booking request for ${provider.business_name}.`,
      `Service: ${booking.service_category}`,
      `Slot: ${new Date(booking.slot_start).toLocaleString()}`,
      `Location: ${booking.location_text}`,
    ];
    if (booking.notes && String(booking.notes).trim().length > 0) {
      lines.push(`Customer's notes: ${booking.notes}`);
    }
    lines.push(`Accept: ${acceptUrl}`);
    const body = lines.join('\n');

    // 1. WhatsApp
    if (provider.whatsapp_opt_in && provider.phone && isWhatsappConfigured()) {
      try {
        await sendWhatsApp(provider.phone, body);
        await admin.from('bookings').update({ invitation_channel: 'whatsapp' }).eq('id', booking_id);
        return { channel: 'whatsapp' };
      } catch (e) {
        ctx.logger.warn('whatsapp send failed', e);
      }
    }

    // 2. SMS
    if (provider.sms_opt_in && provider.phone && isTwilioConfigured()) {
      try {
        await sendSms(provider.phone, body);
        await admin.from('bookings').update({ invitation_channel: 'sms' }).eq('id', booking_id);
        return { channel: 'sms' };
      } catch (e) {
        ctx.logger.warn('sms send failed', e);
      }
    }

    // 3. Mock
    await admin.from('mock_messages').insert({
      booking_id,
      channel: 'whatsapp',
      to_phone: provider.phone ?? 'unknown',
      body,
      accept_url: acceptUrl,
    });
    await admin.from('bookings').update({ invitation_channel: 'mock' }).eq('id', booking_id);
    return { channel: 'mock' };
  },
};

async function sendWhatsApp(toPhone: string, body: string): Promise<void> {
  const url = `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: toPhone.replace(/\D/g, ''),
      type: 'text',
      text: { body },
    }),
  });
  if (!res.ok) throw new Error(`whatsapp ${res.status}: ${await res.text().catch(() => '')}`);
}

async function sendSms(toPhone: string, body: string): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const params = new URLSearchParams({ From: env.TWILIO_FROM_NUMBER!, To: toPhone, Body: body });
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  if (!res.ok) throw new Error(`twilio ${res.status}`);
}
