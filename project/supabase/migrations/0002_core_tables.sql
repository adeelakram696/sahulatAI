-- users_profile (1:1 with auth.users)
create table users_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  preferred_locale text not null default 'en',
  default_location_id uuid,
  created_at timestamptz not null default now()
);

-- user_locations
create table user_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  address_text text not null,
  point geography(Point, 4326) not null,
  city text,
  town_or_area text,
  country_code text,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index user_locations_user_id_idx on user_locations(user_id);

-- service_categories (reference data)
create table service_categories (
  slug text primary key,
  name_en text not null,
  name_ur text not null,
  icon text,
  keywords text[] not null default '{}'
);

-- providers
create table providers (
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
  weekly_hours jsonb not null default '{}',
  blackout_dates date[] not null default '{}',
  price_band jsonb not null default '{}',
  rating_avg numeric not null default 0,
  rating_count integer not null default 0,
  response_time_minutes integer,
  avg_duration interval not null default '1 hour',
  published boolean not null default false,
  source text not null default 'self_onboarded',
  external_place_id text,
  created_at timestamptz not null default now()
);
create index providers_categories_gin on providers using gin(categories);
create index providers_hub_gist on providers using gist(hub_location);
create index providers_service_area_gist on providers using gist(service_area);
