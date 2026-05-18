/**
 * Google Maps Platform tools — Places Nearby, Place Details, Geocoding, Distance Matrix.
 * Each tool has a Haversine/static fallback when NEXT_PUBLIC_USE_GOOGLE_APIS=false.
 */
import { z } from 'zod';
import { env, useGoogleApis } from '@/lib/env';
import type { Tool } from '../types';

const PointSchema = z.object({ lat: z.number(), lng: z.number() });

// ---------------------------------------------------------------------------
// google.geocode  (forward + reverse)
// ---------------------------------------------------------------------------
const GeocodeInput = z.object({ text: z.string().optional(), coords: PointSchema.optional() });
const GeocodeOutput = z.object({
  point: PointSchema,
  city: z.string().nullable(),
  town_or_area: z.string().nullable(),
  country_code: z.string(),
  formatted_address: z.string(),
});

export const geocodeTool: Tool<typeof GeocodeInput, typeof GeocodeOutput> = {
  name: 'google.geocode',
  description: 'Forward or reverse geocode an address / coords.',
  input: GeocodeInput, output: GeocodeOutput,
  async run({ text, coords }, ctx) {
    ctx.logger.tool('google.geocode', { text, coords });
    if (!useGoogleApis() || !env.GOOGLE_MAPS_SERVER_KEY) {
      return fallbackGeocode(text, coords);
    }
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    if (text) url.searchParams.set('address', text);
    if (coords) url.searchParams.set('latlng', `${coords.lat},${coords.lng}`);
    url.searchParams.set('region', 'pk');
    url.searchParams.set('key', env.GOOGLE_MAPS_SERVER_KEY);
    const res = await fetch(url.toString());
    if (!res.ok) return fallbackGeocode(text, coords);
    const data = await res.json();
    const r = data.results?.[0];
    if (!r) return fallbackGeocode(text, coords);
    const point = { lat: r.geometry.location.lat, lng: r.geometry.location.lng };
    const findComp = (type: string) =>
      r.address_components.find((c: { types: string[] }) => c.types.includes(type))?.long_name ?? null;
    return {
      point,
      city: findComp('locality'),
      town_or_area: findComp('sublocality_level_1') ?? findComp('neighborhood'),
      country_code: r.address_components.find((c: { types: string[] }) => c.types.includes('country'))?.short_name ?? 'PK',
      formatted_address: r.formatted_address ?? text ?? '',
    };
  },
};

// Static Islamabad sector lookup (free + offline).
const ISLAMABAD_SECTORS: Record<string, { lat: number; lng: number; town: string }> = {
  'g-13': { lat: 33.6469, lng: 72.9560, town: 'G-13' },
  'g-14': { lat: 33.6280, lng: 72.9300, town: 'G-14' },
  'f-7':  { lat: 33.7160, lng: 72.9930, town: 'F-7' },
  'f-8':  { lat: 33.7060, lng: 73.0100, town: 'F-8' },
  'f-10': { lat: 33.6856, lng: 73.0072, town: 'F-10' },
  'f-11': { lat: 33.6928, lng: 72.9853, town: 'F-11' },
  'i-8':  { lat: 33.6776, lng: 73.0700, town: 'I-8' },
  'i-9':  { lat: 33.6620, lng: 73.0610, town: 'I-9' },
  'blue area': { lat: 33.7150, lng: 73.0410, town: 'Blue Area' },
};

function fallbackGeocode(text?: string, coords?: { lat: number; lng: number }): z.infer<typeof GeocodeOutput> {
  if (coords) {
    return { point: coords, city: 'Islamabad', town_or_area: null, country_code: 'PK', formatted_address: `${coords.lat}, ${coords.lng}` };
  }
  const key = (text || '').toLowerCase().match(/(g-\d+|f-\d+|i-\d+|blue area)/);
  if (key) {
    const hit = ISLAMABAD_SECTORS[key[0]];
    if (hit) return { point: { lat: hit.lat, lng: hit.lng }, city: 'Islamabad', town_or_area: hit.town, country_code: 'PK', formatted_address: text ?? hit.town };
  }
  // Default to Islamabad city center
  return { point: { lat: 33.6938, lng: 73.0651 }, city: 'Islamabad', town_or_area: null, country_code: 'PK', formatted_address: text ?? 'Islamabad' };
}

// ---------------------------------------------------------------------------
// google.distance_matrix
// ---------------------------------------------------------------------------
const DistanceInput = z.object({
  origin: PointSchema,
  destinations: z.array(PointSchema).max(25),
});
const DistanceOutput = z.object({
  distances: z.array(z.object({ meters: z.number(), seconds: z.number() })),
  source: z.enum(['google_distance_matrix', 'haversine_fallback']),
});

export const distanceMatrixTool: Tool<typeof DistanceInput, typeof DistanceOutput> = {
  name: 'google.distance_matrix',
  description: 'Distance + travel time from one origin to many destinations.',
  input: DistanceInput, output: DistanceOutput,
  async run({ origin, destinations }, ctx) {
    ctx.logger.tool('google.distance_matrix', { destinations: destinations.length });
    if (!useGoogleApis() || !env.GOOGLE_MAPS_SERVER_KEY || destinations.length === 0) {
      return { distances: destinations.map((d) => ({ meters: haversine(origin, d), seconds: Math.round((haversine(origin, d) / 1000 / 30) * 3600) })), source: 'haversine_fallback' };
    }
    try {
      const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
      url.searchParams.set('origins', `${origin.lat},${origin.lng}`);
      url.searchParams.set('destinations', destinations.map((d) => `${d.lat},${d.lng}`).join('|'));
      url.searchParams.set('mode', 'driving');
      url.searchParams.set('key', env.GOOGLE_MAPS_SERVER_KEY);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      const row = data.rows?.[0];
      if (!row) throw new Error('no rows');
      const distances = row.elements.map((el: { distance?: { value: number }; duration?: { value: number } }) => ({
        meters: el.distance?.value ?? 0,
        seconds: el.duration?.value ?? 0,
      }));
      return { distances, source: 'google_distance_matrix' };
    } catch (e) {
      ctx.logger.warn('distance matrix failed; using haversine', e);
      return { distances: destinations.map((d) => ({ meters: haversine(origin, d), seconds: Math.round((haversine(origin, d) / 1000 / 30) * 3600) })), source: 'haversine_fallback' };
    }
  },
};

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

// ---------------------------------------------------------------------------
// google.places_nearby  (stubbed for hackathon — DB providers cover discovery)
// ---------------------------------------------------------------------------
const PlacesInput = z.object({
  service_slug: z.string(),
  point: PointSchema,
  radius_m: z.number().default(5000),
});
const PlacesOutput = z.object({
  places: z.array(z.object({
    external_place_id: z.string(),
    name: z.string(),
    point: PointSchema,
    rating: z.number().nullable(),
    phone: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
    google_maps_url: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
  })),
});

export const placesNearbyTool: Tool<typeof PlacesInput, typeof PlacesOutput> = {
  name: 'google.places_nearby',
  description: 'Discover providers from Google Places near a point.',
  input: PlacesInput, output: PlacesOutput,
  async run({ service_slug, point, radius_m }, ctx) {
    ctx.logger.tool('google.places_nearby', { service_slug });
    if (!useGoogleApis() || !env.GOOGLE_MAPS_SERVER_KEY) return { places: [] };
    try {
      const url = 'https://places.googleapis.com/v1/places:searchNearby';
      const body = {
        includedTypes: serviceSlugToPlacesTypes(service_slug),
        locationRestriction: {
          circle: { center: { latitude: point.lat, longitude: point.lng }, radius: Math.min(radius_m, 50000) },
        },
        maxResultCount: 8,
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': env.GOOGLE_MAPS_SERVER_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.rating,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.formattedAddress',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        ctx.logger.warn('places api non-200', await res.text().catch(() => ''));
        return { places: [] };
      }
      const data = await res.json();
      type GPlace = {
        id: string;
        displayName?: { text: string };
        location?: { latitude: number; longitude: number };
        rating?: number;
        internationalPhoneNumber?: string;
        websiteUri?: string;
        googleMapsUri?: string;
        formattedAddress?: string;
      };
      const places = (data.places || []).map((p: GPlace) => ({
        external_place_id: p.id,
        name: p.displayName?.text ?? 'Unknown',
        point: { lat: p.location?.latitude ?? point.lat, lng: p.location?.longitude ?? point.lng },
        rating: p.rating ?? null,
        phone: p.internationalPhoneNumber ?? null,
        website: p.websiteUri ?? null,
        google_maps_url: p.googleMapsUri ?? null,
        address: p.formattedAddress ?? null,
      }));
      return { places };
    } catch (e) {
      ctx.logger.warn('places fetch error', e);
      return { places: [] };
    }
  },
};

/**
 * Maps our service slugs to Places API (New) `includedTypes`.
 * Valid types listed at https://developers.google.com/maps/documentation/places/web-service/place-types
 */
function serviceSlugToPlacesTypes(slug: string): string[] {
  const map: Record<string, string[]> = {
    ac_repair:        ['electrician'],
    plumber:          ['plumber'],
    electrician:      ['electrician'],
    tutor:            ['school', 'tutoring_school'],
    beautician:       ['beauty_salon', 'hair_salon'],
    carpenter:        ['general_contractor'],
    car_wash:         ['car_wash'],
    car_mechanic:     ['car_repair'],
    mobile_repair:    ['electronics_store'],
    house_cleaning:   ['cleaning_service', 'general_contractor'],
    cook:             ['catering_service', 'meal_takeaway'],
    painter:          ['painter'],
    mason:            ['general_contractor'],
    appliance_repair: ['electrician', 'general_contractor'],
    gardening:        ['landscaping'],
    pest_control:     ['general_contractor'],
  };
  return map[slug] ?? ['point_of_interest'];
}
