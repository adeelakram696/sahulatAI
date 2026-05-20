/**
 * Ranking agent — 8-factor composite scoring with recency decay,
 * complexity-aware specialization bonus, and per-pick factor breakdown.
 *
 * Factors and weights:
 *   25 distance, 20 rating×recency, 15 on-time, 10 availability(capacity-aware),
 *   10 (1-cancellation_rate), 10 price-fit, 5 language, 5 returning-customer.
 *   + up to +5 specialization bonus when complexity is intermediate/complex.
 */
import { admin } from '@/lib/supabase/admin';
import type { AgentContext, Intent, ProviderCandidate, RankedProvider, FactorBreakdown } from '../types';
import { callTool } from '../tools';

interface RankingInput {
  intent: Intent;
  candidates: ProviderCandidate[];
  user_location: { point: { lat: number; lng: number }; address_text: string };
  customer_user_id?: string;
  complexity?: 'basic' | 'intermediate' | 'complex';
  budget_preference?: 'low' | 'mid' | 'high' | null;
}
interface RankingOutput {
  top: RankedProvider[];
  also_nearby: RankedProvider[];
  all_scored: RankedProvider[];
  low_confidence: boolean;
  distance_used: 'google_distance_matrix' | 'haversine_fallback';
}

export async function runRanking(input: RankingInput, ctx: AgentContext, stepIndex: number): Promise<RankingOutput> {
  const startedAt = new Date().toISOString();
  await ctx.emitTrace({ runId: ctx.runId, agentName: 'ranking', stepIndex, startedAt, inputs: { candidate_count: input.candidates.length }, status: 'running' });

  if (input.candidates.length === 0) {
    await ctx.emitTrace({
      runId: ctx.runId, agentName: 'ranking', stepIndex,
      startedAt, endedAt: new Date().toISOString(),
      outputs: { top: [], all_scored: [] },
      reasoning: 'No candidates to rank.', status: 'ok',
    });
    return { top: [], also_nearby: [], all_scored: [], low_confidence: true, distance_used: 'haversine_fallback' };
  }

  // 1) Distance refinement (Google Distance Matrix → Haversine fallback)
  const destinations = input.candidates.map((c) => ({ lat: c.hub_lat, lng: c.hub_lng }));
  const dist = await callTool<{ distances: Array<{ meters: number; seconds: number }>; source: 'google_distance_matrix' | 'haversine_fallback' }>(
    'google.distance_matrix',
    { origin: input.user_location.point, destinations },
    ctx,
  );

  // 2) Availability per candidate (DB only; Places skip)
  const slotStart = input.intent.time.iso;
  const slotEnd = new Date(new Date(slotStart).getTime() + 60 * 60 * 1000).toISOString();
  const availability = await Promise.all(
    input.candidates.map((c) => {
      if (c.source !== 'self_onboarded') {
        return Promise.resolve({ available: true, next_available: slotStart });
      }
      return callTool<{ available: boolean; next_available: string | null }>(
        'supabase.check_availability',
        { provider_id: c.id, slot_start: slotStart, slot_end: slotEnd },
        ctx,
      ).catch(() => ({ available: true, next_available: slotStart }));
    }),
  );

  // 3) Returning-customer set (which providers this customer has booked before)
  const priorProviderIds = new Set<string>();
  if (input.customer_user_id) {
    const { data } = await admin
      .from('bookings')
      .select('provider_id')
      .eq('customer_user_id', input.customer_user_id)
      .in('status', ['confirmed', 'reminded', 'in_progress', 'completed']);
    (data ?? []).forEach((b) => priorProviderIds.add(b.provider_id as string));
  }

  const complexity = input.complexity ?? 'basic';
  const budgetPref = input.budget_preference ?? input.intent.budget_preference ?? null;
  const userLang = input.intent.location.point ? 'en' : 'en'; // locale lives elsewhere; default en

  // 4) Score every candidate
  const scored: RankedProvider[] = input.candidates.map((c, i) => {
    const distM = dist.distances[i]?.meters ?? c.distance_m;
    const distKm = distM / 1000;

    // Factor 1: distance — 25 points max, decreasing linearly to 0 at 15 km
    const fDistance = Math.round(Math.max(0, 25 * (1 - Math.min(distKm, 15) / 15)) * 10) / 10;

    // Factor 2: rating × recency — 20 points max.
    // Prefer SahuliatAI's own portal rating; fall back to the Google rating
    // when the provider has no portal ratings yet.
    const recencyDecay = decayForDays(daysSince(c.last_review_at));
    const effRating = c.portal_rating_count > 0 ? c.portal_rating : c.google_rating;
    const effCount = c.portal_rating_count > 0 ? c.portal_rating_count : c.google_rating_count;
    const ratingScore = effCount === 0 ? 0.625 : effRating / 5; // 0..1
    const fRatingRecency = Math.round(20 * ratingScore * recencyDecay * 10) / 10;

    // Factor 3: on-time score — 15 points max
    const fOnTime = Math.round(15 * c.on_time_score * 10) / 10;

    // Factor 4: availability (capacity-aware) — 10 points
    const avail = availability[i];
    const fAvail = avail.available ? 10 : (avail.next_available && withinHours(slotStart, avail.next_available, 24) ? 5 : 0);

    // Factor 5: cancellation rate (inverse) — 10 points
    const fCancelInverse = Math.round(10 * (1 - c.cancellation_rate) * 10) / 10;

    // Factor 6: price-fit — 10 points. Scored against user's budget preference.
    // Provider price_band is keyed by service slug with a 'band' field: 'low'|'mid'|'high'.
    const serviceSlugForPrice = input.intent.service_slug;
    const providerBand = (c.price_band?.[serviceSlugForPrice] as { band?: string } | undefined)?.band ?? 'mid';
    const fPriceFit = (() => {
      if (!budgetPref) return 5; // neutral when user didn't express preference
      if (budgetPref === providerBand) return 10; // exact match
      const distance = Math.abs(['low', 'mid', 'high'].indexOf(budgetPref) - ['low', 'mid', 'high'].indexOf(providerBand));
      return distance === 1 ? 5 : 2; // one tier off → 5, two tiers off → 2
    })();

    // Factor 7: language match — 5 points
    const langs = c.languages ?? ['en'];
    const fLanguage = langs.includes(userLang) ? 5 : 2.5;

    // Factor 8: returning customer / user preference — 5 points
    const fUserPref = priorProviderIds.has(c.id) ? 5 : 0;

    // Specialization bonus when job is intermediate/complex AND provider has certs/specializations
    let fSpecBonus = 0;
    if (complexity !== 'basic') {
      const hasCerts = (c as typeof c & { certifications?: string[] }).certifications?.length ?? 0;
      const hasSpecs = c.specializations.length > 0;
      if (hasCerts > 0 || hasSpecs) {
        // Full bonus for complex + certified, partial for intermediate or spec-only
        fSpecBonus = complexity === 'complex' ? (hasCerts > 0 ? 5 : 3) : (hasCerts > 0 ? 3 : 2);
      }
    }

    const factors: FactorBreakdown = {
      distance: fDistance,
      rating_with_recency: fRatingRecency,
      on_time: fOnTime,
      availability: fAvail,
      cancel_inverse: fCancelInverse,
      price_fit: fPriceFit,
      language: fLanguage,
      user_pref: fUserPref,
      specialization_bonus: fSpecBonus,
    };

    const score = Math.round(
      fDistance + fRatingRecency + fOnTime + fAvail + fCancelInverse +
      fPriceFit + fLanguage + fUserPref + fSpecBonus,
    );

    return {
      ...c,
      distance_m: distM,
      score,
      factors,
      reasoning: buildReasoning(c, distKm, avail.available, avail.next_available),
      is_bookable: c.source === 'self_onboarded',
      available: avail.available,
    };
  }).sort((a, b) => b.score - a.score);

  const bookable = scored.filter((p) => p.is_bookable).slice(0, 3);
  const placesOnly = scored.filter((p) => !p.is_bookable).slice(0, 5);
  const top = bookable;
  const lowConfidence = top.length === 0 || top[0].score < 40;

  // Emit a factor-by-factor breakdown line for the top picks in the trace
  const topReasoning = top.map((p) => {
    const f = p.factors!;
    return `${p.business_name}: ${p.score} (dist ${f.distance} · rating×rec ${f.rating_with_recency} · on-time ${f.on_time} · avail ${f.availability} · cancel-inv ${f.cancel_inverse} · price ${f.price_fit} · lang ${f.language} · pref ${f.user_pref}${f.specialization_bonus ? ` · +${f.specialization_bonus} spec` : ''})`;
  }).join('\n');

  await ctx.emitTrace({
    runId: ctx.runId, agentName: 'ranking', stepIndex,
    startedAt, endedAt: new Date().toISOString(),
    outputs: { top_count: top.length, also_nearby_count: placesOnly.length, low_confidence: lowConfidence, distance_used: dist.source, complexity },
    reasoning: `8-factor scoring · distance source: ${dist.source} · complexity: ${complexity}\n${topReasoning}`,
    status: 'ok',
  });

  return { top, also_nearby: placesOnly, all_scored: scored, low_confidence: lowConfidence, distance_used: dist.source };
}

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 9999;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

function decayForDays(days: number): number {
  if (days <= 30) return 1.0;
  if (days <= 90) return 0.85;
  if (days <= 180) return 0.65;
  return 0.4;
}

function withinHours(aIso: string, bIso: string, hours: number): boolean {
  const diff = Math.abs(new Date(bIso).getTime() - new Date(aIso).getTime());
  return diff <= hours * 60 * 60 * 1000;
}

function buildReasoning(
  c: ProviderCandidate,
  _distKm: number,
  available: boolean,
  nextAvailable: string | null,
): { en: string; ur: string } {
  if (c.source !== 'self_onboarded') {
    // Google Places: only show real Google rating — no synthetic on-time/cancel/availability
    const ratingPart = c.google_rating > 0 ? `★${c.google_rating.toFixed(1)} on Google` : 'No rating';
    return {
      en: `${ratingPart} · Listed on Google · contact to confirm availability`,
      ur: `${ratingPart} · گوگل پر درج`,
    };
  }
  // Self-onboarded: real stats only; distance is already shown in the UI card.
  // Prefer the SahuliatAI portal rating; fall back to Google.
  const ratingPart = c.portal_rating_count > 0
    ? `★${c.portal_rating.toFixed(1)} (${c.portal_rating_count} SahuliatAI ${c.portal_rating_count === 1 ? 'review' : 'reviews'})`
    : c.google_rating > 0
      ? `★${c.google_rating.toFixed(1)} on Google`
      : 'No reviews yet';
  const availPart = available ? 'available now' : `next slot ${nextAvailable ?? 'soon'}`;
  return {
    en: `${ratingPart} · on-time ${(c.on_time_score * 100).toFixed(0)}% · cancel ${(c.cancellation_rate * 100).toFixed(0)}% · ${availPart}`,
    ur: `${ratingPart} · بروقت ${(c.on_time_score * 100).toFixed(0)}% · ${available ? 'دستیاب' : 'جلد'}`,
  };
}
