-- ============================================================================
-- Row-level security
-- ============================================================================

alter table public.users_profile enable row level security;
alter table public.user_locations enable row level security;
alter table public.providers enable row level security;
alter table public.bookings enable row level security;
alter table public.agent_traces enable row level security;
alter table public.reminders enable row level security;
alter table public.ratings enable row level security;
alter table public.mock_messages enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.service_categories enable row level security;

-- service_categories: public read
create policy "categories_read_all" on public.service_categories for select using (true);

-- users_profile: owner full
create policy "users_profile_self" on public.users_profile for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- user_locations: owner full
create policy "user_locations_self" on public.user_locations for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- providers: published read; owner full
create policy "providers_read_published" on public.providers for select using (published = true);
create policy "providers_owner_all" on public.providers for all
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

-- bookings: customer + owner-provider can read; provider can update
create policy "bookings_customer_select" on public.bookings for select
  using (customer_user_id = auth.uid());
create policy "bookings_customer_update" on public.bookings for update
  using (customer_user_id = auth.uid()) with check (customer_user_id = auth.uid());
create policy "bookings_provider_select" on public.bookings for select
  using (provider_id in (select id from public.providers where owner_user_id = auth.uid()));
create policy "bookings_provider_update" on public.bookings for update
  using (provider_id in (select id from public.providers where owner_user_id = auth.uid()));

-- ratings: customer of the booking can insert/read
create policy "ratings_customer_select" on public.ratings for select using (
  exists(select 1 from public.bookings b where b.id = booking_id and b.customer_user_id = auth.uid())
);
create policy "ratings_customer_insert" on public.ratings for insert with check (
  exists(select 1 from public.bookings b where b.id = booking_id and b.customer_user_id = auth.uid())
);

-- push_subscriptions: self
create policy "push_subs_self" on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- agent_traces: customer of related booking can read (used for trace viewer)
create policy "traces_customer_read" on public.agent_traces for select using (
  exists(
    select 1 from public.bookings b
    where b.agent_run_id = run_id and b.customer_user_id = auth.uid()
  )
);

-- reminders + mock_messages: no anon policies; service-role only
