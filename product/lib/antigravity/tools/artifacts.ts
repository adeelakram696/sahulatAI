/**
 * Booking artifacts: receipt PDF + calendar (.ics + Google Calendar deep link) +
 * confirmation message generation.
 */
import { z } from 'zod';
import { admin } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import type { Tool } from '../types';

// ---------------------------------------------------------------------------
// generate_calendar_artifacts
// ---------------------------------------------------------------------------
const CalInput = z.object({ booking_id: z.string() });
const CalOutput = z.object({
  ics_data_url: z.string(),
  gcal_url: z.string(),
});

export const calendarArtifactsTool: Tool<typeof CalInput, typeof CalOutput> = {
  name: 'generate_calendar_artifacts',
  description: 'Produce .ics data URL + Google Calendar deep link.',
  input: CalInput, output: CalOutput,
  async run({ booking_id }, ctx) {
    ctx.logger.tool('generate_calendar_artifacts', { booking_id });
    const { data: b } = await admin
      .from('bookings')
      .select('slot_start, slot_end, location_text, service_category, providers(business_name)')
      .eq('id', booking_id)
      .single();
    if (!b) throw new Error('booking not found');
    const provName = (b.providers as { business_name?: string } | null)?.business_name ?? 'Provider';
    const title = `${prettyService(b.service_category)} — ${provName}`;
    const start = formatICS(new Date(b.slot_start as string));
    const end = formatICS(new Date(b.slot_end as string));
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SahuliatAI//EN',
      'BEGIN:VEVENT', `UID:${booking_id}@sahuliat.ai`,
      `DTSTAMP:${formatICS(new Date())}`, `DTSTART:${start}`, `DTEND:${end}`,
      `SUMMARY:${escapeICS(title)}`, `LOCATION:${escapeICS(String(b.location_text))}`,
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const ics_data_url = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
    const gcal = new URL('https://calendar.google.com/calendar/render');
    gcal.searchParams.set('action', 'TEMPLATE');
    gcal.searchParams.set('text', title);
    gcal.searchParams.set('dates', `${start}/${end}`);
    gcal.searchParams.set('details', `Booking via SahuliatAI`);
    gcal.searchParams.set('location', String(b.location_text));
    return { ics_data_url, gcal_url: gcal.toString() };
  },
};

function formatICS(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
function escapeICS(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
function prettyService(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// generate_receipt (PDF) — minimal HTML-to-PDF would be ideal, but
// @react-pdf/renderer requires React tree compilation. For hackathon scope,
// we generate a simple text-based receipt URL and let the UI render the visual.
// TODO: Phase 2 — wire @react-pdf/renderer for downloadable PDF.
// ---------------------------------------------------------------------------
const ReceiptInput = z.object({ booking_id: z.string() });
const ReceiptOutput = z.object({ url: z.string() });

export const generateReceiptTool: Tool<typeof ReceiptInput, typeof ReceiptOutput> = {
  name: 'generate_receipt',
  description: 'Generate a receipt PDF URL for a booking.',
  input: ReceiptInput, output: ReceiptOutput,
  async run({ booking_id }, ctx) {
    ctx.logger.tool('generate_receipt', { booking_id });
    // Link to the in-app booking detail view (shows price breakdown + status).
    // A dedicated /receipt route + PDF render is a Phase-2 TODO.
    const url = `${env.NEXT_PUBLIC_APP_URL}/booking/${booking_id}`;
    await admin.from('bookings').update({ receipt_pdf_url: url }).eq('id', booking_id);
    return { url };
  },
};

// ---------------------------------------------------------------------------
// llm.confirmation_message — short bilingual chat-bubble copy
// ---------------------------------------------------------------------------
const ConfMsgInput = z.object({
  booking_id: z.string(),
  locale: z.string().default('en'),
  phase: z.enum(['pending', 'confirmed']).default('pending'),
});
const ConfMsgOutput = z.object({ en: z.string(), ur: z.string() });

export const confirmationMessageTool: Tool<typeof ConfMsgInput, typeof ConfMsgOutput> = {
  name: 'llm.confirmation_message',
  description: 'Bilingual chat-bubble for invitation-pending / confirmed.',
  input: ConfMsgInput, output: ConfMsgOutput,
  async run({ booking_id, phase }, _ctx) {
    const { data: b } = await admin
      .from('bookings')
      .select('slot_start, location_text, providers(business_name)')
      .eq('id', booking_id)
      .single();
    const prov = (b?.providers as { business_name?: string } | null)?.business_name ?? 'the provider';
    const when = b ? new Date(b.slot_start as string).toLocaleString('en-PK', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : 'soon';
    const loc = b?.location_text ?? '';

    if (phase === 'pending') {
      return {
        en: `Invitation sent to ${prov}. We'll let you know as soon as they accept.`,
        ur: `${prov} کو دعوت بھیج دی گئی ہے۔ قبولیت پر آپ کو اطلاع دی جائے گی۔`,
      };
    }
    return {
      en: `Confirmed! ${prov} will arrive at ${loc} at ${when}.`,
      ur: `تصدیق ہو گئی! ${prov} ${when} پر ${loc} پہنچیں گے۔`,
    };
  },
};
