-- QA fix pass: realtime publication, evidence storage bucket, invitation TTL,
-- and a one-time backfill of customer name/phone snapshots on existing bookings.

-- 1. Realtime — the provider dashboard inbox subscribes to bookings changes.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;
end $$;

-- REPLICA IDENTITY FULL so realtime UPDATE events carry non-PK columns,
-- letting the provider inbox filter live updates by provider_id.
alter table public.bookings replica identity full;

-- 2. Storage — provider service-quality photo evidence bucket.
insert into storage.buckets (id, name, public)
values ('booking-evidence', 'booking-evidence', true)
on conflict (id) do nothing;

-- 3. Invitation expiry — widen from 15 minutes to 24 hours so providers
--    (and live demos) have a realistic window to accept.
create or replace function public.sweep_expired_invitations()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.bookings
  set status = 'rejected'
  where status = 'invitation_sent'
    and invitation_sent_at < now() - interval '24 hours';
end;
$$;

-- 4. Backfill — bookings created before the snapshot fix have blank
--    customer name/phone; copy them from the customer's profile.
update public.bookings b
set
  customer_name_snapshot  = coalesce(nullif(b.customer_name_snapshot, ''), up.display_name),
  customer_phone_snapshot = coalesce(nullif(b.customer_phone_snapshot, ''), up.phone)
from public.users_profile up
where up.user_id = b.customer_user_id
  and (
    b.customer_name_snapshot is null or b.customer_name_snapshot = ''
    or b.customer_phone_snapshot is null or b.customer_phone_snapshot = ''
  );
