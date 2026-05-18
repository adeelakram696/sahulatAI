-- places_contacts: stores mock "contact this Google-Places provider" requests
-- so the audit trail (trace drawer + dashboard) mirrors real-provider invitations.
create table if not exists public.places_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null,
  business_name text not null,
  channel text not null check (channel in ('sms', 'email')),
  recipient text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists places_contacts_user_idx on public.places_contacts(user_id);

alter table public.places_contacts enable row level security;

create policy "places_contacts_self_read" on public.places_contacts for select
  using (user_id = auth.uid());
create policy "places_contacts_self_insert" on public.places_contacts for insert
  with check (user_id = auth.uid());
