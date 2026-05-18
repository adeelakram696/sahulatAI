/**
 * Ranking agent — composite score + availability check + bilingual reasoning.
 */
import type { AgentContext, Intent, ProviderCandidate, RankedProvider } from '../types';
import { callTool } from '../tools';

interface RankingInput {
  intent: Intent;
  candidates: ProviderCandidate[];
  user_location: { point: { lat: number; lng: number }; address_text: string };
}
interface RankingOutput {
  top: RankedProvider[];           // top 3 bookable (DB)
  also_nearby: RankedProvider[];   // top 3 Places-only — "View on Google" results
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

  // 1) Distance matrix (refines distance_m from server-side measurement)
  const destinations = input.candidates.map((c) => ({ lat: c.hub_lat, lng: c.hub_lng }));
  const dist = await callTool<{ distances: Array<{ meters: number; seconds: number }>; source: 'google_distance_matrix' | 'haversine_fallback' }>(
    'google.distance_matrix',
    { origin: input.user_location.point, destinations },
    ctx,
  );

  // 2) Availability check per candidate
  const slotStart = input.intent.time.iso;
  const slotEndDate = new Date(new Date(slotStart).getTime() + 60 * 60 * 1000);
  const slotEnd = slotEndDate.toISOString();

  // Places-API candidates aren't in our DB → skip availability check (their id is
  // a string like `places:ChIJ...` not a UUID). Assume available; ranking will
  // still penalize via distance + rating.
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

  // 3) Score
  const scored: RankedProvider[] = input.candidates.map((c, i) => {
    const distM = dist.distances[i]?.meters ?? c.distance_m;
    const distKm = distM / 1000;
    const distancePts = Math.max(0, 35 * (1 - Math.min(distKm, 15) / 15));
    const ratingPts = c.rating_count === 0 ? 12.5 : 25 * (c.rating_avg / 5);
    const availabilityPts = availability[i].available ? 20 : 10;
    const priceFitPts = 5;
    const langMatch = c.languages.includes(input.intent.location.point ? 'en' : 'en') ? 1.0 : 0.5;
    const languagePts = 10 * langMatch;
    const score = Math.round(distancePts + ratingPts + availabilityPts + priceFitPts + languagePts);

    return {
      ...c,
      distance_m: distM,
      score,
      reasoning: {
        en: `${(distKm).toFixed(1)} km away, ★${c.rating_avg.toFixed(1)} from ${c.rating_count} reviews. ${availability[i].available ? 'Available at your slot.' : 'Next free ' + (availability[i].next_available ?? 'soon') + '.'}`,
        ur: `${distKm.toFixed(1)} کلومیٹر دور، ★${c.rating_avg.toFixed(1)} ریٹنگ۔ ${availability[i].available ? 'آپ کے سلاٹ پر دستیاب۔' : 'جلد دستیاب۔'}`,
      },
      is_bookable: c.source === 'self_onboarded',
      available: availability[i].available,
    };
  }).sort((a, b) => b.score - a.score);

  // Split into two ranked lists so the UI can show both bookable + contact-only sections.
  const bookable = scored.filter((p) => p.is_bookable).slice(0, 3);
  const placesOnly = scored.filter((p) => !p.is_bookable).slice(0, 3);
  const top = bookable;
  const lowConfidence = top.length === 0 || top[0].score < 40;

  await ctx.emitTrace({
    runId: ctx.runId, agentName: 'ranking', stepIndex,
    startedAt, endedAt: new Date().toISOString(),
    outputs: { top_count: top.length, also_nearby_count: placesOnly.length, low_confidence: lowConfidence, distance_used: dist.source },
    reasoning: `Top bookable: ${top[0]?.business_name ?? 'none'} (${top[0]?.score ?? 0}/100). Also nearby on Google: ${placesOnly.length}.`,
    status: 'ok',
  });

  return { top, also_nearby: placesOnly, all_scored: scored, low_confidence: lowConfidence, distance_used: dist.source };
}
