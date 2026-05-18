-- ============================================================================
-- Reminders, ratings, mock messages, push subscriptions
-- ============================================================================

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  kind text not null check (kind in ('pre_appointment','completion_check','rating_prompt')),
  due_at timestamptz not null,
  status text not null default 'queued' check (status in ('queued','sent','failed')),
  payload jsonb,
  sent_at timestamptz,
  attempts integer not null default 0
);
create index if not exists reminders_due_queued_idx on public.reminders(due_at) where status = 'queued';
create index if not exists reminders_booking_idx on public.reminders(booking_id);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique not null references public.bookings(id) on delete cascade,
  stars integer not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create or replace function public.recompute_provider_rating() returns trigger
  language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select provider_id into pid from public.bookings where id = new.booking_id;
  update public.providers set
    rating_avg = (
      select coalesce(avg(r.stars), 0)
      from public.ratings r
      join public.bookings b on b.id = r.booking_id
      where b.provider_id = pid
    ),
    rating_count = (
      select count(*)
      from public.ratings r
      join public.bookings b on b.id = r.booking_id
      where b.provider_id = pid
    )
  where id = pid;
  return new;
end;
$$;

drop trigger if exists ratings_after_insert on public.ratings;
create trigger ratings_after_insert after insert on public.ratings
  for each row execute function public.recompute_provider_rating();

create table if not exists public.mock_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  channel text not null check (channel in ('whatsapp','sms')),
  to_phone text not null,
  body text not null,
  accept_url text not null,
  created_at timestamptz not null default now()
);
create index if not exists mock_messages_booking_idx on public.mock_messages(booking_id);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  endpoint text unique not null,
  keys jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on public.push_subscriptions(user_id);
