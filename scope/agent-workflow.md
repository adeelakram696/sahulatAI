# Agent Workflow — Google Antigravity

This is the rubric's **highest-weighted area (25% + 20% = 45%)**. The design is opinionated and explicit so nothing is left to chance.

[← back to scope.md](./scope.md) · related: [technical-architecture.md](./technical-architecture.md) · [data-model.md](./data-model.md)

---

## Pipeline overview

```
        ┌──────────────────────────────────────┐
        │           PLANNER AGENT              │
        │  Decides the path:                   │
        │  - new request → full pipeline       │
        │  - clarification → re-run Intent     │
        │  - follow-up trigger → Follow-up only│
        └────────────────┬─────────────────────┘
                         │
       ┌─────────────────┼──────────────────────┬───────────────────┐
       ▼                 ▼                      ▼                   ▼
 ┌──────────┐     ┌──────────────┐      ┌────────────────┐   ┌─────────────┐
 │  INTENT  │ ──▶ │  DISCOVERY   │ ──▶  │  RANKING &     │──▶│  BOOKING    │
 │  PARSER  │     │              │      │  DECISION      │   │             │
 └──────────┘     └──────────────┘      └────────────────┘   └──────┬──────┘
  tools:           tools:                tools:               tools: │
  - llm.parse      - places.nearby       - distance_matrix   - supabase.rpc
  - translate      - supabase.search     - llm.score          - generate_receipt
                                          - llm.explain               │
                                                                      ▼
                                                              ┌──────────────┐
                                                              │  FOLLOW-UP   │
                                                              │  SCHEDULER   │
                                                              └──────────────┘
                                                              tools:
                                                              - scheduler.enqueue
                                                              - push.subscribe
```

Every arrow above is an Antigravity step. Every box is an Antigravity-registered agent. Every tool below is an Antigravity tool definition.

---

## Agents (detailed)

### 1. Planner Agent
- **Role:** Top-level orchestrator. Reads the incoming event and decides which downstream agents to invoke and in what order.
- **Model:** Gemini Flash (cheap, fast, structured-output JSON mode) via Antigravity. Falls back to a deterministic decision map if the LLM call errors (so the system stays useful even with LLM downtime).
- **Input schema:**
  ```ts
  {
    event: AppEvent,        // see Canonical Events table
    payload: any,           // event-specific payload
    run_id: string,
    user_id: string | null,
    context?: { previous_intent?: Intent, previous_runs?: RunSummary[] }
  }
  ```
- **Output schema:**
  ```ts
  {
    plan: AgentCall[],      // ordered, may include `await_user`
    reasoning: string,      // human-readable summary persisted to trace
    expected_artifacts: string[]  // e.g. ["recommendations", "summary_card"]
  }
  // where AgentCall = { agent: AgentName, input: any, depends_on?: string }
  ```
- **Decision rules (also used as the LLM-failure fallback map):**
  | Event | Plan |
  |---|---|
  | `new_request` | `[intent_parser, discovery, ranking, await_user]` |
  | `clarification_reply` | `[intent_parser(merged context), discovery, ranking, await_user]` |
  | `slot_selected` (user tapped Book) | `[booking_phase_a]` |
  | `booking_confirmed` (Phase B done) | `[followup(enqueue_pre_appointment)]` |
  | `invitation_expired` | `[discovery(exclude=[prev_provider]), ranking, await_user]` |
  | `reminder_due` | `[followup(dispatch)]` |
  | `completion_check_due` | `[followup(check_completion)]` |
  | `rating_prompt_due` | `[followup(send_rating_prompt)]` |
  | `rating_submitted` | `[]` (persist only; no further agents) |
- **Tools:** `llm.plan` (Gemini Flash structured output). Pure orchestration; no external API calls.
- **Failure handling:** On LLM error → use deterministic map above. On unknown event → log and abort.
- **Why exists:** Makes the agentic flow explicit and auditable — judges see *planning* as a first-class step. This alone covers a chunk of the "agentic reasoning" rubric.

### 2. Intent Parser Agent
- **Role:** Extract structured intent from free-form multilingual input.
- **Model:** Gemini 2.x via Antigravity LLM (direct `@google/generative-ai` only as gap-fallback). Two tool calls: `llm.translate_normalize` (Roman Urdu → English internal form) then `llm.parse_intent` (structured extraction).
- **Input schema:**
  ```ts
  {
    raw_text: string,
    locale: "en" | "ur" | "ur-Latn",
    selected_user_location: UserLocation,  // from chat surface (mandatory)
    prior_intent?: Intent                  // present on clarification_reply
  }
  ```
- **Output schema:**
  ```ts
  {
    service_slug: string,      // resolved against service_categories.slug
    service_confidence: 0..1,
    location: {
      text: string,
      point: { lat, lng },     // resolved
      source: "user_location" | "user_mentioned" | "ambiguous",
      confidence: 0..1
    },
    time: { iso: string, original_phrase: string, confidence: 0..1 },
    urgency: "now" | "today" | "tomorrow" | "this_week",
    notes: string,             // anything else (e.g. "AC me gas chahiye" → notes: "gas refill")
    needs_clarification?: { field: string, question_en: string, question_ur: string }
  }
  ```
- **Service category resolution:** the LLM emits a free-form service phrase. We then resolve it to a `service_categories.slug` by (a) exact match against `keywords[]`, (b) embedding-distance fallback (Gemini embedding) for fuzzy matches. If no slug clears 0.6 similarity → `needs_clarification` with the field `service`.
- **Location resolution priority:** if user explicitly mentions an area (e.g. "G-13"), geocode that. If user mentions nothing → default to `selected_user_location.point` (`source: "user_location"`). If user mentions an area *different* from the selected location → `source: "ambiguous"`, ask for confirmation.
- **Time resolution:** all relative phrases ("kal subah", "tomorrow morning") resolved to absolute ISO using `Asia/Karachi` timezone (derived from `user_location.country_code`; default Pakistan).
- **Failure handling:** if any field's confidence < 0.6 → return `needs_clarification` and Planner short-circuits to "ask the user" with a bilingual follow-up.
- **Tools:** `llm.translate_normalize`, `llm.parse_intent`, `llm.embed` (for category fuzzy match), `google.geocode` (when user mentions a different area).

### 3. Discovery Agent
- **Role:** Find candidate providers serving the intent's location.
- **Input schema:** `{ intent: Intent, exclude_provider_ids?: string[] }` (`exclude` used when a prior invitation expired).
- **Tools called:**
  - `supabase.search_providers({ service_slug, point, radius_km })` — PostGIS `ST_DWithin` and `categories @> ARRAY[slug]`, additionally checks the candidate's `service_area` polygon (`ST_Contains`) OR `service_radius_km` from `hub_location`.
  - `google.places_nearby({ category, location, radius })` — server-side Places API (New) Nearby Search.
  - `google.place_details({ place_id })` — only for top N candidates after dedup, to enrich rating/photo/hours.
- **Adaptive radius:** start 5 km → 10 km → 20 km. Stop when candidate count ≥ 5 or total ≥ 15. Records the final radius used in trace.
- **Dedup logic (DB vs Places):** treat as duplicate if normalized-name Jaro–Winkler distance < 0.2 AND geo distance < 100 m. **DB record wins** (carries our verification flag + price band + opt-in channels).
- **Output:**
  ```ts
  {
    candidates: Provider[],   // ≤ 15, deduped, in arrival order (not yet ranked)
    radius_used_km: number,
    sources_breakdown: { db: number, places_only: number, duplicates_merged: number }
  }
  ```
- **Empty result handling:** if `candidates.length === 0` after max radius, agent returns `{ candidates: [], reason: "no_match" }`. Ranking then short-circuits to a "no providers found" recommendation card with a "broaden category" CTA.

### 4. Ranking & Decision Agent
- **Role:** Score and select top 3 providers, emit *human-readable reasoning* per pick.
- **Input schema:** `{ candidates: Provider[], intent: Intent, user_location: UserLocation }`.
- **Tools called:** `google.distance_matrix`, `supabase.check_availability`, `llm.score`, `llm.explain_bilingual`.
- **Availability check:** for each candidate, query `bookings` where `provider_id = ? AND status IN ('invitation_sent','confirmed','reminded') AND tstzrange(slot_start, slot_end) && tstzrange(intent.time, intent.time + duration)`. Combine with `providers.weekly_hours` and `blackout_dates`. Returns `{ available: bool, next_available: timestamp | null }`.
- **Composite score (0–100):**
  - 35 × distance (Distance Matrix; closer = higher; 0 km → 35, ≥ 15 km → 0)
  - 25 × rating (normalized 1–5; if no ratings yet → 12.5 neutral)
  - 20 × availability (1.0 if `available=true` for requested time, 0.5 if `next_available` within 24 h, 0 otherwise)
  - 10 × price-fit (if user didn't state preference → 5 neutral; else compare against provider's `price_band`)
  - 10 × language match (1.0 if provider's `languages[]` overlaps user's `preferred_locale`'s language family, else 0.5)
- **Low-confidence threshold:** if top score < 40 → return `{ top: [], low_confidence: true }`; UI shows "We didn't find a strong match — want to broaden your search?".
- **Reasoning emission:** For each of the top 3, the agent produces 1 sentence in English + 1 in Urdu explaining the pick. Persisted on the trace.
- **Output:**
  ```ts
  {
    top: RankedProvider[],          // up to 3
    all_scored: ScoredProvider[],   // full list for trace inspection
    low_confidence: boolean,
    distance_used: "google_distance_matrix" | "haversine_fallback"
  }
  ```
- **Why bilingual:** Demonstrates the multilingual claim on the rubric without needing UI work.

### 5. Booking Agent
- **Role:** Simulate the booking end-to-end, including the **two-phase invitation flow** (per [requirements-review.md § Round 2 — new workflow](./requirements-review.md#round-2--new-workflow-per-teams-product-call)).
- **Phase A — create the invitation (always synchronous, in this agent run):**
  - `supabase.create_booking({ provider_id, customer_user_id, customer_user_location_id, slot, run_id })` → returns `booking_id` with `status='invitation_sent'` and a fresh `invitation_token`.
  - `notify_provider({ booking_id })` → **strategy-pattern tool** that tries in order:
    1. Realtime channel (`provider_dashboard:<provider_id>`) if a provider session is connected,
    2. WhatsApp Cloud API (`whatsapp.send_template`) if provider opted in,
    3. Twilio SMS (`sms.send`) if SMS opted in,
    4. **Mock fallback**: insert `mock_messages` row + emit a UI badge event so the trace tells the same story even without external credentials.
    The tool returns which channel was used → persisted to `bookings.invitation_channel`.
  - `generate_receipt({ booking_id })` → renders PDF (server-side via `@react-pdf/renderer`, free, MIT) — pre-generated so the customer can preview while waiting for acceptance.
  - `generate_confirmation_message({ booking_id, locale })` → LLM tool producing a short bilingual chat message *(phrased for an unconfirmed booking: "Invitation sent to Ali AC Services — we'll let you know as soon as they accept.")*
  - `generate_calendar_artifacts({ booking_id })` → produces an `.ics` blob *and* a Google Calendar deep-link URL (no API auth — uses public `https://calendar.google.com/calendar/render?action=TEMPLATE&...`).
  - `push.send_invitation_pending({ subscription, booking })`

- **Phase B — provider acceptance (separate request, NOT part of this agent run):**
  - Triggered by provider tapping the invitation link or hitting Accept in the dashboard.
  - Handled by `/provider/accept/[token]` server action: updates `bookings.status = 'confirmed'`, `confirmed_at = now()`.
  - Fires `push.send_confirmation({ subscription, booking })` to the customer.
  - Planner agent listens for `booking_confirmed` events and re-runs the Follow-up agent to enqueue the pre-appointment reminder.
  - If no acceptance within the configured window (default 15 min, capped at slot_start), the booking auto-`rejected` and the customer is notified to pick another provider.
- **Artifacts emitted (all visible to the user):**
  - **Invitation-pending message** — bilingual chat bubble after Phase A. *"Invitation sent to Ali AC Services. Sending via WhatsApp · Awaiting acceptance…"*
  - **Confirmation message** — emitted from Phase B when provider accepts. *"Confirmed! Ali AC Services will arrive at Home (G-13) tomorrow at 10:00 AM."*
  - **Structured summary card** — matches the exact format from the brief's example output (Service Request / Location / Time / Provider / Reasoning / Booking / Follow-up). Rendered below the confirmation message.
  - **Receipt PDF** — generated immediately in Phase A; downloadable from the booking screen.
  - **Calendar artifacts** — `.ics` download button + "Add to Google Calendar" deep link.
  - **Push notifications** — invitation-pending (immediate), confirmed (Phase B), pre-appointment reminder (1 hr before).
- **State changes (Phase A):**
  - `bookings` row inserted with `status = 'invitation_sent'`, `invitation_token`, `invitation_channel`, `invitation_sent_at`.
  - `mock_messages` row written if mock path used.
  - `agent_traces` row for Phase A finalized.
- **State changes (Phase B, separate request):**
  - `bookings.status = 'confirmed'`, `confirmed_at` set.
  - `providers.recent_bookings_count` incremented.
  - `reminders` row enqueued for `slot_start - 1h`.
- **Idempotency:** If the same `run_id` + `slot` is replayed, return existing `booking_id`. Acceptance endpoint is idempotent on `invitation_token`.
- **`slot_end` derivation:** `slot_start + COALESCE(provider.avg_duration, '1 hour')`. Used everywhere (availability check, calendar, completion check).
- **`invitation_token` format:** 32-byte URL-safe random string (not a JWT) — short, single-use, stored hashed in `bookings.invitation_token`.
- **Concurrency:** `bookings` uses a PostgreSQL Exclusion Constraint on `(provider_id WITH =, tstzrange(slot_start, slot_end) WITH &&) WHERE status IN ('invitation_sent','confirmed','reminded','in_progress')` (requires `btree_gist` extension). Race condition → `INSERT` fails → Booking agent retries with next-available slot from Ranking's `next_available` field; if none available, returns slot-conflict error and the UI reopens the slot picker.

### 6. Follow-up Agent
- **Role:** Schedule and dispatch all post-confirmation interactions: pre-appointment reminder, completion check, rating prompt.
- **Trigger model:** **event-driven**, never directly time-driven. The Planner routes events to this agent. The actual clock comes from `supabase.pg_cron`, which scans `reminders.due_at <= now()` once a minute, POSTs to `/api/reminders/fire`, which dispatches `reminder_due` (or `completion_check_due` / `rating_prompt_due`) events into the Planner → this agent.
- **Input schema:**
  ```ts
  {
    mode: "enqueue_pre_appointment"   // after booking_confirmed
        | "dispatch"                  // when a reminder fires
        | "check_completion"          // when completion window opens
        | "send_rating_prompt",       // 1 h after slot_end
    booking_id: string
  }
  ```
- **Behavior per mode:**
  - **`enqueue_pre_appointment`** (after `booking_confirmed`):
    - `supabase.enqueue_reminder({ booking_id, kind: 'pre_appointment', due_at: slot_start - 1h })`
    - `supabase.enqueue_reminder({ booking_id, kind: 'completion_check', due_at: slot_end })`
    - No external notifications yet.
  - **`dispatch`** (when `pre_appointment` reminder fires):
    - Web push to customer: *"AC tech Ali arriving in 1 hour"*.
    - WhatsApp/SMS to customer if opted in (uses same strategy chain as `notify_provider`, with mock fallback).
    - Push to provider as well: *"Reminder: AC repair at G-13 in 1 hour"*.
    - `supabase.update_booking_status(booking_id, 'reminded')`.
  - **`check_completion`** (at `slot_end`):
    - For hackathon scope: auto-transition `confirmed → in_progress → completed` after slot_end (no real provider input required).
    - `supabase.enqueue_reminder({ booking_id, kind: 'rating_prompt', due_at: slot_end + 1h })`.
  - **`send_rating_prompt`**:
    - Web push: *"How was your service with Ali AC Services?"* → opens rating modal in the app.
    - `supabase.update_booking_status(booking_id, 'completed')`.
- **Output:**
  ```ts
  {
    enqueued: ReminderRef[],
    notifications_sent: NotificationRef[]
  }
  ```
- **Tools:** `supabase.enqueue_reminder`, `supabase.update_booking_status`, `web_push.send`, `whatsapp.send_template`, `sms.send`.
- **Failure handling:** if a notification fails, mark the reminder `failed` with retry counter; pg_cron retries up to 5 times then alerts.

---

## Tool registry (single source of truth)

Every external action goes through an Antigravity-registered tool. The implementation plan should generate one TypeScript module per row in `lib/antigravity/tools/`.

| Tool | Module | Used by | Signature (abbrev.) | External dep |
|---|---|---|---|---|
| `llm.plan` | `llm.ts` | Planner | `(event) → Plan` | Gemini Flash |
| `llm.translate_normalize` | `llm.ts` | Intent | `(text, locale) → normalized` | Gemini |
| `llm.parse_intent` | `llm.ts` | Intent | `(text, ctx) → Intent` | Gemini |
| `llm.embed` | `llm.ts` | Intent | `(text) → number[]` | Gemini embed |
| `llm.score` | `llm.ts` | Ranking | `(candidates, intent) → Score[]` | Gemini |
| `llm.explain_bilingual` | `llm.ts` | Ranking | `(pick) → { en, ur }` | Gemini |
| `llm.confirmation_message` | `llm.ts` | Booking | `(booking, locale) → { en, ur }` | Gemini |
| `google.places_nearby` | `places.ts` | Discovery | `(category, point, radius) → Place[]` | Places API (New) |
| `google.place_details` | `places.ts` | Discovery | `(place_id) → PlaceDetails` | Places API (New) |
| `google.geocode` | `geocode.ts` | Intent, Onboarding, Locations | `(text \| coords) → resolved` | Geocoding API |
| `google.distance_matrix` | `distance-matrix.ts` | Ranking | `(origin, dests) → Distance[]` | Distance Matrix API |
| `supabase.search_providers` | `supabase-rpc.ts` | Discovery | `(slug, point, radius) → Provider[]` | Postgres + PostGIS |
| `supabase.check_availability` | `supabase-rpc.ts` | Ranking | `(provider_id, slot) → Availability` | Postgres |
| `supabase.create_booking` | `supabase-rpc.ts` | Booking | `(args) → BookingRef` | Postgres |
| `supabase.update_booking_status` | `supabase-rpc.ts` | Booking, Follow-up | `(id, status) → void` | Postgres |
| `supabase.enqueue_reminder` | `supabase-rpc.ts` | Follow-up | `(booking_id, kind, due_at) → ReminderRef` | Postgres |
| `notify_provider` | `notify-provider.ts` | Booking | `(booking_id) → { channel }` | Strategy chain ↓ |
| `whatsapp.send_template` | `whatsapp.ts` | notify_provider, Follow-up | `(phone, template, vars) → MessageRef` | WhatsApp Cloud API (free tier) |
| `sms.send` | `sms.ts` | notify_provider, Follow-up | `(phone, body) → MessageRef` | Twilio (trial credit) |
| `web_push.send` | `push.ts` | Booking, Follow-up | `(subscription, payload) → void` | VAPID web-push |
| `generate_receipt` | `receipt.ts` | Booking | `(booking_id) → URL` | `@react-pdf/renderer` |
| `generate_calendar_artifacts` | `calendar.ts` | Booking | `(booking_id) → { ics_url, gcal_url }` | None (deep link + .ics) |
| `mock.write_message` | `notify-provider.ts` | notify_provider fallback | `(booking_id, channel, body) → MockMessageRef` | None |

---

## Canonical events

Events drive the Planner. New events should be added here as the system grows.

| Event | Emitted by | Carries | Planner response |
|---|---|---|---|
| `new_request` | `/api/agent/run` POST | `{ raw_text, locale, selected_user_location }` | `[intent, discovery, ranking, await_user]` |
| `clarification_reply` | `/api/agent/run` continuation | `{ reply_text, prior_intent }` | `[intent(merge), discovery, ranking, await_user]` |
| `slot_selected` | UI: user tapped Book | `{ provider_id, slot_start, contact }` | `[booking_phase_a]` |
| `booking_invitation_sent` | Booking agent (Phase A end) | `{ booking_id, channel }` | (no-op; persisted) |
| `booking_confirmed` | `/api/provider/accept` | `{ booking_id }` | `[followup(enqueue_pre_appointment)]` |
| `invitation_expired` | pg_cron sweep on `bookings` | `{ booking_id, prior_provider_id, run_id }` | `[discovery(exclude=[prev]), ranking, await_user]` |
| `reminder_due` | `/api/reminders/fire` | `{ booking_id, reminder_kind }` | `[followup(dispatch)]` |
| `completion_check_due` | pg_cron / reminder fire | `{ booking_id }` | `[followup(check_completion)]` |
| `rating_prompt_due` | pg_cron / reminder fire | `{ booking_id }` | `[followup(send_rating_prompt)]` |
| `rating_submitted` | UI: rating modal submit | `{ booking_id, stars, comment }` | (no-op; persisted + reputation recalculated by trigger) |

---

## Updated pipeline overview

```
                                 ┌───────────────────────────────────────┐
                                 │              PLANNER                  │
                                 │   reads event + decides plan          │
                                 │   (Gemini Flash with deterministic    │
                                 │    fallback map)                      │
                                 └────┬────────────┬──────────────┬──────┘
   new_request / clarification        │            │              │  booking_confirmed
       /  invitation_expired          │            │              │  reminder_due
                                      ▼            ▼              ▼
                              ┌──────────┐    ┌──────────┐   ┌──────────┐
                              │ INTENT   │ →  │DISCOVERY │ → │ RANKING  │ → await_user
                              └──────────┘    └──────────┘   └──────────┘
                                                                  │
                                                  user taps Book  ▼
                                                        ┌──────────────────────┐
                                                        │  BOOKING — Phase A   │
                                                        │  create row · notify │
                                                        │  PDF · calendar      │
                                                        └──────────┬───────────┘
                                                                   │
                                                  WA/SMS/dashboard/mock invitation
                                                                   ▼
                                                        ┌──────────────────────┐
                                                        │ /provider/accept     │
                                                        │  → status=confirmed  │
                                                        │  → emit              │
                                                        │    booking_confirmed │
                                                        └──────────┬───────────┘
                                                                   │
                                                                   ▼
                              ┌────────────────────────────────────────────────┐
                              │   pg_cron (Supabase, free)                     │
                              │   every minute drains `reminders` →            │
                              │   pg_net.http_post → /api/reminders/fire →     │
                              │   emits reminder_due / completion / rating     │
                              └────────────────────────────┬───────────────────┘
                                                           │
                                                           ▼
                                                   ┌──────────────┐
                                                   │  FOLLOW-UP   │
                                                   │  event-driven│
                                                   └──────────────┘
```

---

## Trace persistence

Every agent invocation writes to `agent_traces`:

```sql
agent_traces (
  id uuid pk,
  run_id uuid,                 -- groups all steps of one run
  parent_step_id uuid null,    -- for nested tool calls
  agent_name text,             -- "planner" | "intent_parser" | ...
  step_index int,
  started_at timestamptz,
  ended_at timestamptz,
  inputs jsonb,
  outputs jsonb,
  tool_calls jsonb,            -- [{ tool, args, result, latency_ms }]
  reasoning text,              -- human-readable summary
  status text,                 -- "ok" | "error" | "needs_input"
  error jsonb null
)
```

This table powers:
1. **Live trace drawer** — server streams new rows via Supabase Realtime.
2. **Trace replay** — `/trace/[runId]` reads the full set and animates them.
3. **Judge export** — `GET /api/agent/trace?runId=...&format=json` for the deliverable.

---

## Example trace (the brief's canonical query)

**Input:** `"Mujhe kal subah G-13 mein AC technician chahiye"` · `selected_user_location = "Home (G-13)"`

```
── Run 1 (event = new_request) ──────────────────────────────────────────
Step 1  planner             → plan: [intent_parser, discovery, ranking, await_user]
Step 2  intent_parser
   2.1  llm.translate_normalize ("Mujhe kal subah…") → "I need an AC technician tomorrow morning"
   2.2  llm.parse_intent                              → { service_slug: "ac_repair", time: "2026-05-18T09:00+05:00", source: "user_mentioned (G-13)" }
Step 3  discovery
   3.1  supabase.search_providers  → 4 DB candidates within 5 km of G-13
   3.2  google.places_nearby       → 6 Place results
   3.3  dedup                       → 7 unique candidates (3 merged, DB wins)
   3.4  google.place_details(top4) → enrich rating/hours
Step 4  ranking
   4.1  google.distance_matrix       → distances for all 7
   4.2  supabase.check_availability  → 5 of 7 free at the requested slot
   4.3  llm.score                    → top: Ali AC Services (87/100)
   4.4  llm.explain_bilingual        → reason_en: "Closest available provider with ★4.7 and 10 AM slot open." · reason_ur: "..."
Step 5  await_user (booking deferred)

── Run 2 (event = slot_selected, user tapped Book 10:00 AM) ─────────────
Step 6  planner             → plan: [booking_phase_a]
Step 7  booking (Phase A)
   7.1  supabase.create_booking          → bk_a1b2 (status=invitation_sent, token=tk_x9y…)
   7.2  notify_provider                  → channel=whatsapp (or mock_message if no creds)
   7.3  generate_receipt                 → /receipts/bk_a1b2.pdf
   7.4  generate_calendar_artifacts      → { ics_url, gcal_url }
   7.5  llm.confirmation_message(pending)→ chat bubble emitted
   7.6  web_push.send (invitation_pending)
        → emits booking_invitation_sent

── Out-of-band (provider taps WhatsApp link, hits /provider/accept/tk_x9y) ──
   server action: bookings.status = 'confirmed', confirmed_at=now()
   web_push.send(customer) "Confirmed by Ali AC Services"
   → emits booking_confirmed

── Run 3 (event = booking_confirmed) ────────────────────────────────────
Step 8  planner             → plan: [followup(enqueue_pre_appointment)]
Step 9  followup
   9.1  supabase.enqueue_reminder(pre_appointment, slot-1h)
   9.2  supabase.enqueue_reminder(completion_check, slot_end)
        → 2 reminders queued

── Run 4 (event = reminder_due, 1h before slot) ─────────────────────────
   pg_cron drains reminders → http_post /api/reminders/fire
Step 10 planner             → plan: [followup(dispatch)]
Step 11 followup
   11.1 web_push.send(customer) "Ali arriving in 1 hour"
   11.2 supabase.update_booking_status → "reminded"
```

Four logical runs, all joined by the same `run_id` for the trace UI. The drawer shows each run as a collapsible section.

---

## Antigravity-specific implementation notes

> **Action item before Hour 0:** Have one team member read the latest Antigravity docs and write a *5-line* "how to register an agent and a tool" example. Confirm the SDK shape before we wire `lib/antigravity/client.ts`. This is the only piece of the stack the team likely hasn't used before — de-risk it first.

What we expect from Antigravity:
- **Agent definitions** (system prompt + tool list + model binding).
- **Workflow definitions** that chain agents with conditionals.
- **Tool definitions** with JSON schema → automatically callable by any agent.
- **Tracing** built-in; we mirror it to Supabase for our UI.
- **Streaming** of intermediate events so the UI feels live.

If a feature is missing on Antigravity, we wrap our own thin shim in `lib/antigravity/` so the contract stays clean.

---

## Why this design hits the rubric

| Criterion | Hit |
|---|---|
| Multi-step reasoning | 6 agents + planner across **multiple runs** joined by `run_id`. Trace drawer shows the full graph. |
| Tool integration | 22 Antigravity-registered tools spanning Maps (4 APIs), Supabase RPC, web push, WhatsApp/SMS strategy chain, PDF + calendar generation. |
| Decision transparency | Composite 5-factor score, bilingual reasoning per pick, low-confidence fallback, dedup breakdown surfaced in trace. |
| End-to-end simulation | Two-phase invitation flow with real DB state transitions, PDF receipt, calendar artifacts (.ics + GCal deep link), multi-channel provider notification with mock fallback, pg_cron-driven reminders. |
| Agent autonomy | Planner reroutes on clarification, on invitation expiry, on reminder fire — no user input required between runs. |
| Traceability | Every step (incl. tool args + results + latency) persisted to `agent_traces`; live UI drawer + replay page + JSON export. |
