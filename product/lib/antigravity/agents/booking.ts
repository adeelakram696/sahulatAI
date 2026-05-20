/**
 * Booking agent — Phase A only (invitation creation + notify_provider + artifacts).
 * Phase B (provider acceptance) lives in /api/provider/accept route handler.
 */
import { admin } from '@/lib/supabase/admin';
import type { AgentContext } from '../types';
import { callTool } from '../tools';

interface BookingInput {
  user_id: string;
  user_location_id: string;
  provider_id: string;
  slot_start: string;
  customer_name?: string;
  customer_phone?: string;
  customer_lang?: string;
  notes?: string;
  complexity?: 'basic' | 'intermediate' | 'complex';
  price_breakdown?: Record<string, unknown> | null;
}
interface BookingOutput {
  booking_id: string;
  invitation_token: string;
  invitation_channel: 'whatsapp' | 'sms' | 'mock';
  receipt_url: string;
  calendar: { ics_data_url: string; gcal_url: string };
  message: { en: string; ur: string };
}

export async function runBookingPhaseA(input: BookingInput, ctx: AgentContext, stepIndex: number): Promise<BookingOutput> {
  const startedAt = new Date().toISOString();
  await ctx.emitTrace({ runId: ctx.runId, agentName: 'booking', stepIndex, startedAt, inputs: input, status: 'running' });

  // Load provider + location + customer profile (for the booking snapshot the
  // provider sees — name/phone must be copied onto the booking row).
  const [{ data: provider }, { data: locRows, error: locErr }, { data: profile }] = await Promise.all([
    admin.from('providers').select('id, avg_duration, business_name, categories, price_band').eq('id', input.provider_id).single(),
    admin.rpc('get_user_location_geo', { p_id: input.user_location_id }),
    admin.from('users_profile').select('display_name, phone').eq('user_id', input.user_id).maybeSingle(),
  ]);
  if (locErr) throw new Error(`location lookup failed: ${locErr.message}`);
  const location = locRows?.[0];
  if (!provider || !location) throw new Error('provider or user_location missing');

  const slotStart = new Date(input.slot_start);
  const durationMinutes = parseIntervalToMinutes((provider as { avg_duration: string }).avg_duration) || 60;
  const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

  const serviceSlug = (provider as { categories: string[] }).categories?.[0] ?? 'ac_repair';
  const priceBand = (provider as { price_band: Record<string, unknown> }).price_band?.[serviceSlug] ?? null;

  const locationPoint = { lat: location.lat as number, lng: location.lng as number };

  const created = await callTool<{ booking_id: string; invitation_token: string }>(
    'supabase.create_booking',
    {
      customer_user_id: input.user_id,
      customer_user_location_id: input.user_location_id,
      provider_id: input.provider_id,
      service_category: serviceSlug,
      slot_start: slotStart.toISOString(),
      slot_end: slotEnd.toISOString(),
      location_text: `${(location as { label: string }).label} — ${(location as { address_text: string }).address_text}`,
      location_point: locationPoint,
      customer_name_snapshot: input.customer_name ?? (profile as { display_name?: string } | null)?.display_name ?? null,
      customer_phone_snapshot: input.customer_phone ?? (profile as { phone?: string } | null)?.phone ?? null,
      customer_lang: input.customer_lang ?? 'en',
      agent_run_id: ctx.runId,
      notes: input.notes ?? '',
      complexity: input.complexity ?? 'basic',
      price_breakdown: input.price_breakdown ?? null,
      price_estimate: priceBand ? { ...(priceBand as object), currency: 'PKR' } : undefined,
    },
    ctx,
  );

  const [notif, calendar, msg, receipt] = await Promise.all([
    callTool<{ channel: 'whatsapp' | 'sms' | 'mock' }>('notify_provider', { booking_id: created.booking_id }, ctx),
    callTool<{ ics_data_url: string; gcal_url: string }>('generate_calendar_artifacts', { booking_id: created.booking_id }, ctx),
    callTool<{ en: string; ur: string }>('llm.confirmation_message', { booking_id: created.booking_id, locale: input.customer_lang ?? 'en', phase: 'pending' }, ctx),
    callTool<{ url: string }>('generate_receipt', { booking_id: created.booking_id }, ctx),
  ]);

  // Immediate push to customer (best-effort)
  callTool('web_push.send', {
    user_id: input.user_id,
    title: 'Invitation sent',
    body: `We've messaged ${(provider as { business_name: string }).business_name}. We'll notify you on acceptance.`,
    url: `/booking/${created.booking_id}`,
  }, ctx).catch(() => {});

  const output: BookingOutput = {
    booking_id: created.booking_id,
    invitation_token: created.invitation_token,
    invitation_channel: notif.channel as 'whatsapp' | 'sms' | 'mock',
    receipt_url: receipt.url,
    calendar,
    message: msg,
  };

  await ctx.emitTrace({
    runId: ctx.runId, agentName: 'booking', stepIndex,
    startedAt, endedAt: new Date().toISOString(),
    inputs: input,
    outputs: { booking_id: output.booking_id, invitation_channel: output.invitation_channel },
    reasoning: `Booking ${output.booking_id} written; invitation via ${output.invitation_channel}; receipt + calendar generated.`,
    status: 'ok',
  });

  return output;
}

function parseIntervalToMinutes(s: string): number {
  if (!s) return 60;
  const hh = s.match(/(\d+)\s*hour/i);
  const mm = s.match(/(\d+)\s*minute/i);
  const colon = s.match(/^(\d+):(\d+):(\d+)$/);
  if (colon) return parseInt(colon[1], 10) * 60 + parseInt(colon[2], 10);
  return ((hh ? parseInt(hh[1], 10) : 0) * 60) + (mm ? parseInt(mm[1], 10) : 0) || 60;
}
