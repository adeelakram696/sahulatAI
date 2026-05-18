alter table users_profile enable row level security;
alter table user_locations enable row level security;
alter table providers enable row level security;
alter table bookings enable row level security;
alter table agent_traces enable row level security;
alter table reminders enable row level security;
alter table ratings enable row level security;
alter table mock_messages enable row level security;
alter table push_subscriptions enable row level security;

-- users_profile
create policy users_profile_self on users_profile for all using (user_id = auth.uid());

-- user_locations
create policy user_locations_self on user_locations for all using (user_id = auth.uid());

-- providers (everyone reads published; owner writes)
create policy providers_read_published on providers for select using (published = true);
create policy providers_owner_all on providers for all using (owner_user_id = auth.uid());

-- bookings (customer + provider can read; provider can update status)
create policy bookings_customer_select on bookings for select using (customer_user_id = auth.uid());
create policy bookings_provider_select on bookings for select using (
  provider_id in (select id from providers where owner_user_id = auth.uid())
);
create policy bookings_provider_update on bookings for update using (
  provider_id in (select id from providers where owner_user_id = auth.uid())
);

-- ratings (customer can write own, anyone can read aggregated via providers row)
create policy ratings_customer_insert on ratings for insert with check (
  exists(select 1 from bookings b where b.id = booking_id and b.customer_user_id = auth.uid())
);

-- agent_traces, reminders, mock_messages — server only via service-role; no anon policies.
