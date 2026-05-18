# 08 — API Routes

Every route handler under `app/api/`. Auth guards, Zod validation, response shapes.

[← back to README](./README.md) · scope: [technical-architecture.md § API contracts](../scope/technical-architecture.md#api-contracts-high-level)

---

## Conventions

- Validate every body/query with `zod`. Reject 400 with `{ error: { code, message, issues } }`.
- Auth: extract user via `lib/supabase/server.ts` `getUser()`. Return 401 if required and missing.
- Service-role for `agent_traces`, `reminders`, `mock_messages` writes (use `lib/supabase/admin.ts`).
- Errors: 4xx for user errors, 5xx for server errors; never leak stack traces.

---

## Routes

### `POST /api/agent/run` — streaming SSE
Spec: [technical-architecture.md § POST /api/agent/run](../scope/technical-architecture.md#post-apiagentrun)

```ts
const Body = z.object({
  event: z.enum(['new_request','clarification_reply','slot_selected']),
  message: z.string().optional(),
  locale: z.enum(['en','ur','ur-Latn']),
  selected_location_id: z.string().uuid(),
  prior_run_id: z.string().uuid().optional(),    // for clarification_reply
  // for slot_selected:
  provider_id: z.string().uuid().optional(),
  slot_start: z.string().datetime().optional(),
});
```

- Auth required.
- Validates selected_location_id belongs to the user.
- Returns SSE stream from the workflow runtime.
- Terminal event includes `run_id` and the final result envelope.

### `GET /api/agent/trace?runId=...&format=json`
- Auth required (run owner only).
- Returns `agent_traces` rows for the run, in step order.
- Used by `/trace/[runId]` page + judge JSON export.

### `POST /api/bookings`
Convenience endpoint for the UI to call Booking Phase A *if* we don't pipe it through `/api/agent/run`. (We do pipe it through; this endpoint exists for `My bookings` actions like Cancel.)
- `POST /api/bookings` — already covered via `slot_selected` event.
- `DELETE /api/bookings/:id` — customer cancels (only if status in `invitation_sent` or `confirmed`).

### `GET /api/bookings`
- Auth required.
- Returns customer's bookings (joined with provider + service category).
- Query params: `tab=upcoming|past`.

### `GET /api/providers`
- Public read for published providers.
- Query: `?service=ac_repair&near=33.6,73.0&radius_km=5`.
- Used by provider portal previews + admin demo lookups; **not** by the agent (agent uses tools directly).

### `POST /api/provider/accept`
- Body: `{ token: string }`.
- Verifies token, atomically updates `bookings.status='confirmed'`, sets `confirmed_at`.
- Emits `booking_confirmed` event → triggers Planner → Follow-up via `runtime.runWorkflow`.
- Returns `{ status, booking_id, slot_start, customer_name }` for the acceptance page UI.
- **No auth required** — token IS the auth.
- Rate-limit by IP to prevent brute force on the token.

### `POST /api/provider/reject`
- Same shape; sets status `rejected`. Customer notified via push.

### `POST /api/reminders/fire`
- Called by Supabase `pg_cron` via `pg_net.http_post`.
- Auth: `Authorization: Bearer <REMINDERS_FIRE_SECRET>` (constant-time compare).
- Body: `{ reminder_id, booking_id, kind }`.
- Loads reminder, dispatches via Follow-up agent (`mode='dispatch'` or `'check_completion'` or `'send_rating_prompt'` based on kind).
- Marks reminder `sent` on success, `failed` on error (pg_cron retries with `attempts < 5`).

### `POST /api/locations`, `PATCH /api/locations/[id]`, `DELETE /api/locations/[id]`
- Already specified in [03-auth-and-onboarding.md § 5 API](./03-auth-and-onboarding.md#5-location-onboarding-wizard).

### `POST /api/locations/geocode`
- Body: `{ text } | { lat, lng }`.
- Server-side proxy to `tools/geocode.ts` (keeps Google key server-only).

### `POST /api/push/subscribe`
- Body: standard web-push subscription JSON.
- Upserts by `endpoint`.
- Auth required.

### `POST /api/ratings`
- Body: `{ booking_id, stars, comment? }`.
- Customer-only; trigger recalculates provider `rating_avg`.
- Emits `rating_submitted` event (no agent run, just trace insert).

### `POST /api/providers/onboarding/*`
Multi-step provider onboarding endpoints:
- `POST /api/providers/start` — creates a draft provider for the signed-in user.
- `PATCH /api/providers/[id]` — saves wizard step data.
- `POST /api/providers/[id]/publish` — sets `published=true` after validation.

### `POST /api/providers/[id]/availability/check`
- For the slot picker UI: returns the next 7 days of available slots given `weekly_hours` + existing bookings.

---

## Acceptance for 08-api-routes

- [ ] Every route returns the documented shape; OpenAPI-like comments at the top of each file.
- [ ] Zod validation covers every body/query field.
- [ ] `POST /api/agent/run` SSE works in cURL: `curl -N -X POST ...`.
- [ ] `POST /api/provider/accept` is rate-limited and constant-time-token-compared.
- [ ] `POST /api/reminders/fire` rejects requests with wrong secret (401).
- [ ] All routes have a typed handler signature and a test covering 200 + 401/400.
