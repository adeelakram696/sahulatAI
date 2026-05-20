/**
 * Discovery agent — find candidate providers from:
 *   1. Our seeded `providers` table (PostGIS proximity search)
 *   2. Live Google Places API (Nearby Search)
 * Then dedupe (DB wins) and cap at 15.
 */
import type { AgentContext, Intent, ProviderCandidate } from '../types';
import { callTool } from '../tools';

interface DiscoveryInput { intent: Intent; exclude_provider_ids?: string[] }
interface DiscoveryOutput {
  candidates: ProviderCandidate[];
  radius_used_km: number;
  sources_breakdown: { db: number; places_only: number; duplicates_merged: number };
}

export async function runDiscovery(input: DiscoveryInput, ctx: AgentContext, stepIndex: number): Promise<DiscoveryOutput> {
  const startedAt = new Date().toISOString();
  await ctx.emitTrace({ runId: ctx.runId, agentName: 'discovery', stepIndex, startedAt, inputs: input, status: 'running' });

  let radius = 5;
  let dbCandidates: ProviderCandidate[] = [];
  const exclude = input.exclude_provider_ids ?? [];

  // 1) DB providers with adaptive radius
  while (radius <= 20) {
    const dbResult = await callTool<{ candidates: ProviderCandidate[] }>(
      'supabase.search_providers',
      { service_slug: input.intent.service_slug, point: input.intent.location.point, radius_km: radius, exclude_ids: exclude },
      ctx,
    );
    dbCandidates = dbResult.candidates;
    if (dbCandidates.length >= 3) break;
    if (radius === 5) radius = 10;
    else if (radius === 10) radius = 20;
    else break;
  }

  // 2) Google Places (parallel-friendly with a guard for missing key)
  let placesCandidates: ProviderCandidate[] = [];
  try {
    const places = await callTool<{
      places: Array<{
        external_place_id: string;
        name: string;
        point: { lat: number; lng: number };
        rating: number | null;
        phone?: string | null;
        website?: string | null;
        google_maps_url?: string | null;
        address?: string | null;
      }>;
    }>(
      'google.places_nearby',
      { service_slug: input.intent.service_slug, point: input.intent.location.point, radius_m: radius * 1000 },
      ctx,
    );
    placesCandidates = places.places.map((p) => ({
      id: `places:${p.external_place_id}`,
      business_name: p.name,
      photo_url: null,
      phone: p.phone ?? null,
      website: p.website ?? null,
      google_maps_url: p.google_maps_url ?? null,
      address: p.address ?? null,
      languages: ['en'],
      google_rating: p.rating ?? 0,
      google_rating_count: 0,
      portal_rating: 0,
      portal_rating_count: 0,
      response_time_minutes: null,
      avg_duration_minutes: 60,
      hub_lat: p.point.lat,
      hub_lng: p.point.lng,
      distance_m: haversineMeters(input.intent.location.point, p.point),
      price_band: {},
      whatsapp_opt_in: false,
      sms_opt_in: false,
      source: 'places_api' as const,
      on_time_score: 0.7,
      cancellation_rate: 0.15,
      last_review_at: null,
      risk_score: 0.3,
      specializations: [],
      capacity: 1,
      base_visit_fee: 500,
      base_hourly_rate: 800,
    }));
  } catch (e) {
    ctx.logger.warn('places_nearby unavailable; DB-only', e);
  }

  // 3) Dedupe — Places result is a duplicate if a DB row has a similar name within 200m
  const { merged, duplicatesMerged } = dedupe(dbCandidates, placesCandidates);

  const output: DiscoveryOutput = {
    candidates: merged.slice(0, 15),
    radius_used_km: radius,
    sources_breakdown: {
      db: dbCandidates.length,
      places_only: merged.length - dbCandidates.length,
      duplicates_merged: duplicatesMerged,
    },
  };

  await ctx.emitTrace({
    runId: ctx.runId, agentName: 'discovery', stepIndex,
    startedAt, endedAt: new Date().toISOString(),
    inputs: input,
    outputs: { ...output, candidates_count: output.candidates.length },
    reasoning: `Found ${output.candidates.length} candidates within ${radius} km. DB: ${output.sources_breakdown.db} · Places: ${output.sources_breakdown.places_only} · merged: ${output.sources_breakdown.duplicates_merged}.`,
    status: 'ok',
  });

  return output;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dedupe(db: ProviderCandidate[], places: ProviderCandidate[]): { merged: ProviderCandidate[]; duplicatesMerged: number } {
  const merged: ProviderCandidate[] = [...db];
  let duplicatesMerged = 0;

  for (const p of places) {
    const normPlaceName = normalize(p.business_name);
    const isDup = db.some((d) => {
      const normDbName = normalize(d.business_name);
      const nameOverlap =
        normDbName === normPlaceName ||
        normDbName.includes(normPlaceName) ||
        normPlaceName.includes(normDbName);
      const close = haversineMeters({ lat: d.hub_lat, lng: d.hub_lng }, { lat: p.hub_lat, lng: p.hub_lng }) < 200;
      return nameOverlap && close;
    });
    if (isDup) {
      duplicatesMerged++;
      continue;
    }
    merged.push(p);
  }
  return { merged, duplicatesMerged };
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}
