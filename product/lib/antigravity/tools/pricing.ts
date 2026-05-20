/**
 * compute_price — Antigravity-registered tool.
 *
 * Produces a transparent, fairness-aware quote with line-item breakdown.
 * Factors: base visit fee + hourly × hours_estimate + distance cost,
 * adjusted by urgency, complexity, surge, and customer loyalty discount.
 *
 * Returns an EN + UR explanation suitable for rendering in the chat + on the
 * booking detail page. The breakdown is also persisted as bookings.price_breakdown.
 */
import { z } from 'zod';
import { admin } from '@/lib/supabase/admin';
import type { Tool } from '../types';

const Point = z.object({ lat: z.number(), lng: z.number() });

const Input = z.object({
  provider_id: z.string(),
  service_slug: z.string(),
  slot_iso: z.string(),
  user_point: Point,
  complexity: z.enum(['basic', 'intermediate', 'complex']).default('basic'),
  urgency: z.enum(['now', 'today', 'tomorrow', 'this_week']).default('tomorrow'),
  customer_user_id: z.string(),
});

const Output = z.object({
  visit_fee: z.number(),
  hourly_rate: z.number(),
  hours_estimate: z.number(),
  labor_cost: z.number(),
  distance_km: z.number(),
  distance_cost: z.number(),
  base_subtotal: z.number(),
  urgency_pct: z.number(),
  complexity_pct: z.number(),
  surge_pct: z.number(),
  loyalty_pct: z.number(),
  adjustments_total_pct: z.number(),
  adjustments_total: z.number(),
  total: z.number(),
  currency: z.literal('PKR'),
  explanation: z.object({ en: z.string(), ur: z.string() }),
});

export const computePriceTool: Tool<typeof Input, typeof Output> = {
  name: 'compute_price',
  description: 'Generate a transparent price quote with line-item breakdown for a booking.',
  input: Input,
  output: Output,
  async run(args, ctx) {
    ctx.logger.tool('compute_price', { provider: args.provider_id, complexity: args.complexity, urgency: args.urgency });

    // Load provider rates
    const { data: provider } = await admin
      .from('providers')
      .select('id, business_name, hub_location, base_visit_fee, base_hourly_rate, categories')
      .eq('id', args.provider_id)
      .maybeSingle();
    if (!provider) throw new Error('provider not found');

    const visitFee = Number(provider.base_visit_fee ?? 500);
    const hourlyRate = Number(provider.base_hourly_rate ?? 800);

    // Hours estimate based on complexity
    const hoursEstimate = args.complexity === 'complex' ? 2.5 : args.complexity === 'intermediate' ? 1.5 : 1.0;
    const laborCost = Math.round(hourlyRate * hoursEstimate);

    // Distance — parse PostGIS Point WKB from server-side haversine.
    const distanceKm = await distanceFromProvider(provider.id, args.user_point);
    const distanceCost = Math.max(0, Math.round((distanceKm - 3) * 50)); // first 3 km free

    const baseSubtotal = visitFee + laborCost + distanceCost;

    // Adjustments
    const urgencyPct = { now: 25, today: 15, tomorrow: 0, this_week: -5 }[args.urgency];
    const complexityPct = { basic: 0, intermediate: 10, complex: 25 }[args.complexity];
    const surgePct = await computeSurge(args.service_slug, args.user_point);
    const loyaltyPct = await computeLoyaltyDiscount(args.customer_user_id);

    const adjustmentsTotalPct = urgencyPct + complexityPct + surgePct + loyaltyPct;
    const adjustmentsTotal = Math.round(baseSubtotal * adjustmentsTotalPct / 100);
    const total = Math.max(0, baseSubtotal + adjustmentsTotal);

    const explanation = buildExplanation({
      providerName: provider.business_name,
      visitFee, hourlyRate, hoursEstimate, laborCost,
      distanceKm, distanceCost,
      baseSubtotal,
      urgencyPct, complexityPct, surgePct, loyaltyPct,
      total,
    });

    return {
      visit_fee: visitFee,
      hourly_rate: hourlyRate,
      hours_estimate: hoursEstimate,
      labor_cost: laborCost,
      distance_km: Math.round(distanceKm * 10) / 10,
      distance_cost: distanceCost,
      base_subtotal: baseSubtotal,
      urgency_pct: urgencyPct,
      complexity_pct: complexityPct,
      surge_pct: surgePct,
      loyalty_pct: loyaltyPct,
      adjustments_total_pct: adjustmentsTotalPct,
      adjustments_total: adjustmentsTotal,
      total,
      currency: 'PKR' as const,
      explanation,
    };
  },
};

async function distanceFromProvider(providerId: string, point: { lat: number; lng: number }): Promise<number> {
  // Use PostGIS to compute distance; avoids parsing the geography column client-side.
  const { data } = await admin
    .rpc('st_distance_to_provider', { p_provider_id: providerId, p_lat: point.lat, p_lng: point.lng })
    .single<{ distance_m: number }>();
  if (!data || data.distance_m === null) return 0;
  return Number(data.distance_m) / 1000;
}

async function computeSurge(serviceSlug: string, point: { lat: number; lng: number }): Promise<number> {
  // Count active bookings in same category within 5km in last 24h.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  try {
    const { count } = await admin.rpc('count_recent_bookings_in_area', {
      p_service_slug: serviceSlug,
      p_lat: point.lat,
      p_lng: point.lng,
      p_radius_km: 5,
      p_since: since,
    });
    if (count !== null && (count as number) > 5) return 20;
  } catch {
    /* RPC may not exist yet; treat as no surge */
  }
  return 0;
}

async function computeLoyaltyDiscount(customerId: string): Promise<number> {
  const { count } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('customer_user_id', customerId)
    .eq('status', 'completed');
  const n = count ?? 0;
  if (n >= 6) return -15;
  if (n >= 3) return -10;
  if (n >= 1) return -5;
  return 0;
}

function fmt(n: number) {
  return n.toLocaleString('en-PK');
}

function buildExplanation(p: {
  providerName: string;
  visitFee: number; hourlyRate: number; hoursEstimate: number; laborCost: number;
  distanceKm: number; distanceCost: number;
  baseSubtotal: number;
  urgencyPct: number; complexityPct: number; surgePct: number; loyaltyPct: number;
  total: number;
}): { en: string; ur: string } {
  const adjLines: string[] = [];
  if (p.urgencyPct !== 0) adjLines.push(`urgency ${p.urgencyPct > 0 ? '+' : ''}${p.urgencyPct}%`);
  if (p.complexityPct !== 0) adjLines.push(`complexity ${p.complexityPct > 0 ? '+' : ''}${p.complexityPct}%`);
  if (p.surgePct !== 0) adjLines.push(`surge ${p.surgePct > 0 ? '+' : ''}${p.surgePct}%`);
  if (p.loyaltyPct !== 0) adjLines.push(`loyalty ${p.loyaltyPct}%`);
  const adjustments = adjLines.length > 0 ? ` (${adjLines.join(', ')})` : '';

  const en =
    `Base PKR ${fmt(p.visitFee)} + ${p.hoursEstimate}h × PKR ${fmt(p.hourlyRate)} (= PKR ${fmt(p.laborCost)}) + distance PKR ${fmt(p.distanceCost)} → subtotal PKR ${fmt(p.baseSubtotal)}${adjustments} → total PKR ${fmt(p.total)}`;

  const ur =
    `بنیادی PKR ${fmt(p.visitFee)} + ${p.hoursEstimate} گھنٹے × PKR ${fmt(p.hourlyRate)} (PKR ${fmt(p.laborCost)}) + فاصلہ PKR ${fmt(p.distanceCost)} → ذیلی کل PKR ${fmt(p.baseSubtotal)}${adjustments} → کل PKR ${fmt(p.total)}`;

  return { en, ur };
}
