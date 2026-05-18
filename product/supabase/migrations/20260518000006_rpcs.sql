-- ============================================================================
-- RPC functions called by Antigravity tools
-- ============================================================================

-- search_providers_rpc: PostGIS-filtered provider search
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
  source text
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
    p.price_band, p.whatsapp_opt_in, p.sms_opt_in, p.source
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

-- check_availability_rpc
create or replace function public.check_availability_rpc(
  p_provider_id uuid,
  p_slot_start timestamptz,
  p_slot_end timestamptz
) returns table (available boolean, next_available timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  has_overlap boolean;
  weekly jsonb;
  blackouts date[];
  next_av timestamptz;
begin
  select weekly_hours, blackout_dates into weekly, blackouts
  from public.providers where id = p_provider_id;

  -- check blackout
  if p_slot_start::date = any(blackouts) then
    return query select false, null::timestamptz;
    return;
  end if;

  -- check overlap with existing active bookings
  select exists(
    select 1 from public.bookings b
    where b.provider_id = p_provider_id
      and b.status in ('invitation_sent','confirmed','reminded','in_progress')
      and tstzrange(b.slot_start, b.slot_end) && tstzrange(p_slot_start, p_slot_end)
  ) into has_overlap;

  if has_overlap then
    -- naive next-available: 1h after slot_end of latest overlap
    select max(b.slot_end) + interval '15 minutes' into next_av
    from public.bookings b
    where b.provider_id = p_provider_id
      and b.status in ('invitation_sent','confirmed','reminded','in_progress')
      and tstzrange(b.slot_start, b.slot_end) && tstzrange(p_slot_start, p_slot_end);
    return query select false, next_av;
  else
    return query select true, p_slot_start;
  end if;
end;
$$;
