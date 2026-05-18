create table reminders (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  kind text not null,
  due_at timestamptz not null,
  status text not null default 'queued',
  payload jsonb,
  sent_at timestamptz,
  attempts integer not null default 0
);
create index reminders_due_queued_idx on reminders(due_at) where status = 'queued';

create table ratings (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique not null references bookings(id),
  stars integer not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create or replace function recompute_provider_rating() returns trigger as $$
begin
  update providers p set
    rating_avg = (select avg(stars) from ratings r join bookings b on b.id = r.booking_id where b.provider_id = p.id),
    rating_count = (select count(*) from ratings r join bookings b on b.id = r.booking_id where b.provider_id = p.id)
  where p.id = (select provider_id from bookings where id = new.booking_id);
  return new;
end;
$$ language plpgsql;

create trigger ratings_after_insert after insert on ratings
for each row execute function recompute_provider_rating();

create table mock_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  channel text not null,
  to_phone text not null,
  body text not null,
  accept_url text not null,
  created_at timestamptz not null default now()
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  endpoint text unique not null,
  keys jsonb not null,
  created_at timestamptz not null default now()
);
