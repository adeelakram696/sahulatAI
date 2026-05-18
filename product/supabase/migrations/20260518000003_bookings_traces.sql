-- ============================================================================
-- Agent traces + bookings (two-phase invitation flow)
-- ============================================================================

create table if not exists public.agent_traces (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  parent_step_id uuid references public.agent_traces(id) on delete set null,
  agent_name text not null,
  step_index integer not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  inputs jsonb,
  outputs jsonb,
  tool_calls jsonb,
  reasoning text,
  status text not null default 'ok' check (status in ('ok','running','error','needs_input')),
  error jsonb
);
create index if not exists agent_traces_run_idx on public.agent_traces(run_id, step_index);
create index if not exists agent_traces_agent_idx on public.agent_traces(agent_name);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  customer_user_location_id uuid not null references public.user_locations(id) on delete restrict,
  customer_name_snapshot text,
  customer_phone_snapshot text,
  customer_lang text not null default 'en',
  provider_id uuid not null references public.providers(id) on delete restrict,
  service_category text not null references public.service_categories(slug),
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  location_text text not null,
  location_point geography(Point, 4326) not null,
  status text not null default 'invitation_sent' check (
    status in ('invitation_sent','confirmed','reminded','in_progress','completed','cancelled','rejected')
  ),
  invitation_token text unique not null,
  invitation_channel text check (invitation_channel in ('dashboard','whatsapp','sms','mock')),
  invitation_sent_at timestamptz not null default now(),
  confirmed_at timestamptz,
  price_estimate jsonb,
  agent_run_id uuid,
  receipt_pdf_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- prevent double-booking the same provider in overlapping slots
alter table public.bookings drop constraint if exists no_overlap_per_provider;
alter table public.bookings add constraint no_overlap_per_provider
  exclude using gist (
    provider_id with =,
    tstzrange(slot_start, slot_end) with &&
  ) where (status in ('invitation_sent','confirmed','reminded','in_progress'));

create index if not exists bookings_customer_idx on public.bookings(customer_user_id, slot_start desc);
create index if not exists bookings_provider_idx on public.bookings(provider_id, slot_start desc);
create index if not exists bookings_pending_idx on public.bookings(invitation_sent_at) where status = 'invitation_sent';
create index if not exists bookings_token_idx on public.bookings(invitation_token);

-- updated_at trigger
create or replace function public.touch_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bookings_touch_updated_at on public.bookings;
create trigger bookings_touch_updated_at
  before update on public.bookings
  for each row execute function public.touch_updated_at();
