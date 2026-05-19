-- ============================================================================
-- Provider extras for advanced matching + dynamic pricing.
-- ============================================================================

alter table public.providers
  add column if not exists on_time_score numeric(3,2) not null default 0.85,
  add column if not exists cancellation_rate numeric(3,2) not null default 0.05,
  add column if not exists last_review_at timestamptz,
  add column if not exists risk_score numeric(3,2) not null default 0.10,
  add column if not exists specializations text[] not null default '{}',
  add column if not exists capacity integer not null default 1,
  add column if not exists base_visit_fee numeric not null default 500,
  add column if not exists base_hourly_rate numeric not null default 800;

create index if not exists providers_specializations_gin on public.providers using gin(specializations);
