# SahuliatAI — Agentic AI for the Informal Economy

SahuliatAI helps anyone in Pakistan find, vet, and book informal-economy service providers (plumbers, AC techs, electricians, tutors, beauticians, mechanics, cooks, masons, painters, cleaners and more) through a multilingual conversational interface. The system is **agentic**: a planner reasons over each user request, a discovery agent pulls from a self-onboarded provider DB and Google Places, a ranking agent applies an 8-factor weighted score, a booking agent runs a two-phase invitation flow, a follow-up agent drives reminders + the service-quality timeline, and a dispute-resolution agent applies a deterministic refund / compensation policy when something goes wrong.

This is a hackathon submission for the **Google Antigravity / Gemini Hackathon — Challenge 2 (Informal Economy)**, dated May 2026.

---

## 1. Architecture

```
                        ┌────────────────────────────────────┐
                        │      Customer (mobile PWA / APK)   │
                        └────────────┬───────────────────────┘
                                     │  (HTTPS, Next.js)
                                     ▼
              ┌──────────────────────────────────────────────────┐
              │       Next.js 16 (App Router, Turbopack)         │
              │  • /chat conversational surface (Gemini tools)   │
              │  • /map     PostGIS + Google Maps                │
              │  • /booking realtime via Supabase                │
              │  • /api/*   agent + booking + dispute routes     │
              └──────────────────────────────────────────────────┘
                                     │
              ┌──────────────────────┼────────────────────────────┐
              │                      ▼                            │
              │      ┌────────────────────────────┐               │
              │      │   Antigravity workflow     │               │
              │      │   runtime (server-side)    │               │
              │      │                            │               │
              │      │  planner → intent →        │               │
              │      │  discovery → ranking →     │               │
              │      │  booking → followup        │               │
              │      │  + disputes (event-driven) │               │
              │      └─────────┬──────────────────┘               │
              │                ▼                                  │
              │    ┌────────────────────────┐                     │
              │    │  Gemini 2.5-flash      │  function calling   │
              │    │  (search/book tools)   │                     │
              │    └────────────────────────┘                     │
              │                                                   │
              │    Supabase Postgres (PostGIS, pg_cron, pg_net)   │
              │    Google Places (text + nearby search)           │
              │    Web Push (VAPID), WhatsApp/SMS (mockable)      │
              └───────────────────────────────────────────────────┘
```

Antigravity is used in two senses:
1. As the **IDE we designed and traced the agents in** — every step (planner / intent / discovery / ranking / booking / followup / disputes) writes a structured trace row to `agent_traces`. `/api/agent/trace?run_id=…` exposes it for review.
2. As the **conceptual framework** — discrete agents with typed I/O, deterministic plans for production paths, and LLM-mediated planning + summarization where genuine reasoning is needed.

---

## 2. Provider dataset schema

Two sources blend into a single provider candidate stream:

| Table / source       | Purpose                                                                 |
|----------------------|-------------------------------------------------------------------------|
| `providers`          | Self-onboarded, bookable. Has `hub_location` (PostGIS), `service_area`, `categories[]`, `languages[]`, `rating_avg`, `on_time_score`, `cancellation_rate`, `risk_score`, `specializations[]`, `capacity`, `base_visit_fee`, `base_hourly_rate`. |
| `providers.source = places_api` | Ghost rows created when we contact a Google Places business that hasn't onboarded yet. Tracks the outreach attempt.       |
| Google Places (live) | Discovered via `text:` and `nearby:` requests; not persisted unless contacted. |
| `bookings`           | `status` enum: `query_sent → invitation_sent → confirmed → en_route → arrived → in_progress → completed` plus `cancelled / rejected`. Holds `price_breakdown`, `complexity`, `service_checklist`, `service_photos`, `en_route_at`, `arrived_at`, `completed_at`.            |
| `disputes`           | `kind` enum (`no_show, quality, price, cancellation, overrun, damage`), `status` enum (`open, under_review, resolved, escalated`), with `statements jsonb` for both sides' submissions and `resolution jsonb` for the policy outcome. |

PostGIS RPCs: `search_providers_rpc`, `providers_in_bbox`, `st_distance_to_provider`, `count_recent_bookings_in_area`, `get_user_location_geo`, `check_availability_rpc`.

---

## 3. Matching factors

The ranking agent (`lib/antigravity/agents/ranking.ts`) computes a 100-point composite score per candidate:

| Factor                       | Max  | Notes                                                                 |
|------------------------------|------|-----------------------------------------------------------------------|
| Distance                     | 25   | Inverse of ground-distance; PostGIS `st_distance`.                    |
| Rating × recency decay       | 20   | 1.0 if reviewed ≤ 90 d ago, 0.85 ≤ 180 d, 0.65 ≤ 365 d, else 0.4.    |
| On-time score                | 15   | Provider's historical on-time vs late arrivals.                       |
| Availability (capacity-aware)| 10   | Penalises providers already booked in the requested slot.             |
| 1 − cancellation rate        | 10   | Recent cancellation rate over completed jobs.                         |
| Price fit                    | 10   | Distance from category median for the user's budget signal.           |
| Language match               | 5    | Provider speaks customer's preferred language (en / ur / pa / sd / ps).|
| Returning-customer affinity  | 5    | +5 if the customer booked this provider before.                       |
| Specialization bonus         | +5*  | Only when complexity ≥ intermediate AND provider lists that tag.      |

`*` Specialization adds on top of the 100, capped overall at 100. Every pick emits a per-factor breakdown into the trace.

---

## 4. Antigravity workflow

The runtime entry point is `runWorkflow({event, payload, userId, onStep})`. Events drive deterministic plans:

| Event                    | Plan                                          |
|--------------------------|-----------------------------------------------|
| `new_request`            | intent → discovery → ranking → await_user     |
| `slot_selected`          | booking (Phase A — invitation)                |
| `booking_confirmed`      | followup (enqueue pre-appointment + completion check) |
| `reminder_due`           | followup (dispatch)                           |
| `completion_check_due`   | followup (check_completion → enqueue rating)  |
| `rating_prompt_due`      | followup (send_rating_prompt)                 |
| `service_status_changed` | followup (dispatch_status_push)               |

The conversational surface (`/chat`) uses a different mode: Gemini function calling with three tools — `search_providers`, `book_appointment`, `contact_places_provider` — and lazy invocation of `compute_price` inside `book_appointment` to persist the price breakdown alongside the booking.

Disputes flow through a focused event chain: `POST /api/disputes` → `disputes.intake` → provider `PATCH` → `disputes.respond` → resolution persisted + reputation trigger applied.

---

## 5. APIs and tools

### Public HTTP routes
- `POST /api/agent/run` — conversational turn (returns reply + artifacts)
- `GET  /api/agent/trace?run_id=…` — full step-by-step trace JSON
- `POST /api/bookings/:id/rate` — submit a 1-5 rating
- `POST /api/disputes` — open a dispute (customer)
- `PATCH /api/disputes/:id` — provider response
- `POST /api/provider/accept|reject|update-status` — provider actions
- `POST /api/places/contact` — send a tokenised outreach to a Google Places business
- `GET  /api/providers/nearby?lat=…&lng=…&slug=…` — backs the map page
- `POST /api/reminders/fire` — drained by pg_cron

### Antigravity tools (server-only, called by agents)
- `supabase.search_providers`, `supabase.check_availability`, `supabase.create_booking`, `supabase.update_booking_status`, `supabase.enqueue_reminder`
- `google.places_nearby`, `google.places_text_search`
- `notify_provider` (WhatsApp / SMS / mock)
- `llm.confirmation_message`, `llm.plan` (Gemini)
- `compute_price` (visit fee + labour + distance + urgency / complexity / surge / loyalty)
- `generate_calendar_artifacts`, `generate_receipt`
- `web_push.send`

---

## 6. Assumptions

- **Demo mode** is the default. If WhatsApp Business / SMS credentials are missing, `notify_provider` returns `mock` and the UI explains that the invitation token would have been delivered. Tests still pass and provider acceptance still works (the URL is shown on screen).
- **Karachi-first.** Sample data and city defaults assume Karachi geometry; service area uses 10 km radius unless the provider sets a polygon.
- **Pakistani Rupees only.** All pricing is in PKR. The schema is currency-aware but the UI assumes PKR.
- **Mocked PII.** Seed data uses fake names and Pakistani phone formats only — no real PII is shipped.
- **Auth.** Supabase Auth handles email + password. `example.com` test addresses are rejected by Supabase Auth; use a real domain or the seeded admin accounts.
- **PWA / APK.** `public/.well-known/assetlinks.json` is served statically (Vercel CDN bypasses DDoS challenge); the PWABuilder TWA wraps the deployed PWA into the APK.

---

## 7. Cost & latency analysis

For a single conversational turn that produces a booking:

| Step                              | Tokens / units               | Wall time (p50)  |
|-----------------------------------|------------------------------|------------------|
| Gemini 2.5-flash (chat + tool decision) | ~600 input / ~250 output | ~1.4 s           |
| `supabase.search_providers_rpc`   | 1 SQL round-trip             | ~80 ms           |
| `google.places_nearby` (parallel) | 1 HTTP call                  | ~250 ms (cached) |
| `ranking.runRanking`              | pure compute                 | < 5 ms           |
| `supabase.create_booking` + trigger| 1 insert + 1 trigger        | ~60 ms           |
| `compute_price`                   | 2 RPCs                       | ~40 ms           |
| Push + calendar artifacts         | parallel                     | ~150 ms          |
| **Total (warm)**                  |                              | **~2.0 s**       |

Per-1000-bookings cost estimate (USD): ~$0.60 Gemini + ~$3 Places + ~$0.20 Supabase. Push and WhatsApp are sender-side and capped by the provider's plan.

---

## 8. Baseline comparison

| Approach                  | Time to book | Multilingual | Vets provider | Recovers from no-shows | Surge / urgency pricing |
|---------------------------|--------------|--------------|---------------|------------------------|-------------------------|
| Google search + manual call| 10-30 min    | manual       | no            | no                     | no                      |
| Marketplace app (lead-gen) | 3-8 min      | partial      | partial       | partial                | partial                 |
| **SahuliatAI agentic flow**| **~2 min**   | yes          | yes (8-factor)| yes (dispute agent)    | yes (compute_price)     |

The qualitative win is in (a) the chat surface absorbing Roman Urdu / Urdu / English with no language picker, (b) the 8-factor score being explainable per-pick in the trace, and (c) the dispute resolution agent applying policy in seconds rather than days.

---

## 9. Privacy note

- All PII (name, phone, address) is stored in Supabase under RLS — only the customer can read their own row, and only the involved provider can read the snapshot fields on the booking they accepted.
- Provider invitation links are tokenised (`nanoid(32)`) and expire in 15 minutes; the token never returns to the customer side.
- Gemini calls never receive raw phone numbers or addresses unless the customer explicitly types them into the chat. Location is sent as a `{lat, lng}` pair, not as the raw address text.
- Web push uses VAPID — no centralised push key is required.
- Service-quality photos uploaded by providers are stored in Supabase Storage with signed URLs only.
- Dispute statements are visible to the two parties and the agent only.

---

## 10. Limitations & next steps

- **Real WhatsApp / SMS delivery** requires a paid Twilio / Meta account; the codebase wires `notify_provider` to those APIs but falls back to mock when keys are missing.
- **Map clustering** isn't implemented — at >100 providers the map page would benefit from `supercluster`.
- **Provider availability** is computed from the bookings table; a richer rota / shift model would need a separate `provider_availability_slots` table.
- **No payments yet** — receipts are generated but no Stripe / EasyPaisa rail is connected. The `compute_price` breakdown is the source of truth.
- **The dispute agent is deterministic.** A future version would call an LLM to weigh the statements and choose between standard outcomes.
- **One language model.** The conversational agent assumes Gemini 2.5-flash. Provider name resolution is fragile when the user names a business not in our DB and not on Places.

---

## Running locally

The fastest path is the bundled setup script — it checks prereqs, creates `.env.local` from the template, runs `pnpm install`, generates VAPID keys, optionally links Supabase + pushes migrations + seeds, and prints the next steps:

```bash
cd product
bash scripts/setup.sh   # or: pnpm setup
```

You'll be prompted to fill `.env.local` with your Supabase / Gemini / Google Maps keys before it continues. After setup finishes:

```bash
pnpm dev                # http://localhost:3010
```

Prerequisites (the script verifies these): **Node ≥ 20**, **pnpm ≥ 9**, the **Supabase CLI**, and **psql** (for seed). Install Supabase CLI via `brew install supabase/tap/supabase`; install `psql` via `brew install libpq && brew link --force libpq`.

Re-running `scripts/setup.sh` is safe — every step skips if already done.

### Deployment by teammates (no owner login required)

**Recommended — Git-based auto-deploy.** Connect the GitHub repo to Vercel once (Vercel Dashboard → Project → Settings → Git). Every push to a branch produces a preview URL; merges to `main` go to production. Teammates need GitHub push access only — no Vercel login, no CLI, no token.

**Alternative — CLI deploy with a shared token.** Owner generates a scoped token at <https://vercel.com/account/tokens>, teammate pastes it into `.env.local` as `VERCEL_TOKEN=...`, then:

```bash
SKIP_DB_PUSH=1 pnpm deploy:preview
```

`SKIP_DB_PUSH=1` is recommended for teammates so only the owner pushes migrations. Run `pnpm db:verify` before deploying to catch schema drift early.

**Migrations** are owner-only by default. If a teammate's PR needs a new migration, they author the SQL file under `supabase/migrations/`, push the branch, and ping the owner to apply via `pnpm db:push`. Everyone else stays in read-only DB mode.

See `tech_plan/` for the per-feature implementation notes and `scope/` for the product brief.
