-- ============================================================================
-- Disputes table + reputation triggers
-- ============================================================================

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  opened_by uuid not null references auth.users(id) on delete cascade,
  opener_role text not null check (opener_role in ('customer','provider')),
  kind text not null check (kind in ('no_show','quality','price','cancellation','overrun','damage')),
  status text not null default 'open' check (status in ('open','under_review','resolved','escalated')),
  statements jsonb not null default '[]'::jsonb,
  resolution jsonb,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  escalated_at timestamptz
);
create index if not exists disputes_booking_idx on public.disputes(booking_id);
create index if not exists disputes_opened_by_idx on public.disputes(opened_by);
create index if not exists disputes_status_idx on public.disputes(status);

alter table public.disputes enable row level security;

create policy "disputes_customer_select" on public.disputes for select using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_id and b.customer_user_id = auth.uid()
  )
);

create policy "disputes_provider_select" on public.disputes for select using (
  exists (
    select 1 from public.bookings b
    join public.providers p on p.id = b.provider_id
    where b.id = booking_id and p.owner_user_id = auth.uid()
  )
);

create policy "disputes_customer_insert" on public.disputes for insert with check (
  opened_by = auth.uid()
  and exists (
    select 1 from public.bookings b
    where b.id = booking_id and b.customer_user_id = auth.uid()
  )
);

-- Service-role bypasses RLS for status updates / resolutions from the agent.

-- Trigger: when a dispute resolves with refund / blacklist, update provider score
create or replace function public.apply_dispute_reputation_effects() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
  upheld boolean;
  refund_pct numeric;
begin
  if new.status <> 'resolved' or old.status = 'resolved' then
    return new;
  end if;
  refund_pct := coalesce((new.resolution->>'refund_percent')::numeric, 0);
  upheld := refund_pct > 0;

  select provider_id into pid from public.bookings where id = new.booking_id;
  if pid is null then return new; end if;

  if upheld then
    if new.kind = 'no_show' then
      update public.providers set
        on_time_score = greatest(0, on_time_score - 0.05),
        risk_score = least(1, risk_score + 0.05)
      where id = pid;
    elsif new.kind in ('cancellation') then
      update public.providers set
        cancellation_rate = least(1, cancellation_rate + 0.02),
        risk_score = least(1, risk_score + 0.03)
      where id = pid;
    elsif new.kind = 'quality' then
      update public.providers set
        risk_score = least(1, risk_score + 0.05)
      where id = pid;
    end if;

    if coalesce((new.resolution->>'blacklist_provider')::boolean, false) then
      update public.providers set published = false where id = pid;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists disputes_after_resolve on public.disputes;
create trigger disputes_after_resolve
  after update on public.disputes
  for each row execute function public.apply_dispute_reputation_effects();
