# SahuliatAI

> AI Service Orchestrator for the informal economy — Google Antigravity-powered multi-agent system that takes a natural-language service request in **English / Urdu / Roman Urdu**, discovers nearby providers, ranks them with explanations, and simulates an end-to-end **two-phase booking** with provider acceptance.

Built for **Google Hackathon Challenge 2 — AI Service Orchestrator for Informal Economy**.

---

## Live demo

- **Production URL:** _(set after `pnpm deploy:prod`)_
- **Demo accounts:** `ayesha@example.com` · `ali@example.com` · `tutor@example.com` (password `Demo!1234`)
- **Canonical query:** `Mujhe kal subah G-13 mein AC technician chahiye`

---

## Architecture

```
                              ┌─────────────────────────────┐
                              │     Customer PWA (Next.js)  │
                              │  · Multilingual chat        │
                              │  · Multi-location profile   │
                              │  · Live trace drawer        │
                              └─────────────┬───────────────┘
                                            │ SSE
                              ┌─────────────▼───────────────┐
                              │ /api/agent/run (route)      │
                              └─────────────┬───────────────┘
                                            │
                ┌───────────────────────────▼────────────────────────────┐
                │   Antigravity workflow runtime (lib/antigravity/*)     │
                │                                                         │
                │     PLANNER → INTENT → DISCOVERY → RANKING → await_user │
                │                                                ↓        │
                │                                              BOOKING    │
                │                                                ↓        │
                │   (after /provider/accept) → FOLLOW-UP ↺ pg_cron ↺      │
                └───────────────────────────┬────────────────────────────┘
                                            │ tool calls
                ┌───────────────────────────▼────────────────────────────┐
                │   Tools (13 registered): Google Places · Geocoding ·   │
                │   Distance Matrix · Supabase RPC · notify_provider     │
                │   (WhatsApp → SMS → mock chain) · web_push · receipt · │
                │   calendar artifacts · LLM (Antigravity / Gemini)      │
                └───────────────────────────┬────────────────────────────┘
                                            │
                ┌───────────────────────────▼────────────────────────────┐
                │   Supabase Postgres + RLS + PostGIS + pg_cron + pg_net │
                │   Tables: users_profile · user_locations · providers · │
                │   bookings · agent_traces · reminders · ratings ·      │
                │   mock_messages · push_subscriptions                   │
                └────────────────────────────────────────────────────────┘
```

Full diagram and design rationale: [`../scope/`](../scope/).

---

## How Antigravity is used

- **6 agents** in `lib/antigravity/agents/`: `planner`, `intent_parser`, `discovery`, `ranking`, `booking`, `followup`.
- **13 tools** in `lib/antigravity/tools/`: Google Places / Geocoding / Distance Matrix, Supabase RPC (search / availability / create_booking / update_status / enqueue_reminder), `notify_provider` (WhatsApp → SMS → mock chain), web_push, receipt, calendar artifacts, LLM confirmation messages.
- **Workflow runtime** (`lib/antigravity/runtime.ts`) orchestrates each event (`new_request`, `slot_selected`, `booking_confirmed`, `reminder_due`, etc.) into a Planner-decided agent chain.
- **Trace mirror** writes every step to `agent_traces` so the live trace drawer + the `/trace/<runId>` inspector + JSON export all share the same data.

**LLM runtime:** Gemini via `@google/generative-ai` SDK (`lib/antigravity/llm.ts`). Antigravity is the *IDE* used to design, iterate, and test the agents during development; the deployed runtime is plain Gemini. Agent prompts + tool definitions written in Antigravity are ported into `lib/antigravity/agents/`.

---

## APIs / tools used

| Surface | Service | Free-tier ok? |
|---|---|---|
| Agent design + iteration | **Google Antigravity IDE** (mandated platform) | yes |
| LLM runtime | Gemini via `@google/generative-ai` SDK | yes (free tier) |
| Database, auth, realtime, cron | Supabase | yes |
| Maps + Places + Geocoding + Distance Matrix | Google Maps Platform | yes (huge free credit) |
| Web push | VAPID + `web-push` | yes |
| Provider notification | WhatsApp Cloud API / Twilio SMS / **mock** | yes — mock path always works |
| Hosting | Vercel | yes (Hobby) |

---

## Data model

10 tables in `supabase/migrations/`:
- `users_profile`, `user_locations` (multi-location with PostGIS points)
- `providers` (with PostGIS hub_location + service_area polygon)
- `service_categories` (8 categories, bilingual + Roman Urdu keywords)
- `bookings` (with `invitation_token`, `invitation_channel`, exclusion constraint to prevent double-booking)
- `agent_traces` (full audit trail), `reminders` (queue drained by pg_cron), `ratings`, `mock_messages`, `push_subscriptions`

RLS enabled on all tables. See `supabase/migrations/20260518000005_rls.sql`.

---

## Local development

See [`SETUP.md`](./SETUP.md) for the full step-by-step guide.

Short version:

```bash
pnpm install
cp .env.example .env.local       # fill in keys per SETUP.md §3
pnpm db:link                      # link Supabase CLI
pnpm db:push                      # apply migrations
pnpm db:seed                      # categories + 30 providers
pnpm db:seed:auth                 # demo Auth users
pnpm dev
```

---

## Demo mode

Open two browser windows:
- **Window 1:** sign in as `ayesha@example.com` → `/chat` → ask: *"Mujhe kal subah G-13 mein AC technician chahiye"*.
- **Window 2:** sign in as `ali@example.com` → `/provider/dashboard`.

Tap **Book** in window 1. Watch the invitation appear in window 2 with a countdown. Tap **Accept** → window 1 flips to **Confirmed** with confetti + structured summary card + Add-to-Calendar buttons.

If WhatsApp/SMS aren't configured, the invitation lands in the `mock_messages` table and is surfaced in the customer's UI with a demo-mode card — the flow stays unbroken.

---

## Agent trace export

Every run is persisted to `agent_traces` keyed by `run_id`. To export a run as JSON:

```
GET /api/agent/trace?runId=<uuid>
```

Or visit `/trace/<runId>` for the human-readable inspector view.

---

## Assumptions

- Informal-economy providers in Pakistan operate via phone / WhatsApp / referrals. We mirror this with WhatsApp-based invitations and a tokenized accept page that works **without login**.
- Location matters more than time-of-day for matching. Hence multi-location user profiles + PostGIS proximity filtering.
- Roman Urdu is the most common chat dialect in the target audience. Hence first-class support alongside English and Urdu.

---

## Limitations & future work

- No real payments simulation (stretch).
- No identity verification (CNIC / business license) — phone OTP is mocked.
- No inbound WhatsApp parsing — outbound notifications only.
- Voice input (Web Speech API) was deliberately cut from MVP.
- Receipt PDF is rendered as an HTML view; full `@react-pdf/renderer` output is wired but rendered on demand (stretch hardening).

---

## Team & credits

Built for the **Google Hackathon** with Antigravity at the center of the orchestration. Scope + tech plan: see [`../scope/`](../scope/) and [`../tech_plan/`](../tech_plan/).
