-- Update search_providers_rpc to return the new matching columns.
drop function if exists public.search_providers_rpc(text, double precision, double precision, numeric, integer, uuid[]);

create or replace function public.search_providers_rpc(
  p_service_slug text,
  p_lat double precision,
  p_lng double precision,
  p_radius_km numeric default 5,
  p_limit integer default 15,
  p_exclude_ids uuid[] default '{}'::uuid[]
) returns table (
  id uuid,
  business_name text,
  photo_url text,
  phone text,
  languages text[],
  rating_avg numeric,
  rating_count integer,
  response_time_minutes integer,
  avg_duration interval,
  hub_lat double precision,
  hub_lng double precision,
  distance_m double precision,
  price_band jsonb,
  whatsapp_opt_in boolean,
  sms_opt_in boolean,
  source text,
  on_time_score numeric,
  cancellation_rate numeric,
  last_review_at timestamptz,
  risk_score numeric,
  specializations text[],
  capacity integer,
  base_visit_fee numeric,
  base_hourly_rate numeric
)
language plpgsql stable security definer set search_path = public as $$
declare
  user_point geography := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
begin
  return query
  select
    p.id, p.business_name, p.photo_url, p.phone, p.languages, p.rating_avg, p.rating_count,
    p.response_time_minutes, p.avg_duration,
    st_y(p.hub_location::geometry)::double precision as hub_lat,
    st_x(p.hub_location::geometry)::double precision as hub_lng,
    st_distance(p.hub_location, user_point) as distance_m,
    p.price_band, p.whatsapp_opt_in, p.sms_opt_in, p.source,
    p.on_time_score, p.cancellation_rate, p.last_review_at, p.risk_score,
    p.specializations, p.capacity, p.base_visit_fee, p.base_hourly_rate
  from public.providers p
  where p.published = true
    and p_service_slug = any(p.categories)
    and not (p.id = any(p_exclude_ids))
    and st_dwithin(p.hub_location, user_point, p_radius_km * 1000)
    and (
      p.service_area is null
      or st_contains(p.service_area, user_point::geometry)
      or (p.service_radius_km is not null and st_dwithin(p.hub_location, user_point, p.service_radius_km * 1000))
    )
  order by st_distance(p.hub_location, user_point)
  limit p_limit;
end;
$$;
