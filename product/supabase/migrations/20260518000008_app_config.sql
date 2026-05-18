-- ============================================================================
-- app_config table + drain_due_reminders rewrite
--
-- Reason: Supabase's hosted Postgres denies `alter database postgres set …`
-- to non-superusers. Instead we keep config in a row-level-locked table that
-- the SECURITY DEFINER function reads from.
-- ============================================================================

create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;
-- No anon/authenticated policies on purpose — service-role bypasses RLS;
-- the SECURITY DEFINER function can read it; nobody else can.

-- Re-create the drain function to read from app_config
create or replace function public.drain_due_reminders() returns void
  language plpgsql security definer set search_path = public as $$
declare
  r record;
  fire_url text;
  fire_secret text;
begin
  select value into fire_url   from public.app_config where key = 'reminders_fire_url';
  select value into fire_secret from public.app_config where key = 'reminders_fire_secret';
  if fire_url is null or fire_secret is null then
    raise notice 'app_config keys reminders_fire_url/reminders_fire_secret not set; skipping drain';
    return;
  end if;
  for r in
    select id, booking_id, kind from public.reminders
    where status = 'queued' and due_at <= now() and attempts < 5
    for update skip locked
  loop
    perform net.http_post(
      url := fire_url,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || fire_secret,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('reminder_id', r.id, 'booking_id', r.booking_id, 'kind', r.kind)
    );
    update public.reminders set attempts = attempts + 1 where id = r.id;
  end loop;
end;
$$;
