import { type NextRequest } from 'next/server';
import { admin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');
  const radius = Math.min(50, Math.max(1, parseFloat(searchParams.get('radius_km') ?? '10')));
  const slug = searchParams.get('slug') ?? null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return new Response('invalid_coordinates', { status: 400 });
  }

  if (slug) {
    // Single-category search uses the same RPC the agent calls.
    const { data, error } = await admin.rpc('search_providers_rpc', {
      p_service_slug: slug,
      p_lat: lat,
      p_lng: lng,
      p_radius_km: radius,
      p_limit: 50,
      p_exclude_ids: [],
    });
    if (error) return new Response(error.message, { status: 500 });
    return Response.json({ providers: (data ?? []).map(formatRow) });
  }

  // All categories — direct query because the RPC requires a category.
  const { data, error } = await admin.rpc('providers_in_bbox', {
    p_lat: lat,
    p_lng: lng,
    p_radius_km: radius,
    p_limit: 100,
  });
  if (error) {
    // Fallback: tabular select with bounding box approximation.
    const km = 0.009 * radius; // ~1km per 0.009 deg latitude
    const { data: fallback, error: fbErr } = await admin
      .from('providers')
      .select('id, business_name, photo_url, phone, google_rating, google_rating_count, portal_rating, portal_rating_count, categories')
      .eq('published', true)
      .limit(100);
    if (fbErr) return new Response(fbErr.message, { status: 500 });
    // Without PostGIS extraction we can't return coords easily — best-effort: drop.
    return Response.json({ providers: [], note: 'bbox rpc missing', candidates: fallback?.length ?? 0 });
  }
  return Response.json({ providers: (data ?? []).map(formatRow) });
}

interface ProviderRow {
  id: string;
  business_name: string;
  photo_url: string | null;
  phone: string | null;
  google_rating: number | string | null;
  google_rating_count: number | null;
  portal_rating: number | string | null;
  portal_rating_count: number | null;
  categories?: string[];
  hub_lat: number;
  hub_lng: number;
  distance_m?: number;
}

function formatRow(r: ProviderRow) {
  return {
    id: r.id,
    business_name: r.business_name,
    photo_url: r.photo_url,
    phone: r.phone,
    google_rating: Number(r.google_rating ?? 0),
    google_rating_count: r.google_rating_count ?? 0,
    portal_rating: Number(r.portal_rating ?? 0),
    portal_rating_count: r.portal_rating_count ?? 0,
    categories: r.categories ?? [],
    hub_lat: r.hub_lat,
    hub_lng: r.hub_lng,
    distance_m: r.distance_m ?? null,
  };
}
