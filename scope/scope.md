# SahuliatAI — AI Service Orchestrator for the Informal Economy

> **Hackathon Challenge 2** · Google Antigravity-powered agentic system that takes natural-language service requests (English / Urdu / Roman Urdu), discovers and ranks nearby providers, simulates booking, and handles follow-ups end-to-end.

**Working name:** *SahuliatAI* (Urdu: *سہولت* = "convenience / ease")

---

## TL;DR

A PWA (mobile + desktop installable) built on **Next.js 16 App Router** where:

1. **Customers** describe their need conversationally → an Antigravity-orchestrated multi-agent pipeline (Intent → Discovery → Ranking → Booking → Follow-up) handles the whole lifecycle.
2. **Businesses** (plumbers, AC techs, tutors, beauticians…) onboard themselves via a dedicated provider portal, list services, areas served, hours, and rates.
3. **Live agent trace** is exposed in the UI so judges (and users) can see reasoning, tool calls, and decisions in real time — directly addressing the 25% Antigravity rubric weight and 20% reasoning weight.

---

## Why this scope wins the scoring rubric

The challenge weights are heavily AI-side (65%), not UI-side (35%). Scope reflects that.

| Rubric weight | How we cover it |
|---|---|
| **Antigravity orchestration — 25%** | All 6 agents + 22 tools registered in Antigravity. Every external action (Maps, Places, Distance Matrix, Geocoding, Supabase RPC, web push, WhatsApp/SMS strategy chain, PDF + calendar generation) routed through Antigravity workflows. Multi-run orchestration — Planner re-enters on each event (`new_request`, `slot_selected`, `booking_confirmed`, `invitation_expired`, `reminder_due` …). See [agent-workflow.md](./agent-workflow.md). |
| **Agentic reasoning — 20%** | 6 distinct agents with explicit Planner (Gemini Flash with deterministic fallback map). Each agent has structured I/O schemas, an event-driven trigger model, and persists reasoning text to the trace. Live UI drawer streams it; full export endpoint for the deliverable. |
| **Matching quality — 20%** | 5-factor composite: distance (Distance Matrix), rating, **availability check via PostGIS + bookings overlap query**, price-fit, language match. Low-confidence fallback. Bilingual reasoning string per top pick. Dedup of Places + DB results visible in trace. |
| **Action simulation — 15%** | **Two-phase invitation flow** with real DB state transitions (`invitation_sent → confirmed → reminded → in_progress → completed`). Multi-channel `notify_provider` (Realtime → WhatsApp → SMS → **mock fallback that keeps the demo telling the same story without external creds**). PDF receipt via `@react-pdf/renderer`. Calendar artifacts (`.ics` + Google Calendar deep link). Reminders driven by Supabase `pg_cron` + `pg_net` (no Vercel cron needed). |
| **Technical implementation — 10%** | Next.js 16 + TypeScript + Supabase (Auth + Postgres + Realtime + RLS + pg_cron + pg_net + PostGIS) + Antigravity + 4 Google APIs. PWA installable on mobile + desktop. Clean modular repo with single tool registry. |
| **Innovation & UX — 10%** | Multilingual chat-first interface (English / Urdu / Roman Urdu, RTL-aware), multi-location user profiles, in-process VIEW with live trace drawer, two-phase booking with provider acceptance via WhatsApp link (or mock UI badge), provider self-onboarding wizard with map polygon picker, demo dashboard with prefilled queries + replay. |

---

## Scope documents

| File | Purpose |
|---|---|
| [requirements-review.md](./requirements-review.md) | **Brief-vs-scope gap analysis + locked decisions + remaining clarifications.** Read this first. |
| [features.md](./features.md) | Feature inventory (MVP / Stretch / Cut) |
| [user-journey.md](./user-journey.md) | Customer + Business owner + Judge/Demo journeys |
| [technical-architecture.md](./technical-architecture.md) | Stack, services, deployment, repo layout |
| [agent-workflow.md](./agent-workflow.md) | Antigravity agent design, tools, traces |
| [data-model.md](./data-model.md) | Supabase schema (providers, bookings, traces, reminders) |
| [ui-screens.md](./ui-screens.md) | Screen inventory + wireframe sketches |
| [google-apis.md](./google-apis.md) | Exact Google API surface used + fallback plan |
| [pwa-and-mobile.md](./pwa-and-mobile.md) | PWA install, offline cache, push notifications |
| [demo-script.md](./demo-script.md) | The 3–5 min demo storyboard for the video deliverable |
| [milestones.md](./milestones.md) | Hour-by-hour hackathon execution plan |

---

## Headline features

### For customers (end users)
- **Email/password sign-up** with forgot/change-password flows (Supabase Auth + email templates).
- **Multi-location profile** — Home / Work / Other addresses with map-pin + reverse-geocoded city. At least one required; selectable per request.
- **Multilingual chat input** — typed, in English / Urdu / Roman Urdu.
- **One-shot intent** — "Mujhe kal subah G-13 mein AC technician chahiye" → parsed structurally.
- **In-process VIEW** while the agent works — streaming progress card backed by the trace drawer.
- **Provider recommendations** with map preview, distance, rating, ETA, and an *explanation* of why each was picked. Registered providers are bookable; Places-only results are contact-only with a "Claim this business" CTA.
- **Two-phase booking simulation** — pick slot → invitation sent to provider's phone (WhatsApp/SMS or mock) → provider accepts → confirmation receipt (PDF + on-screen) + **Add to Calendar** (`.ics` + Google Calendar deep link).
- **Booking timeline** with reminder pings (1 hr before, on-the-way, completed) — driven by Supabase `pg_cron` (no Vercel cron needed).
- **Follow-up rating** prompt that feeds back into the ranking model.

### For businesses (providers)
- **Self-onboarding** flow — name, categories, service areas (drawn on Google Map or via postcode), hours, price band, languages spoken.
- **Verification stub** — phone OTP (Twilio sandbox or simulated).
- **Booking inbox** — real-time list with accept / reject / reschedule.
- **Availability calendar** — block slots, set recurring hours.
- **Reputation panel** — ratings, completion rate, response time.

### For judges (demo / trace viewer)
- **Live agent trace panel** — slide-out drawer per booking showing every Antigravity step: agent invocation → tool call → input → output → reasoning summary.
- **"Replay" mode** — re-run a request and watch the agents work.
- **Public sample requests** seeded so the judge can try in one click.

---

## Tech pillars

- **Framework:** Next.js 16 App Router (PWA via manifest + service worker)
- **Language:** TypeScript strict
- **UI:** Tailwind CSS + shadcn/ui + Radix; Framer Motion for trace animations
- **Auth + DB:** Supabase (Postgres, Auth — email/password, Realtime, RLS, `pg_cron` + `pg_net` for free reminders driver) — provisioned via Vercel Marketplace
- **Agent orchestration:** **Google Antigravity** (mandatory) — every agent lives there
- **LLM access:** **Antigravity LLM directly** (Gemini under the hood). Direct `@google/generative-ai` SDK only if Antigravity SDK has gaps (Phase-0 smoke test decides).
- **Maps:** Google Maps JavaScript API + Places API + Geocoding + Distance Matrix
- **i18n:** `next-intl` with `en`, `ur`, `ur-Latn` locales (RTL handled)
- **Receipt PDF:** `@react-pdf/renderer` (free, server-rendered)
- **Calendar:** `.ics` files + Google Calendar deep links (no API auth)
- **Provider notifications:** `notify_provider` strategy chain — Realtime → WhatsApp Cloud (1k/mo free) → Twilio SMS ($15 trial) → **mock fallback** (writes to `mock_messages` so demo always works)
- **Notifications:** Web Push (PWA) + simulated WhatsApp/SMS via console + DB record
- **Hosting:** Vercel (Fluid Compute) with `vercel.ts` config

See [technical-architecture.md](./technical-architecture.md) for the full diagram.

---

## What's explicitly OUT of scope (to keep the hackathon shippable)

- Real payment processing (booking simulation only)
- Real SMS/WhatsApp delivery (simulated — DB row + UI toast suffices for the rubric)
- Identity verification (CNIC / business license — stub only)
- Multi-tenant / franchise dashboards
- Dispute resolution flows
- Native iOS/Android apps (PWA covers "mobile app" deliverable per the brief)

---

## Decisions locked in

Full reasoning in [requirements-review.md § Decisions](./requirements-review.md#decisions-locked-in).

1. **Seed data + live Places API → BOTH.** ~30 curated seeded providers (deterministic, demo-safe) merged with live Google Places results. Demo toggle `?seed_only=1` to force deterministic mode if network is bad on stage.
   - **Cost:** essentially free for hackathon scale. Google Maps Platform gives ~$200/month free credit (≈10k calls/SKU); new accounts get an extra $300 90-day trial. Our <500 demo runs sit comfortably in the free band.
2. **LLM path → Antigravity LLM directly** (Gemini via the Antigravity SDK). Drops Vercel AI Gateway and Langfuse from MVP — they were a hedge against SDK gaps, but the team confirmed they want to use Antigravity natively to maximize the rubric weight (25%). The Phase-0 smoke test confirms SDK can do structured-output LLM calls; if it can't, fallback is direct `@google/generative-ai` SDK (no observability layer needed because `agent_traces` + Antigravity's own trace already cover us).
3. **Provider booking surface → web only (MVP) + WhatsApp webhook (stretch).** Web dashboard with Realtime inbox for MVP. If time allows in Phase 5+, add an outbound-only WhatsApp notification (provider opt-in) using Meta WhatsApp Cloud API sandbox or Twilio. No inbound parsing. See [requirements-review.md § WhatsApp webhook (stretch)](./requirements-review.md#whatsapp-webhook-stretch).

Still-open clarifications (don't block scope, do block Phase 2 start) listed in [requirements-review.md § Still-open clarifications](./requirements-review.md#still-open-clarifications-for-the-team).
