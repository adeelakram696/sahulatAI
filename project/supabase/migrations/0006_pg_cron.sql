-- drain_due_reminders: scans reminders and POSTs to /api/reminders/fire
create or replace function drain_due_reminders() returns void as $$
declare r record;
begin
  for r in
    select id, booking_id, kind from reminders
    where status = 'queued' and due_at <= now() and attempts < 5
    for update skip locked
  loop
    perform net.http_post(
      url := current_setting('app.reminders_fire_url', true),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.reminders_fire_secret', true),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('reminder_id', r.id, 'booking_id', r.booking_id, 'kind', r.kind)
    );
    update reminders set attempts = attempts + 1 where id = r.id;
  end loop;
end;
$$ language plpgsql security definer;

-- sweep expired invitations
create or replace function sweep_expired_invitations() returns void as $$
begin
  update bookings set status = 'rejected', updated_at = now()
  where status = 'invitation_sent'
    and invitation_sent_at < now() - interval '15 minutes';
end;
$$ language plpgsql security definer;

-- schedule both every minute
select cron.schedule('drain-reminders', '* * * * *', $$ select drain_due_reminders() $$);
select cron.schedule('sweep-invitations', '* * * * *', $$ select sweep_expired_invitations() $$);
