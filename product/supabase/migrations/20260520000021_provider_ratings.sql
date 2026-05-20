-- Portal-native provider ratings.
-- Split the Google Places rating from SahuliatAI's own rating so the UI can
-- show both, and source the portal rating from the public.ratings table.

-- 1. The existing rating columns hold the Google Places rating — rename them.
alter table public.providers rename column rating_avg to google_rating;
alter table public.providers rename column rating_count to google_rating_count;

-- 2. Portal rating — the average of customer ratings submitted on SahuliatAI.
alter table public.providers add column if not exists portal_rating numeric not null default 0;
alter table public.providers add column if not exists portal_rating_count integer not null default 0;

comment on column public.providers.google_rating is 'Rating sourced from Google Places.';
comment on column public.providers.portal_rating is 'Average of customer ratings submitted on SahuliatAI (public.ratings).';

-- 3. Denormalise provider_id onto ratings for clean aggregation + queries.
alter table public.ratings add column if not exists provider_id uuid references public.providers(id) on delete cascade;
update public.ratings r
set provider_id = b.provider_id
from public.bookings b
where b.id = r.booking_id and r.provider_id is null;
create index if not exists ratings_provider_id_idx on public.ratings(provider_id);

-- 4. The recompute trigger now updates the PORTAL rating, not the Google one.
create or replace function public.recompute_provider_rating() returns trigger
  language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  pid := coalesce(
    new.provider_id,
    (select provider_id from public.bookings where id = new.booking_id)
  );
  if pid is null then
    return new;
  end if;
  update public.providers set
    portal_rating = (select coalesce(round(avg(stars)::numeric, 2), 0) from public.ratings where provider_id = pid),
    portal_rating_count = (select count(*) from public.ratings where provider_id = pid),
    last_review_at = now()
  where id = pid;
  return new;
end;
$$;

-- Backfill portal aggregates from any pre-existing ratings (idempotent).
update public.providers p set
  portal_rating = coalesce(sub.avg_stars, 0),
  portal_rating_count = coalesce(sub.cnt, 0)
from (
  select provider_id, round(avg(stars)::numeric, 2) as avg_stars, count(*) as cnt
  from public.ratings
  where provider_id is not null
  group by provider_id
) sub
where sub.provider_id = p.id;

-- 5. Let both parties to a booking read its ratings (rating-form state + reviews).
drop policy if exists ratings_select on public.ratings;
create policy ratings_select on public.ratings for select using (
  exists (
    select 1 from public.bookings b
    where b.id = ratings.booking_id
      and (
        b.customer_user_id = auth.uid()
        or b.provider_id in (select id from public.providers where owner_user_id = auth.uid())
      )
  )
);

-- 6. Recreate search_providers_rpc returning both ratings.
drop function if exists public.search_providers_rpc(text, double precision, double precision, numeric, integer, uuid[]);
create function public.search_providers_rpc(
  p_service_slug text,
  p_lat double precision,
  p_lng double precision,
  p_radius_km numeric default 5,
  p_limit integer default 15,
  p_exclude_ids uuid[] default '{}'::uuid[]
) returns table (
  id uuid, business_name text, photo_url text, phone text, languages text[],
  google_rating numeric, google_rating_count integer,
  portal_rating numeric, portal_rating_count integer,
  response_time_minutes integer, avg_duration interval,
  hub_lat double precision, hub_lng double precision, distance_m double precision,
  price_band jsonb, whatsapp_opt_in boolean, sms_opt_in boolean, source text,
  on_time_score numeric, cancellation_rate numeric, last_review_at timestamptz,
  risk_score numeric, specializations text[], capacity integer,
  base_visit_fee numeric, base_hourly_rate numeric
)
language plpgsql stable security definer set search_path = public as $$
declare
  user_point geography := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
begin
  return query
  select
    p.id, p.business_name, p.photo_url, p.phone, p.languages,
    p.google_rating, p.google_rating_count, p.portal_rating, p.portal_rating_count,
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

-- 7. Recreate providers_in_bbox returning both ratings.
drop function if exists public.providers_in_bbox(double precision, double precision, numeric, integer);
create function public.providers_in_bbox(
  p_lat double precision,
  p_lng double precision,
  p_radius_km numeric default 10,
  p_limit integer default 100
) returns table (
  id uuid, business_name text, photo_url text, phone text,
  google_rating numeric, google_rating_count integer,
  portal_rating numeric, portal_rating_count integer,
  categories text[], hub_lat double precision, hub_lng double precision, distance_m double precision
)
language plpgsql stable security definer set search_path = public as $$
declare
  user_point geography := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
begin
  return query
  select
    p.id, p.business_name, p.photo_url, p.phone,
    p.google_rating, p.google_rating_count, p.portal_rating, p.portal_rating_count,
    p.categories,
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
