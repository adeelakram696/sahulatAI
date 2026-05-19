-- Helper RPCs used by compute_price tool.

-- Distance from a provider's hub_location to a lat/lng point, in meters.
create or replace function public.st_distance_to_provider(
  p_provider_id uuid,
  p_lat double precision,
  p_lng double precision
) returns table (distance_m double precision)
  language sql stable security definer set search_path = public as $$
  select st_distance(p.hub_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) as distance_m
  from public.providers p where p.id = p_provider_id;
$$;

-- Count recent bookings in same category + area for surge detection.
create or replace function public.count_recent_bookings_in_area(
  p_service_slug text,
  p_lat double precision,
  p_lng double precision,
  p_radius_km numeric default 5,
  p_since timestamptz default now() - interval '24 hours'
) returns integer
  language sql stable security definer set search_path = public as $$
  select count(*)::int from public.bookings b
  where b.service_category = p_service_slug
    and b.created_at >= p_since
    and st_dwithin(
      b.location_point,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
      p_radius_km * 1000
    );
$$;

grant execute on function public.st_distance_to_provider(uuid, double precision, double precision) to authenticated, service_role;
grant execute on function public.count_recent_bookings_in_area(text, double precision, double precision, numeric, timestamptz) to authenticated, service_role;
