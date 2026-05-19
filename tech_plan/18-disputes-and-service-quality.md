# 18 — Service-quality loop + Dispute workflow

The brief's two newest emphases. Service-quality loop = en_route/arrived/checklist visible to customer. Dispute workflow = no-show / quality / refund / blacklist / escalation handled by an Antigravity agent.

[← back to README](./README.md) · scope: [features.md A17–A18, B10–B11, C4](../scope/features.md)

---

## Service-quality flow

### Status enum additions

`bookings.status` extended to include `en_route` and `arrived`. Full transition:
```
invitation_sent → confirmed → en_route → arrived → in_progress → completed
                                ↓ (or)
                             cancelled / rejected
```

### Provider controls (in `components/provider/inbox.tsx`)

For each confirmed booking, show buttons:
- **On the way** → status `en_route`, push "Provider is on the way" to customer
- **Arrived** → status `arrived`, push "Provider has arrived"
- **Mark complete** → opens checklist modal, on submit → status `completed` + writes `service_checklist` jsonb

Checklist (3 toggles + 1 placeholder):
- [ ] Problem fixed
- [ ] Area cleaned up
- [ ] Customer signed off
- 📷 Attach photo (placeholder — stores filename only for hackathon)

### Customer status timeline (in `components/booking/booking-realtime.tsx`)

Horizontal stepper with 5 nodes:
```
●━━━━━━●━━━━━━○━━━━━━○━━━━━━○
Confirmed  On the way  Arrived  In progress  Complete
```

The active step pulses; passed steps are filled green. Realtime subscription updates as the provider clicks each button.

### Follow-up agent additions

Three new triggers:
- On `en_route` transition → push to customer
- On `arrived` transition → push to customer + start completion-window timer
- On `completed` → enqueue rating prompt at completed_at + 1h (already exists)

---

## Dispute workflow

### New table `disputes`

```sql
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  opened_by uuid not null references auth.users(id),
  opener_role text not null check (opener_role in ('customer', 'provider')),
  kind text not null check (kind in ('no_show', 'quality', 'price', 'cancellation', 'overrun', 'damage')),
  status text not null default 'open' check (status in ('open', 'under_review', 'resolved', 'escalated')),
  statements jsonb not null default '[]'::jsonb,       -- list of { by, role, body, created_at }
  resolution jsonb,                                     -- { refund_percent, compensation, blacklist_provider, summary, decided_at }
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  escalated_at timestamptz
);
```

RLS:
- Customer can SELECT + INSERT where the booking belongs to them.
- Provider can SELECT + UPDATE (add counter-statement) where the booking's provider is owned by them.

### Dispute Resolution Agent (`lib/antigravity/agents/disputes.ts`)

Modes:
- `open` — first statement received, set `under_review`
- `respond` — counter-statement added; agent re-evaluates
- `resolve` — applies policy based on `kind`
- `escalate` — sets `escalated_at`, notifies human (mock: writes to a log table)

Policy table (default values; can be tuned later):

| Kind | Auto refund | Compensation | Blacklist threshold |
|---|---|---|---|
| no_show | 100% | none | ≥ 3 no-shows in 30 days |
| quality | 50% | 1 free service | ≥ 5 quality disputes |
| price | 0% (rebill correctly) | none | n/a |
| cancellation | 100% (if provider cancelled < 2h before) | none | ≥ 3 late cancels |
| overrun | partial (case-by-case) | depends | n/a |
| damage | TBD | up to repair cost | ≥ 1 damage upheld → escalate |

Tools registered:
- `supabase.create_dispute`
- `supabase.append_dispute_statement`
- `supabase.update_dispute_status`
- `policy.apply_resolution`

Trace emitted per agent call (judges see the reasoning).

### Customer UI

`components/disputes/report-issue-button.tsx` on `/booking/[id]`:
- Visible when `status ∈ {confirmed, en_route, arrived, in_progress, completed}`
- Opens a modal: kind select + statement textarea + Submit
- Submit → `POST /api/disputes` → Dispute agent runs → modal flips to "Submitted; resolution coming"

Dispute status card on the booking page (replaces booking timeline while dispute is open):
- Status pill
- Statements (customer + provider, threaded)
- Resolution block (refund %, compensation, decided at) once resolved
- "Escalate to human" button while under_review

### Provider UI

In dashboard, new section "Disputes" listing disputes against the provider's bookings:
- Status pill, customer statement, "Respond" button
- Response form: counter-statement → agent re-runs

### Reputation effects

Migration trigger: when a dispute resolves:
- If upheld (customer wins): `on_time_score -= 0.05` (no-show), or rating bump, or cancellation_rate += 0.02 (cancellation)
- If dismissed: no change
- If blacklist threshold hit: `published = false`, log event

---

## Acceptance for 18

- [ ] Provider clicks On-the-way → Customer sees timeline advance via Realtime.
- [ ] Provider clicks Mark complete → checklist modal → checklist persists → status = `completed`.
- [ ] Customer can Report an issue on a completed booking → kind picker shows 6 options.
- [ ] Submitting a no-show dispute → resolves to 100% refund automatically, visible to both sides within seconds.
- [ ] Trace drawer shows the Dispute Resolution agent's reasoning per status transition.
- [ ] Provider with 3 no-show disputes in 30 days gets blacklisted (`published = false`).
- [ ] Resolved-but-disagreed dispute can be escalated; `escalated_at` is set.
