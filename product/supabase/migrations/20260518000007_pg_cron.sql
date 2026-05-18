-- ============================================================================
-- pg_cron schedules — reminder dispatch + invitation expiry sweep
--
-- IMPORTANT: After running this migration, set the app settings below in the
-- Supabase SQL editor:
--   alter database postgres set app.reminders_fire_url = 'https://<your-app>.vercel.app/api/reminders/fire';
--   alter database postgres set app.reminders_fire_secret = '<REMINDERS_FIRE_SECRET>';
-- For local dev, use an ngrok URL.
-- ============================================================================

create or replace function public.drain_due_reminders() returns void
  language plpgsql security definer set search_path = public as $$
declare
  r record;
  url text := current_setting('app.reminders_fire_url', true);
  secret text := current_setting('app.reminders_fire_secret', true);
begin
  if url is null or secret is null then
    raise notice 'app.reminders_fire_url / app.reminders_fire_secret not set; skipping';
    return;
  end if;
  for r in
    select id, booking_id, kind from public.reminders
    where status = 'queued' and due_at <= now() and attempts < 5
    for update skip locked
  loop
    perform net.http_post(
      url := url,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || secret,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('reminder_id', r.id, 'booking_id', r.booking_id, 'kind', r.kind)
    );
    update public.reminders set attempts = attempts + 1 where id = r.id;
  end loop;
end;
$$;

create or replace function public.sweep_expired_invitations() returns void
  language plpgsql security definer set search_path = public as $$
begin
  update public.bookings
  set status = 'rejected'
  where status = 'invitation_sent'
    and invitation_sent_at < now() - interval '15 minutes';
end;
$$;

-- Schedule both functions every minute (idempotent — unschedule first if exists)
select cron.unschedule('drain-reminders') where exists (select 1 from cron.job where jobname = 'drain-reminders');
select cron.unschedule('sweep-invitations') where exists (select 1 from cron.job where jobname = 'sweep-invitations');

select cron.schedule('drain-reminders', '* * * * *', $$ select public.drain_due_reminders() $$);
select cron.schedule('sweep-invitations', '* * * * *', $$ select public.sweep_expired_invitations() $$);
