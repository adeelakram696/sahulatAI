# 12 — Reminders & Notifications

The pg_cron pipeline + `notify_provider` strategy chain + reminder dispatch.

[← back to README](./README.md) · scope: [technical-architecture.md § Reminder driver](../scope/technical-architecture.md#reminder-driver-supabase-pg_cron) · [google-apis.md § Provider notification channels](../scope/google-apis.md#provider-notification-channels)

---

## 1. pg_cron schedules

Already created in [02-database.md § 0006_pg_cron.sql](./02-database.md#0006_pg_cronsql). Verify both jobs in Supabase:

```sql
select jobname, schedule, active from cron.job;
-- expect:
-- drain-reminders     * * * * *  t
-- sweep-invitations   * * * * *  t
```

If `drain_due_reminders()` errors, check `cron.job_run_details` for the message.

---

## 2. `/api/reminders/fire` endpoint

`app/api/reminders/fire/route.ts`:

```ts
export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.REMINDERS_FIRE_SECRET}`) return new Response('unauthorized', { status: 401 });

  const { reminder_id, booking_id, kind } = await req.json();
  const reminder = await admin.from('reminders').select('*').eq('id', reminder_id).single();
  if (!reminder.data || reminder.data.status === 'sent') return new Response('ok', { status: 200 });

  try {
    // route into Follow-up agent
    await runWorkflow('reminder_due', { booking_id, reminder_kind: kind });
    await admin.from('reminders').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', reminder_id);
  } catch (e) {
    await admin.from('reminders').update({ status: 'failed' }).eq('id', reminder_id);
    throw e;
  }
  return new Response('ok', { status: 200 });
}
```

Idempotency: short-circuit on `status='sent'`.

---

## 3. `notify_provider` strategy chain (recap)

Spec: [06-tools.md § 5](./06-tools.md#5-notification-tools). Order:
1. (Realtime) — implicit; dashboard subscribers see invitations live, no explicit push from the tool.
2. WhatsApp Cloud API (if `whatsapp_opt_in` + creds available).
3. Twilio SMS (if `sms_opt_in` + creds available).
4. **Mock** — write `mock_messages` row + flag in trace.

The tool records the actual channel into `bookings.invitation_channel`.

### Mock-mode UI surfacing

When `invitation_channel='mock'`, the customer's Invitation Pending page renders a card:

> **Demo Mode: WhatsApp/SMS Not Configured**
> A real provider would have received this message:
> ```
> [body of the message from mock_messages]
> ```
> The acceptance link below works as if they tapped it from WhatsApp:
> [Open acceptance page →]

This sells the mock-mode-as-feature story directly to judges.

---

## 4. Reminder dispatch (Follow-up agent, `mode='dispatch'`)

When `reminder_due` is processed:

| Reminder kind | Actions |
|---|---|
| `pre_appointment` | `web_push.send(customer)` "AC tech Ali arriving in 1 hour" · `web_push.send(provider)` similar · if customer opted into WhatsApp/SMS, send there too · `update_booking_status(reminded)` |
| `completion_check` | Auto-transition `confirmed → in_progress → completed` · enqueue `rating_prompt` at `slot_end + 1h` |
| `rating_prompt` | `web_push.send(customer)` with action button → opens `/bookings?rate=<id>` |

---

## 5. Customer outbound channel (WhatsApp/SMS) — optional

The brief uses provider notification; the team noted **customers can also opt in** to receive reminder pings on WhatsApp/SMS. Same tool chain, gated by:
- `users_profile.whatsapp_opt_in` (new flag — add via migration `0009`).
- `users_profile.sms_opt_in`.

If neither flag set → push-only.

---

## 6. Local dev — running cron without Supabase reaching localhost

`pg_cron` lives in Supabase Cloud and can only reach public URLs. Two paths for local development:

- **Recommended:** `ngrok http 3000` → set `app.reminders_fire_url` to the ngrok URL. Re-run the `alter database postgres set` to update.
- **Alternative:** manually trigger the function in SQL: `select drain_due_reminders();` — useful during testing.

---

## 7. Quotas + cost

Per [google-apis.md § Provider notification channels](../scope/google-apis.md#provider-notification-channels):

- WhatsApp Cloud API: 1000 business-initiated conversations/month free.
- Twilio: $15 trial credit.

We'll burn at most a few dozen during the demo. Cost is essentially zero.

---

## Acceptance for 12-reminders-and-notify

- [ ] pg_cron schedules visible in `cron.job` and active.
- [ ] `select drain_due_reminders();` posts to `/api/reminders/fire` and a queued reminder transitions to `sent`.
- [ ] `select sweep_expired_invitations();` flips an old `invitation_sent` booking to `rejected`.
- [ ] With WhatsApp creds: `notify_provider` sends a real message; without: writes a `mock_messages` row and the UI surfaces it.
- [ ] Mock-mode UI card visible on the Invitation Pending page when channel='mock'.
- [ ] Push notification arrives on a real device at the scheduled time (manual test).
- [ ] Rating prompt push opens the rating sheet.
