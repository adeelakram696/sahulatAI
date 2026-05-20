/**
 * Supabase RPC + table-write tools.
 */
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { admin } from '@/lib/supabase/admin';
import type { Tool } from '../types';
import { ProviderCandidateSchema } from '../types';

const PointSchema = z.object({ lat: z.number(), lng: z.number() });

// search_providers
const SearchInput = z.object({
  service_slug: z.string(),
  point: PointSchema,
  radius_km: z.number().default(5),
  exclude_ids: z.array(z.string()).default([]),
});
const SearchOutput = z.object({ candidates: z.array(ProviderCandidateSchema) });

export const searchProvidersTool: Tool<typeof SearchInput, typeof SearchOutput> = {
  name: 'supabase.search_providers',
  description: 'PostGIS-filtered provider search by category + location.',
  input: SearchInput, output: SearchOutput,
  async run({ service_slug, point, radius_km, exclude_ids }, ctx) {
    ctx.logger.tool('supabase.search_providers', { service_slug, radius_km });
    const { data, error } = await admin.rpc('search_providers_rpc', {
      p_service_slug: service_slug,
      p_lat: point.lat,
      p_lng: point.lng,
      p_radius_km: radius_km,
      p_limit: 15,
      p_exclude_ids: exclude_ids,
    });
    if (error) { ctx.logger.warn('search_providers_rpc error', error); return { candidates: [] }; }
    const candidates = (data || []).map((row: {
      id: string; business_name: string; photo_url: string | null; phone: string | null;
      languages: string[]; google_rating: number; google_rating_count: number;
      portal_rating: number; portal_rating_count: number; response_time_minutes: number | null;
      avg_duration: string; hub_lat: number; hub_lng: number; distance_m: number;
      price_band: Record<string, unknown>; whatsapp_opt_in: boolean; sms_opt_in: boolean; source: string;
      on_time_score?: number; cancellation_rate?: number; last_review_at?: string | null; risk_score?: number;
      specializations?: string[]; capacity?: number; base_visit_fee?: number; base_hourly_rate?: number;
    }) => ({
      id: row.id,
      business_name: row.business_name,
      photo_url: row.photo_url,
      phone: row.phone,
      languages: row.languages ?? ['en'],
      google_rating: Number(row.google_rating ?? 0),
      google_rating_count: row.google_rating_count ?? 0,
      portal_rating: Number(row.portal_rating ?? 0),
      portal_rating_count: row.portal_rating_count ?? 0,
      response_time_minutes: row.response_time_minutes,
      avg_duration_minutes: parseIntervalToMinutes(row.avg_duration),
      hub_lat: row.hub_lat,
      hub_lng: row.hub_lng,
      distance_m: row.distance_m,
      price_band: row.price_band ?? {},
      whatsapp_opt_in: row.whatsapp_opt_in,
      sms_opt_in: row.sms_opt_in,
      source: row.source as 'self_onboarded' | 'places_api',
      on_time_score: Number(row.on_time_score ?? 0.85),
      cancellation_rate: Number(row.cancellation_rate ?? 0.05),
      last_review_at: row.last_review_at ?? null,
      risk_score: Number(row.risk_score ?? 0.10),
      specializations: row.specializations ?? [],
      capacity: row.capacity ?? 1,
      base_visit_fee: Number(row.base_visit_fee ?? 500),
      base_hourly_rate: Number(row.base_hourly_rate ?? 800),
    }));
    return { candidates };
  },
};

function parseIntervalToMinutes(interval: string | undefined): number {
  if (!interval) return 60;
  // Accept HH:MM:SS or "1 hour 30 minutes" or similar simple forms
  const hh = interval.match(/(\d+)\s*hour/i);
  const mm = interval.match(/(\d+)\s*minute/i);
  const colon = interval.match(/^(\d+):(\d+):(\d+)$/);
  if (colon) return parseInt(colon[1], 10) * 60 + parseInt(colon[2], 10);
  return (hh ? parseInt(hh[1], 10) * 60 : 0) + (mm ? parseInt(mm[1], 10) : 0) || 60;
}

// check_availability
const AvailInput = z.object({ provider_id: z.string(), slot_start: z.string(), slot_end: z.string() });
const AvailOutput = z.object({ available: z.boolean(), next_available: z.string().nullable() });

export const checkAvailabilityTool: Tool<typeof AvailInput, typeof AvailOutput> = {
  name: 'supabase.check_availability',
  description: 'Check if a provider is available at a given slot.',
  input: AvailInput, output: AvailOutput,
  async run({ provider_id, slot_start, slot_end }, ctx) {
    ctx.logger.tool('supabase.check_availability', { provider_id });
    const { data, error } = await admin.rpc('check_availability_rpc', {
      p_provider_id: provider_id,
      p_slot_start: slot_start,
      p_slot_end: slot_end,
    });
    if (error || !data || data.length === 0) {
      ctx.logger.warn('check_availability_rpc error', error);
      return { available: true, next_available: slot_start };
    }
    return { available: data[0].available, next_available: data[0].next_available };
  },
};

// create_booking
const CreateBookingInput = z.object({
  customer_user_id: z.string(),
  customer_user_location_id: z.string(),
  provider_id: z.string(),
  service_category: z.string(),
  slot_start: z.string(),
  slot_end: z.string(),
  location_text: z.string(),
  location_point: PointSchema,
  customer_name_snapshot: z.string().nullable().optional(),
  customer_phone_snapshot: z.string().nullable().optional(),
  customer_lang: z.string().default('en'),
  agent_run_id: z.string(),
  notes: z.string().default(''),
  complexity: z.enum(['basic', 'intermediate', 'complex']).default('basic'),
  price_breakdown: z.record(z.unknown()).nullable().optional(),
  price_estimate: z.record(z.unknown()).optional(),
});
const CreateBookingOutput = z.object({ booking_id: z.string(), invitation_token: z.string() });

export const createBookingTool: Tool<typeof CreateBookingInput, typeof CreateBookingOutput> = {
  name: 'supabase.create_booking',
  description: 'Insert a booking row with status=invitation_sent.',
  input: CreateBookingInput, output: CreateBookingOutput,
  async run(args, ctx) {
    ctx.logger.tool('supabase.create_booking', { provider_id: args.provider_id, slot: args.slot_start });
    const token = nanoid(32);
    const { data, error } = await admin
      .from('bookings')
      .insert({
        customer_user_id: args.customer_user_id,
        customer_user_location_id: args.customer_user_location_id,
        provider_id: args.provider_id,
        service_category: args.service_category,
        slot_start: args.slot_start,
        slot_end: args.slot_end,
        location_text: args.location_text,
        location_point: `SRID=4326;POINT(${args.location_point.lng} ${args.location_point.lat})`,
        customer_name_snapshot: args.customer_name_snapshot ?? null,
        customer_phone_snapshot: args.customer_phone_snapshot ?? null,
        customer_lang: args.customer_lang,
        agent_run_id: args.agent_run_id,
        invitation_token: token,
        notes: args.notes,
        complexity: args.complexity,
        price_breakdown: args.price_breakdown ?? null,
        price_estimate: args.price_estimate ?? null,
      })
      .select('id, invitation_token')
      .single();
    if (error) throw error;
    return { booking_id: data!.id, invitation_token: data!.invitation_token };
  },
};

// update_booking_status
const UpdateStatusInput = z.object({ booking_id: z.string(), status: z.string(), confirmed_at: z.string().optional() });
const UpdateStatusOutput = z.object({ ok: z.boolean() });

export const updateBookingStatusTool: Tool<typeof UpdateStatusInput, typeof UpdateStatusOutput> = {
  name: 'supabase.update_booking_status',
  description: 'Mutate booking.status.',
  input: UpdateStatusInput, output: UpdateStatusOutput,
  async run({ booking_id, status, confirmed_at }, ctx) {
    ctx.logger.tool('supabase.update_booking_status', { booking_id, status });
    const patch: Record<string, unknown> = { status };
    if (confirmed_at) patch.confirmed_at = confirmed_at;
    const { error } = await admin.from('bookings').update(patch).eq('id', booking_id);
    if (error) throw error;
    return { ok: true };
  },
};

// enqueue_reminder
const EnqueueReminderInput = z.object({
  booking_id: z.string(),
  kind: z.enum(['pre_appointment', 'completion_check', 'rating_prompt']),
  due_at: z.string(),
});
const EnqueueReminderOutput = z.object({ reminder_id: z.string() });

export const enqueueReminderTool: Tool<typeof EnqueueReminderInput, typeof EnqueueReminderOutput> = {
  name: 'supabase.enqueue_reminder',
  description: 'Add a reminder row drained by pg_cron.',
  input: EnqueueReminderInput, output: EnqueueReminderOutput,
  async run({ booking_id, kind, due_at }, ctx) {
    ctx.logger.tool('supabase.enqueue_reminder', { booking_id, kind, due_at });
    const { data, error } = await admin
      .from('reminders')
      .insert({ booking_id, kind, due_at })
      .select('id')
      .single();
    if (error) throw error;
    return { reminder_id: data!.id };
  },
};
