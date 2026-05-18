-- ============================================================================
-- Core tables: profiles, locations, categories, providers
-- ============================================================================

-- users_profile: 1:1 with auth.users
create table if not exists public.users_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  preferred_locale text not null default 'en' check (preferred_locale in ('en','ur','ur-Latn')),
  default_location_id uuid,
  created_at timestamptz not null default now()
);

-- user_locations: at least one required to make a request
create table if not exists public.user_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  address_text text not null,
  point geography(Point, 4326) not null,
  city text,
  town_or_area text,
  country_code text default 'PK',
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists user_locations_user_id_idx on public.user_locations(user_id);
create index if not exists user_locations_point_idx on public.user_locations using gist(point);

alter table public.users_profile
  add constraint users_profile_default_location_fk
  foreign key (default_location_id) references public.user_locations(id) on delete set null
  deferrable initially deferred;

-- service_categories: reference data
create table if not exists public.service_categories (
  slug text primary key,
  name_en text not null,
  name_ur text not null,
  icon text,
  keywords text[] not null default '{}'
);

-- providers
create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  business_name text not null,
  slug text unique,
  photo_url text,
  phone text,
  phone_verified boolean not null default false,
  whatsapp_opt_in boolean not null default false,
  sms_opt_in boolean not null default false,
  languages text[] not null default '{en}',
  categories text[] not null default '{}',
  service_area geometry(Polygon, 4326),
  service_radius_km numeric,
  hub_location geography(Point, 4326),
  weekly_hours jsonb not null default '{}'::jsonb,
  blackout_dates date[] not null default '{}',
  price_band jsonb not null default '{}'::jsonb,
  rating_avg numeric not null default 0,
  rating_count integer not null default 0,
  response_time_minutes integer,
  avg_duration interval not null default '1 hour',
  published boolean not null default false,
  source text not null default 'self_onboarded' check (source in ('self_onboarded','places_api')),
  external_place_id text,
  created_at timestamptz not null default now()
);
create index if not exists providers_categories_gin on public.providers using gin(categories);
create index if not exists providers_hub_gist on public.providers using gist(hub_location);
create index if not exists providers_service_area_gist on public.providers using gist(service_area);
create index if not exists providers_published_idx on public.providers(published) where published = true;

-- users_profile autocreate trigger
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.users_profile(user_id, display_name, preferred_locale)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email), 'en')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
