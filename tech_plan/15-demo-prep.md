# 15 — Demo Prep

Pre-seed data, demo accounts, two-window setup, dry runs.

[← back to README](./README.md) · scope: [demo-script.md](../scope/demo-script.md)

---

## 1. Demo accounts (seeded)

Add to `supabase/seed.sql`:

| Role | Email | Password | Notes |
|---|---|---|---|
| Customer (Ayesha) | `ayesha@example.com` | `Demo!1234` | Pre-seeded with `Home (G-13)` + `Work (F-7)` locations; push subscription seeded if possible |
| Provider (Ali AC) | `ali@example.com` | `Demo!1234` | `whatsapp_opt_in=true`, `phone=+92 300 555 0101`, published |
| Provider (Bright Tutors) | `tutor@example.com` | `Demo!1234` | for "switch category" demo flourish |

Use Supabase Auth admin API in a seed script `supabase/seed-auth.ts`:

```ts
await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name } });
```

Run via `pnpm db:seed:auth` script.

---

## 2. Pre-seeded historical data

To make the app feel lived-in for judges browsing it:
- **3 completed bookings** for Ali AC with ratings (4.7, 4.8, 5.0). Ratings already submitted.
- **3 sample agent_traces** for the canonical query so `/demo` and `/trace/[runId]` have something to show before any live run.
- **2 sample bookings in progress** to show the dashboard pipeline.

Trace seeds: copy the JSON shape from [agent-workflow.md § Example trace](../scope/agent-workflow.md#example-trace-the-briefs-canonical-query), insert as rows into `agent_traces`.

---

## 3. Two-window recording setup

For the video (per [demo-script.md](../scope/demo-script.md)):

- **Left window:** customer view, signed in as Ayesha.
- **Right window:** provider view, signed in as Ali (his dashboard).
- Both at desktop browser zoom 110% so text reads on the recorded video.
- Background: black or muted color; no system notifications visible.

Alternative if recording from two phones isn't feasible: use BrowserStack or two browser profiles side-by-side.

---

## 4. Dry-run script (run 30 min before recording)

```
1. Truncate and re-seed the demo DB (script: `pnpm db:reset:demo`).
2. Sign in Ayesha + Ali in respective windows.
3. Run canonical query end-to-end once → verify confetti + receipt.
4. Reset Ayesha's last booking to status='invitation_sent' so we can re-demo without seeing the prior confirmed state.
5. Manually fire one reminder by setting `due_at = now()` on a queued row.
6. Verify trace drawer + replay button work.
7. Open /demo and tap each prefilled query → assert all 4 run cleanly.
8. Open /trace/<runId> for the seeded historical run → confirm renders.
```

Have someone time the recording with a stopwatch — 4:00 ± 15 s.

---

## 5. Failure injection plan (test backup contingencies)

For each backup case in [demo-script.md § Backup contingencies](../scope/demo-script.md#backup-contingencies):

| Inject | Verify |
|---|---|
| Set `NEXT_PUBLIC_USE_GOOGLE_APIS=false`, redeploy | Fallback maps + Haversine work |
| Revoke WhatsApp credential | `notify_provider` writes `mock_messages`, UI surfaces it |
| Stop pg_cron temporarily (`update cron.job set active=false where jobname='drain-reminders';`) | Manual `curl -X POST /api/reminders/fire` with correct secret fires the reminder |
| Disable provider accept page momentarily | Accept from dashboard works the same |

Re-enable everything after testing.

---

## 6. Final checklist before submission

| Item | Done? |
|---|---|
| Live URL responsive and public | |
| README rendered cleanly on GitHub | |
| Demo video uploaded (3–5 min) | |
| Backup recording uploaded | |
| Agent trace JSON example committed | |
| GitHub repo public + linked from submission form | |
| Team members listed in README | |
| All env secrets out of git history | |

---

## Acceptance for 15-demo-prep

- [ ] Demo accounts can sign in on the production URL.
- [ ] Seeded historical bookings + traces visible without running anything.
- [ ] Dry-run script completes in < 10 minutes with no manual fixes.
- [ ] All 4 backup contingencies tested at least once.
- [ ] Final checklist all checked.
