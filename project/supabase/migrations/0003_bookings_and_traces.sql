create table agent_traces (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  parent_step_id uuid references agent_traces(id),
  agent_name text not null,
  step_index integer not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  inputs jsonb,
  outputs jsonb,
  tool_calls jsonb,
  reasoning text,
  status text not null default 'ok',
  error jsonb
);
create index agent_traces_run_idx on agent_traces(run_id, step_index);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id),
  customer_user_location_id uuid not null references user_locations(id),
  customer_name_snapshot text,
  customer_phone_snapshot text,
  customer_lang text not null default 'en',
  provider_id uuid not null references providers(id),
  service_category text not null references service_categories(slug),
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  location_text text not null,
  location_point geography(Point, 4326) not null,
  status text not null default 'invitation_sent',
  invitation_token text unique not null,
  invitation_channel text,
  invitation_sent_at timestamptz not null default now(),
  confirmed_at timestamptz,
  price_estimate jsonb,
  agent_run_id uuid,
  receipt_pdf_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- prevent double-booking
alter table bookings add constraint no_overlap_per_provider
  exclude using gist (
    provider_id with =,
    tstzrange(slot_start, slot_end) with &&
  ) where (status in ('invitation_sent','confirmed','reminded','in_progress'));

create index bookings_customer_idx on bookings(customer_user_id, slot_start desc);
create index bookings_provider_idx on bookings(provider_id, slot_start desc);
create index bookings_status_idx on bookings(status) where status in ('invitation_sent','reminded');
