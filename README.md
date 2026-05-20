# SahuliatAI — Agentic AI for the Informal Economy

> A multilingual, agent-driven assistant that helps anyone in Pakistan **find, vet, book, and follow up with** informal-economy service providers — plumbers, AC technicians, electricians, tutors, beauticians, mechanics, cooks, masons, painters, cleaners, and more.

*Hackathon submission for the **Google Antigravity / Gemini Hackathon — Challenge 2 (Informal Economy)**, May 2026.*

---

## Table of Contents

1. [Overview](#1-overview)
2. [Key Features](#2-key-features)
3. [Technology Stack](#3-technology-stack)
4. [System Architecture](#4-system-architecture)
5. [Agents Developed](#5-agents-developed)
6. [The Antigravity Workflow & Event Model](#6-the-antigravity-workflow--event-model)
7. [Provider Data Model](#7-provider-data-model)
8. [Matching & Ranking Algorithm](#8-matching--ranking-algorithm)
9. [APIs, Tools & Integrations](#9-apis-tools--integrations)
10. [Cost & Latency Analysis](#10-cost--latency-analysis)
11. [Baseline Comparison](#11-baseline-comparison)
12. [Security & Privacy](#12-security--privacy)
13. [Assumptions](#13-assumptions)
14. [Limitations & Roadmap](#14-limitations--roadmap)
15. [Running Locally](#15-running-locally)

---

## 1. Overview

### The problem

Pakistan's informal economy — the plumbers, electricians, tutors, and tradespeople who keep households running — has no trustworthy digital front door. Hiring one today means searching Google, calling a string of unverified numbers, haggling with no pricing reference, and having **zero recourse** when a worker no-shows, overcharges, or does poor work. The friction is worst for the people least served by English-first marketplace apps: customers who think and type in Urdu or Roman Urdu.

### The solution

SahuliatAI replaces that experience with a single **conversational interface** that a customer can talk to in English, Urdu, or Roman Urdu — with no language picker and no rigid forms. Behind the chat surface sits a coordinated team of **purpose-built AI agents** that together carry a request from a vague sentence ("AC theek karwana hai kal subah") all the way to a confirmed, priced, calendar-ready booking — typically in **under two minutes**.

The product is delivered as an installable **mobile Progressive Web App (PWA)**, also packaged as an Android **APK**, so it works on the low-end devices that dominate the target market.

### What makes it *agentic*

SahuliatAI is not a chatbot with a database query bolted on. Each stage of the journey is owned by a **discrete agent with typed inputs and outputs**:

- A **conversation agent** interprets the customer and decides, turn by turn, which tools to call.
- A **discovery agent** sources candidates from both a curated provider database and the live Google Places API.
- A **ranking agent** scores every candidate on an explainable **8-factor, 100-point model**.
- A **booking agent** runs a two-phase, token-secured provider invitation flow.
- A **follow-up agent** drives reminders, live status updates, and post-service rating prompts.
- A **dispute-resolution agent** applies a deterministic refund/compensation policy when a job goes wrong.

Every agent step writes a **structured trace row**, so every recommendation, price, and decision is fully auditable after the fact — a recommendation can always be explained, never just asserted.

---

## 2. Key Features

| Capability | Description |
|------------|-------------|
| **Multilingual conversational booking** | Natural-language chat that absorbs English, Urdu, and Roman Urdu with no language selector. |
| **Hybrid provider discovery** | Blends a self-onboarded, bookable provider database with live Google Places results in one ranked stream. |
| **Explainable 8-factor matching** | Every recommendation carries a per-factor score breakdown — distance, rating, reliability, price fit, language, and more. |
| **Two-phase booking** | The customer picks a slot; the provider confirms via a secure, expiring invitation link — no provider account required to accept. |
| **Dynamic pricing** | `compute_price` builds a transparent breakdown from visit fee, labour, distance, urgency, complexity, surge, and loyalty. |
| **Live service timeline** | Realtime booking status (`en route → arrived → in progress → completed`) pushed to the customer via Supabase Realtime + Web Push. |
| **Automated follow-up** | Pre-appointment reminders and post-service rating prompts scheduled with Supabase `pg_cron`. |
| **Dispute resolution** | A dedicated agent classifies the issue and applies a deterministic refund/compensation/blacklist policy in seconds. |
| **Dual ratings** | Providers carry both a **Google Places rating** and a **portal rating** built from SahuliatAI's own verified post-booking reviews. |
| **Full agent traceability** | Every workflow run is recorded step-by-step in `agent_traces` and exposed for review. |

---

## 3. Technology Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, Turbopack), React 19, TypeScript 5 |
| **Styling / UI** | Tailwind CSS, Framer Motion, Radix-style primitives, Lucide / Tabler icons |
| **AI / LLM** | Google **Gemini 2.5-flash** — native function calling + structured output |
| **Database** | Supabase **PostgreSQL** with **PostGIS** (geospatial), `pg_cron` (scheduling), `pg_net` (outbound HTTP) |
| **Auth** | Supabase Auth (email + password, row-level security) |
| **Realtime** | Supabase Realtime channels (live booking status) |
| **Storage** | Supabase Storage (provider service photos, signed URLs) |
| **Maps & location** | Google **Places API**, Google **Maps JavaScript API** (`@vis.gl/react-google-maps`) |
| **Notifications** | Web Push (VAPID); WhatsApp Business / SMS (mockable, Twilio/Meta-ready) |
| **State / data fetching** | TanStack Query, Zustand |
| **Validation** | Zod schemas shared between agents, tools, and API routes |
| **Hosting** | Vercel (PWA + APK via PWABuilder TWA wrapper) |

---

## 4. System Architecture

SahuliatAI follows a **server-orchestrated agent architecture**. The browser is a thin client; all reasoning, tool execution, and data access happen server-side inside Next.js route handlers and the workflow runtime — keeping API keys, provider PII, and business logic off the device.

```
                        ┌────────────────────────────────────┐
                        │      Customer (mobile PWA / APK)   │
                        └────────────┬───────────────────────┘
                                     │  (HTTPS, Next.js)
                                     ▼
              ┌──────────────────────────────────────────────────┐
              │       Next.js 16 (App Router, Turbopack)         │
              │  • /chat    conversational surface (Gemini tools)│
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

### Request lifecycle

A typical "book a service" journey flows through the system as follows:

1. **Customer message** → the `/chat` surface posts the turn to `POST /api/agent/run`.
2. The **conversation agent** (Gemini with function calling) interprets the message against the conversation history and decides whether to answer directly or invoke a tool.
3. If a search is needed, it calls into the **discovery agent**, which queries the `providers` table via PostGIS RPCs and, in parallel, the Google Places API.
4. The **ranking agent** scores the merged candidate set and returns the top picks as **UI artifacts** (provider cards) alongside a natural-language reply.
5. The customer selects a slot; the **booking agent** creates the booking, computes the price, and dispatches a **tokenised invitation** to the provider.
6. On provider acceptance, the **follow-up agent** schedules reminders and a completion check; status changes stream back to the customer in realtime.
7. If something goes wrong, `POST /api/disputes` hands off to the **dispute-resolution agent**.

Every one of these steps emits a structured trace row to `agent_traces`, retrievable via `GET /api/agent/trace?run_id=…`.

### Why "Antigravity"?

The name carries two meanings in this project:

1. **The IDE.** The agents were designed, instrumented, and traced inside Google Antigravity. Every workflow step writes a structured trace row, which mirrors the agent-tracing model the IDE encourages.
2. **The architectural philosophy.** Discrete agents with typed I/O, **deterministic plans** for production-critical paths, and **LLM-mediated reasoning** reserved for the places that genuinely need judgment (intent parsing, conversation, summarization). This keeps the system predictable and debuggable while still feeling intelligent.

---

## 5. Agents Developed

All agents live in `lib/antigravity/agents/`, expose typed inputs/outputs, and persist a structured trace row per step.

| Agent | File | Responsibility |
|-------|------|----------------|
| **Planner** | `planner.ts` | Maps an incoming `AppEvent` to a **deterministic plan** — an ordered list of agent calls. Uses no LLM; the plan *is* the contract, which keeps production paths reproducible. |
| **Intent Parser** | `intent-parser.ts` | Extracts the structured **intent** (service category, location, time window, complexity) from free-form multilingual text. LLM-primary via Gemini structured output, with a Roman-Urdu / Urdu / English keyword and lookup-table **fallback** so the system still works without an API key. |
| **Discovery** | `discovery.ts` | Sources candidate providers from two channels: the seeded `providers` table (PostGIS proximity search with an **adaptive 5 → 20 km radius**) and the **live Google Places** Nearby Search. Deduplicates the merged set (database row wins) and caps it at 15 candidates. |
| **Ranking** | `ranking.ts` | Scores every candidate on the **8-factor, 100-point composite model** with rating-recency decay and a complexity-aware specialization bonus. Emits a per-pick factor breakdown into the trace so each recommendation is explainable. |
| **Booking** | `booking.ts` | Runs **Phase A** of the two-phase booking: creates the booking row, sends the provider a **tokenised invitation** via `notify_provider`, and generates the receipt + calendar artifacts. Phase B (provider acceptance) is handled by the `/api/provider/accept` route. |
| **Follow-up** | `followup.ts` | Drives the post-booking lifecycle across five modes — `enqueue_pre_appointment`, `dispatch`, `check_completion`, `send_rating_prompt`, and `dispatch_status_push`. Event-driven, with the time-based reminders fired by Supabase `pg_cron`. |
| **Disputes** | `disputes.ts` | The dispute-resolution agent. `intake` classifies the dispute kind and selects an initial resolution (refund %, compensation, blacklist flag); `respond` weighs both parties' statements and either finalizes the resolution or escalates to human review. Policy is deterministic. |
| **Conversation** | `conversation.ts` | Powers the `/chat` surface — a single Gemini agent that holds conversation history, decides turn-by-turn which tools to call, and returns a natural-language reply plus UI artifacts. It supersedes the linear planner pipeline for interactive chat. |

---

## 6. The Antigravity Workflow & Event Model

The server-side runtime entry point is `runWorkflow({ event, payload, userId, onStep })`. The system is **event-driven**: each `AppEvent` resolves to a fixed, deterministic plan.

| Event | Resolved Plan |
|-------|---------------|
| `new_request` | intent → discovery → ranking → await_user |
| `clarification_reply` | intent → discovery → ranking → await_user *(with merged context)* |
| `slot_selected` | booking (Phase A — invitation) |
| `booking_confirmed` | followup (enqueue pre-appointment + completion check) |
| `reminder_due` | followup (dispatch) |
| `completion_check_due` | followup (check_completion → enqueue rating) |
| `rating_prompt_due` | followup (send_rating_prompt) |
| `service_status_changed` | followup (dispatch_status_push) |

### Conversational mode

The interactive `/chat` surface runs in a different mode from the deterministic event pipeline. It uses **Gemini function calling** with three tools — `search_providers`, `book_appointment`, and `contact_places_provider` — and lazily invokes `compute_price` inside `book_appointment` so the full price breakdown is persisted alongside the booking.

### Dispute chain

Disputes follow a focused event chain:

```
POST /api/disputes  →  disputes.intake  →  provider PATCH  →  disputes.respond  →  resolution persisted + reputation trigger applied
```

---

## 7. Provider Data Model

Two provider sources blend into a single candidate stream:

| Table / Source | Purpose |
|----------------|---------|
| `providers` | Self-onboarded, fully bookable providers. Carries `hub_location` (PostGIS point), `service_area` (polygon), `categories[]`, `languages[]`, `google_rating` + `portal_rating` (Google Places rating vs. SahuliatAI's own verified rating), `on_time_score`, `cancellation_rate`, `risk_score`, `specializations[]`, `capacity`, `base_visit_fee`, and `base_hourly_rate`. |
| `providers.source = places_api` | "Ghost" rows created when SahuliatAI contacts a Google Places business that has not yet onboarded — these track the outreach attempt. |
| Google Places (live) | Providers discovered on demand via `text:` and `nearby:` requests; not persisted unless contacted. |
| `bookings` | Lifecycle is a status enum: `query_sent → invitation_sent → confirmed → en_route → arrived → in_progress → completed`, plus `cancelled` / `rejected`. Holds `price_breakdown`, `complexity`, `service_checklist`, `service_photos`, and the lifecycle timestamps `en_route_at`, `arrived_at`, `completed_at`. |
| `disputes` | A `kind` enum (`no_show`, `quality`, `price`, `cancellation`, `overrun`, `damage`) and a `status` enum (`open`, `under_review`, `resolved`, `escalated`), with `statements` (jsonb) for both sides' submissions and `resolution` (jsonb) for the policy outcome. |
| `ratings` | Customer-submitted 1–5 star reviews tied to a completed booking. A `recompute_provider_rating` trigger keeps each provider's `portal_rating` / `portal_rating_count` aggregates in sync. |

**Geospatial RPCs (PostGIS):** `search_providers_rpc`, `providers_in_bbox`, `st_distance_to_provider`, `count_recent_bookings_in_area`, `get_user_location_geo`, `check_availability_rpc`.

---

## 8. Matching & Ranking Algorithm

Matching is a **two-stage pipeline** — a broad *discovery* sweep optimised for recall, followed by a precision *re-ranking* pass. Separating the two keeps the system both comprehensive (it never misses a nearby provider) and sharp (it surfaces the *right* one first).

### Stage 1 — Discovery (recall)

The discovery agent casts a wide net. It runs a PostGIS proximity search over the `providers` table with an **adaptive radius** that expands from 5 km up to 20 km until enough candidates are found, and in parallel queries the **Google Places** Nearby Search API. The two streams are merged, deduplicated (a self-onboarded database row always wins over a Places listing for the same business), and capped at **15 candidates**. At this point the list is ordered only by raw straight-line distance — this stage cares about *recall*, not precision.

### Stage 2 — Re-ranking (precision)

The ranking agent (`lib/antigravity/agents/ranking.ts`) then **re-ranks** that shortlist. Before scoring, it enriches each candidate with three pieces of fresh data:

1. **Distance refinement** — straight-line distance is replaced with **actual travel distance and time** from the Google **Distance Matrix API** (a Haversine calculation is the automatic fallback). The source used is recorded in the trace as `google_distance_matrix` or `haversine_fallback`.
2. **Availability resolution** — every self-onboarded provider is checked against the requested time slot via `supabase.check_availability`; Google Places providers are assumed available (they will be contacted to confirm).
3. **Returning-customer lookup** — the set of providers this customer has successfully booked before is loaded.

Each candidate is then scored on the **8-factor, 100-point composite model** below, and the shortlist is **re-sorted by composite score, descending**. This is the heart of re-ranking: a provider that ranked #1 on raw distance can be pushed down by a slightly farther but markedly more reliable, better-rated, available competitor. That displacement is the entire point of the second pass.

### The 8-factor composite score (100 points)

| Factor | Weight | How it is scored |
|--------|--------|------------------|
| **Distance** | 25 | Linear: full 25 points at 0 km, decaying to 0 at ≥ 15 km — computed on the *refined* travel distance. |
| **Rating × recency** | 20 | `20 × (rating ÷ 5) × recencyMultiplier`. Uses SahuliatAI's own **portal rating** when the provider has portal reviews, otherwise the **Google rating**; an unrated provider receives a neutral 0.625 baseline. |
| **On-time score** | 15 | `15 × on_time_score` — the provider's historical on-time arrival rate. |
| **Availability** | 10 | 10 if free for the requested slot, 5 if the next free slot is within 24 hours, 0 otherwise. |
| **Reliability (1 − cancellation rate)** | 10 | `10 × (1 − cancellation_rate)` over completed jobs. |
| **Price fit** | 10 | 10 if the provider's price band matches the customer's budget, 5 one tier off, 2 two tiers off, and a neutral 5 when the customer expressed no budget. |
| **Language match** | 5 | 5 if the provider speaks the customer's preferred language, 2.5 otherwise. |
| **Returning-customer affinity** | 5 | 5 if this customer has booked this provider before, otherwise 0. |
| **Specialization bonus** | +2 … +5 | Applied only to **intermediate / complex** jobs when the provider carries matching specializations or certifications — a certified provider on a complex job earns the full +5. |

### Recency decay

The rating factor is multiplied by a **recency decay** so a glowing review from two years ago does not outweigh a fresh one — reputation must be *current*:

| Provider's last review | Multiplier |
|------------------------|-----------|
| ≤ 30 days ago | 1.00 |
| ≤ 90 days ago | 0.85 |
| ≤ 180 days ago | 0.65 |
| > 180 days ago, or never reviewed | 0.40 |

### Result shaping

After scoring, the ranked list is split into the shape the conversation surface consumes:

- **`top`** — up to **3 bookable** (self-onboarded) providers; these are the primary recommendations rendered as provider cards.
- **`also_nearby`** — up to **5 Google Places** businesses, shown as "contact to confirm" options for when the bookable set is thin.
- **`low_confidence`** — a flag set when there are no bookable picks *or* the best score falls below 40. It lets the conversation agent ask a clarifying question rather than over-promise on a weak match.

Every pick carries its **full per-factor breakdown** into the trace (e.g. `Ali AC Services: 78 (dist 21 · rating×rec 16 · on-time 13 · avail 10 · …)`), so any ranking decision can be explained after the fact — never merely asserted.

---

## 9. APIs, Tools & Integrations

### Public HTTP routes

| Route | Purpose |
|-------|---------|
| `POST /api/agent/run` | Process one conversational turn — returns the reply + UI artifacts. |
| `GET /api/agent/trace?run_id=…` | Full step-by-step workflow trace as JSON. |
| `POST /api/bookings/:id/rate` | Submit a 1–5 star rating for a completed booking. |
| `POST /api/disputes` | Open a dispute (customer side). |
| `PATCH /api/disputes/:id` | Provider response to a dispute. |
| `POST /api/provider/accept` · `reject` · `update-status` | Provider lifecycle actions. |
| `POST /api/places/contact` | Send a tokenised outreach to a Google Places business. |
| `GET /api/providers/nearby?lat=…&lng=…&slug=…` | Backs the live map page. |
| `POST /api/reminders/fire` | Reminder drain endpoint, called by `pg_cron`. |

### Antigravity tools (server-only, invoked by agents)

- **Supabase:** `supabase.search_providers`, `supabase.check_availability`, `supabase.create_booking`, `supabase.update_booking_status`, `supabase.enqueue_reminder`
- **Google:** `google.places_nearby`, `google.places_text_search`
- **Notifications:** `notify_provider` (WhatsApp / SMS / mock), `web_push.send`
- **LLM:** `llm.confirmation_message`, `llm.plan` (Gemini)
- **Pricing:** `compute_price` (visit fee + labour + distance + urgency / complexity / surge / loyalty)
- **Artifacts:** `generate_calendar_artifacts`, `generate_receipt`

### Mock vs. real integrations

A core design goal is **graceful degradation** — the app remains demonstrable end-to-end even when optional third-party credentials are absent.

| Integration | Status | Behaviour when credentials are missing |
|-------------|--------|----------------------------------------|
| **Google Gemini 2.5-flash** (`GOOGLE_GEMINI_API_KEY`) | **Real** | Intent parsing falls back to deterministic keyword matching; `/chat` shows a "set up the LLM key" message. |
| **Google Places API** (text + nearby search) | **Real** | Discovery degrades gracefully to database-only candidates. |
| **Google Maps JavaScript API** (`@vis.gl/react-google-maps`) | **Real** | The map page requires the Maps key; the rest of the app is unaffected. |
| **Supabase** — Postgres, PostGIS, Auth, Storage, Realtime | **Real** | Required infrastructure — the application does not run without it. |
| **`pg_cron` + `pg_net`** (reminder scheduling) | **Real** | Scheduled inside Supabase; `/api/reminders/fire` is the drain endpoint. |
| **Web Push** (VAPID) | **Real** | Keys generated via `pnpm vapid:generate`; push silently no-ops if unset. |
| **WhatsApp Business / SMS** (`notify_provider`) | **Mock by default** | Wired for Twilio / Meta; returns a `mock` result and the invitation URL is shown on-screen, so provider acceptance still works end-to-end. |
| **Payments** (EasyPaisa / Stripe) | **Not integrated** | Receipts are generated from the `compute_price` breakdown; no live payment rail is connected. |

---

## 10. Cost & Latency Analysis

For a single conversational turn that produces a completed booking:

| Step | Tokens / units | Wall time (p50) |
|------|----------------|-----------------|
| Gemini 2.5-flash (chat + tool decision) | ~600 input / ~250 output | ~1.4 s |
| `supabase.search_providers_rpc` | 1 SQL round-trip | ~80 ms |
| `google.places_nearby` (parallel) | 1 HTTP call | ~250 ms (cached) |
| `ranking.runRanking` | pure compute | < 5 ms |
| `supabase.create_booking` + trigger | 1 insert + 1 trigger | ~60 ms |
| `compute_price` | 2 RPCs | ~40 ms |
| Push + calendar artifacts | parallel | ~150 ms |
| **Total (warm)** | | **~2.0 s** |

**Estimated cost per 1,000 bookings (USD):** ~$0.60 Gemini + ~$3 Google Places + ~$0.20 Supabase. Push and WhatsApp costs are sender-side and capped by the provider's plan.

---

## 11. Baseline Comparison

| Approach | Time to book | Multilingual | Vets provider | Recovers from no-shows | Surge / urgency pricing |
|----------|--------------|--------------|---------------|------------------------|-------------------------|
| Google search + manual calling | 10–30 min | manual | ✗ | ✗ | ✗ |
| Marketplace app (lead-gen) | 3–8 min | partial | partial | partial | partial |
| **SahuliatAI agentic flow** | **~2 min** | ✓ | ✓ (8-factor) | ✓ (dispute agent) | ✓ (`compute_price`) |

The qualitative wins: **(a)** the chat surface absorbs Roman Urdu / Urdu / English with no language picker; **(b)** the 8-factor score is explainable per-pick through the trace; and **(c)** the dispute-resolution agent applies policy in seconds rather than days.

---

## 12. Security & Privacy

- **Row-Level Security.** All PII (name, phone, address) is stored in Supabase under RLS — a customer can read only their own row, and a provider can read only the snapshot fields on a booking they have accepted.
- **Tokenised invitations.** Provider invitation links use a `nanoid(32)` token and expire in 15 minutes; the token is never returned to the customer side.
- **Minimal LLM exposure.** Gemini calls never receive raw phone numbers or addresses unless the customer explicitly types them into the chat. Location is passed as a `{ lat, lng }` pair, never as raw address text.
- **Decentralised push.** Web Push uses VAPID — no centralised push key is required.
- **Scoped media.** Provider-uploaded service-quality photos live in Supabase Storage and are served only via signed URLs.
- **Confined disputes.** Dispute statements are visible only to the two parties involved and the resolution agent.

---

## 13. Assumptions

- **Demo mode is the default.** When WhatsApp Business / SMS credentials are absent, `notify_provider` returns `mock`; the UI explains that the invitation token would have been delivered, and provider acceptance still works because the URL is shown on screen.
- **Karachi-first.** Sample data and city defaults assume Karachi geometry; a provider's service area defaults to a 10 km radius unless an explicit polygon is set.
- **Pakistani Rupees only.** All pricing is in PKR. The schema is currency-aware, but the UI assumes PKR.
- **Mocked PII.** Seed data uses fabricated names and Pakistani phone formats only — no real personal data ships with the project.
- **Authentication.** Supabase Auth handles email + password. `example.com` test addresses are rejected by Supabase Auth — use a real domain or the seeded admin accounts.
- **PWA / APK.** `public/.well-known/assetlinks.json` is served statically (the Vercel CDN bypasses the DDoS challenge); the PWABuilder TWA wraps the deployed PWA into the Android APK.

---

## 14. Limitations & Roadmap

- **Live WhatsApp / SMS delivery** requires a paid Twilio / Meta account. The code wires `notify_provider` to those APIs but falls back to mock when keys are missing.
- **Map clustering** is not yet implemented — beyond ~100 providers, the map page would benefit from `supercluster`.
- **Provider availability** is currently derived from the `bookings` table; a richer rota / shift model would need a dedicated `provider_availability_slots` table.
- **No payment rail.** Receipts are generated, but no Stripe / EasyPaisa integration exists yet — the `compute_price` breakdown is the source of truth.
- **The dispute agent is deterministic.** A future version would call an LLM to weigh statements and choose between standard outcomes.
- **Single language model.** The conversational agent assumes Gemini 2.5-flash; provider-name resolution is fragile when a user names a business that is neither in the database nor on Google Places.

---

## 15. Running Locally

The fastest path is the bundled setup script — it checks prerequisites, creates `.env.local` from the template, runs `pnpm install`, generates VAPID keys, optionally links Supabase + pushes migrations + seeds, and prints the next steps:

```bash
cd product
bash scripts/setup.sh   # or: pnpm setup
```

You'll be prompted to fill `.env.local` with your Supabase / Gemini / Google Maps keys before it continues. After setup finishes:

```bash
pnpm dev                # http://localhost:3010
```

**Prerequisites** (the script verifies these): **Node ≥ 20**, **pnpm ≥ 9**, the **Supabase CLI**, and **psql** (for seeding). Install the Supabase CLI via `brew install supabase/tap/supabase`; install `psql` via `brew install libpq && brew link --force libpq`.

Re-running `scripts/setup.sh` is safe — every step skips if already done.

### Teammate onboarding (no Supabase / Vercel login needed)

The owner shares **one file**: `.env.prod` (it contains every secret the team needs — Supabase, Gemini, Maps, VAPID, plus `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` and `SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_REF`). Distribute via 1Password or another secure channel — never plain Slack/email.

Teammate steps from a fresh clone:

```bash
git clone <repo>
cd <repo>/product
# Drop the shared file in:
cp /path/to/team-secrets/.env.prod ./.env.prod
# One-time mirror so the Next.js dev server picks it up:
cp .env.prod .env.local
pnpm setup        # answer N to "your own Supabase project?" — defaults are safe
pnpm db:verify    # read-only schema check
pnpm dev          # http://localhost:3010
```

After that they can also:

```bash
pnpm db:push           # apply pending migrations (uses SUPABASE_ACCESS_TOKEN from env)
pnpm deploy:preview    # headless deploy via VERCEL_TOKEN (no vercel login)
pnpm deploy:prod       # production deploy
```

Every DB script (`db:verify`, `db:push`, `db:diff`, `db:link`, `db:reset`, `db:seed`) automatically loads `.env.local` first, falling back to `.env.prod` — so teammates don't have to think about which file is in use. The deploy script does the same.

### Deployment by teammates (no owner login required)

**Recommended — Git-based auto-deploy.** Connect the GitHub repo to Vercel once (Vercel Dashboard → Project → Settings → Git). Every push to a branch produces a preview URL; merges to `main` go to production. Teammates need GitHub push access only — no Vercel login, no CLI, no token.

**Alternative — CLI deploy with a shared token.** The owner generates a scoped token at <https://vercel.com/account/tokens>, the teammate pastes it into `.env.local` as `VERCEL_TOKEN=...`, then:

```bash
SKIP_DB_PUSH=1 pnpm deploy:preview
```

`SKIP_DB_PUSH=1` is recommended for teammates so only the owner pushes migrations. Run `pnpm db:verify` before deploying to catch schema drift early.

**Migrations** are owner-only by default. If a teammate's PR needs a new migration, they author the SQL file under `supabase/migrations/`, push the branch, and ping the owner to apply it via `pnpm db:push`. Everyone else stays in read-only DB mode.

---

*See `tech_plan/` for per-feature implementation notes and `scope/` for the full product brief.*
