-- providers_in_bbox — return all published providers within radius_km of a point.
-- Used by the /map page to draw markers for any category.
create or replace function public.providers_in_bbox(
  p_lat double precision,
  p_lng double precision,
  p_radius_km numeric default 10,
  p_limit integer default 100
) returns table (
  id uuid,
  business_name text,
  photo_url text,
  phone text,
  rating_avg numeric,
  rating_count integer,
  categories text[],
  hub_lat double precision,
  hub_lng double precision,
  distance_m double precision
)
language plpgsql stable security definer set search_path = public as $$
declare
  user_point geography := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
begin
  return query
  select
    p.id, p.business_name, p.photo_url, p.phone, p.rating_avg, p.rating_count, p.categories,
    st_y(p.hub_location::geometry)::double precision,
    st_x(p.hub_location::geometry)::double precision,
    st_distance(p.hub_location, user_point) as distance_m
  from public.providers p
  where p.published = true
    and st_dwithin(p.hub_location, user_point, p_radius_km * 1000)
  order by st_distance(p.hub_location, user_point)
  limit p_limit;
end;
$$;
