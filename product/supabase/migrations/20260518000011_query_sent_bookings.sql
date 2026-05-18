-- ============================================================================
-- Query-sent bookings for Google Places providers (pre-registration).
--
-- When a user contacts a Places-only provider through SahuliatAI, we:
--   1. Upsert a ghost provider row keyed by external_place_id (no owner yet).
--   2. Create a booking with status='query_sent' tied to that ghost.
--   3. Send the WhatsApp/SMS/mock message with the standard tokenized accept link.
--
-- If the Places provider later joins SahuliatAI via ?ref=<place_id>, they
-- claim the ghost row — and their existing query_sent bookings immediately
-- appear in their dashboard via the existing RLS policy.
-- ============================================================================

-- 1) Extend bookings.status with 'query_sent'
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check check (
  status in ('invitation_sent','confirmed','reminded','in_progress','completed','cancelled','rejected','query_sent')
);

-- 2) Unique on external_place_id so we can upsert ghost providers idempotently
create unique index if not exists providers_external_place_id_unique
  on public.providers(external_place_id)
  where external_place_id is not null;

-- 3) Upsert a ghost provider keyed by Places id
create or replace function public.upsert_places_provider(
  p_place_id text,
  p_business_name text,
  p_phone text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_categories text[] default '{}'
) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
  hub geography(Point, 4326);
begin
  select id into pid from public.providers where external_place_id = p_place_id;
  if pid is not null then
    -- refresh contact info if we now know more
    update public.providers
      set phone = coalesce(p_phone, phone),
          business_name = coalesce(p_business_name, business_name),
          categories = case when array_length(p_categories, 1) > 0 then p_categories else categories end
      where id = pid;
    return pid;
  end if;

  if p_lat is not null and p_lng is not null then
    hub := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  end if;

  insert into public.providers(
    business_name, phone, external_place_id, hub_location,
    source, published, categories, languages
  ) values (
    p_business_name, p_phone, p_place_id, hub,
    'places_api', false, p_categories, '{en}'
  ) returning id into pid;
  return pid;
end;
$$;

grant execute on function public.upsert_places_provider(text, text, text, double precision, double precision, text[]) to service_role;

-- 4) Claim a ghost provider when its business owner joins SahuliatAI
create or replace function public.claim_places_provider(p_place_id text)
  returns table (provider_id uuid, claimed boolean)
  language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
  pre_owner uuid;
begin
  select id, owner_user_id into pid, pre_owner
    from public.providers where external_place_id = p_place_id;
  if pid is null then
    return; -- empty result set
  end if;
  if pre_owner is not null and pre_owner <> auth.uid() then
    -- already claimed by someone else; refuse
    return query select pid, false;
    return;
  end if;
  update public.providers
    set owner_user_id = auth.uid(),
        published = true,
        phone_verified = true
    where id = pid;
  return query select pid, true;
end;
$$;

grant execute on function public.claim_places_provider(text) to authenticated;

-- 5) When a provider accepts a query_sent booking via the token link, the
-- existing /api/provider/accept route handler will move it through query_sent
-- → confirmed. The exclusion constraint already includes 'invitation_sent';
-- update it to also block overlap with query_sent so a customer can't double-
-- book the same ghost provider.
alter table public.bookings drop constraint if exists no_overlap_per_provider;
alter table public.bookings add constraint no_overlap_per_provider
  exclude using gist (
    provider_id with =,
    tstzrange(slot_start, slot_end) with &&
  ) where (status in ('invitation_sent','query_sent','confirmed','reminded','in_progress'));
