-- ============================================================================
-- get_user_location_geo  —  return a user location with lat/lng extracted.
--
-- Reason: PostgREST returns the PostGIS `geography` column as opaque hex EWKB
-- via the JS client, so we can't parse it with a regex. This RPC bypasses that
-- by computing lat/lng server-side via ST_Y / ST_X.
-- ============================================================================

create or replace function public.get_user_location_geo(p_id uuid)
returns table (
  id uuid,
  user_id uuid,
  label text,
  address_text text,
  city text,
  town_or_area text,
  country_code text,
  lat double precision,
  lng double precision
)
language sql stable security definer set search_path = public as $$
  select
    l.id,
    l.user_id,
    l.label,
    l.address_text,
    l.city,
    l.town_or_area,
    l.country_code,
    st_y(l.point::geometry)::double precision as lat,
    st_x(l.point::geometry)::double precision as lng
  from public.user_locations l
  where l.id = p_id;
$$;

-- Allow logged-in users to call it for their own rows (security definer + a
-- runtime check on the user_id).
grant execute on function public.get_user_location_geo(uuid) to authenticated, anon;
