-- ============================================================================
-- Booking extras: pricing breakdown, complexity, service-quality fields,
-- and the new status values en_route + arrived.
-- ============================================================================

alter table public.bookings
  add column if not exists price_breakdown jsonb,
  add column if not exists complexity text check (complexity in ('basic','intermediate','complex')),
  add column if not exists service_checklist jsonb,
  add column if not exists service_photos jsonb default '[]'::jsonb,
  add column if not exists en_route_at timestamptz,
  add column if not exists arrived_at timestamptz,
  add column if not exists completed_at timestamptz;

-- Extend status enum to include en_route and arrived
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check check (
  status in (
    'invitation_sent','query_sent','confirmed',
    'en_route','arrived','reminded','in_progress',
    'completed','cancelled','rejected'
  )
);

-- Update overlap exclusion to also block en_route/arrived/in_progress (they're active)
alter table public.bookings drop constraint if exists no_overlap_per_provider;
alter table public.bookings add constraint no_overlap_per_provider
  exclude using gist (
    provider_id with =,
    tstzrange(slot_start, slot_end) with &&
  ) where (status in ('invitation_sent','query_sent','confirmed','en_route','arrived','reminded','in_progress'));
