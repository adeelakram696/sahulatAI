# Requirements Review — brief vs. scope

[← back to scope.md](./scope.md)

Line-by-line mapping of the **Challenge 2** brief to our scope docs. Status: ✅ covered, 🟡 partially covered (action item below), ❌ missing (now added).

---

## Problem statement — must-haves

| Brief requirement | Status | Where |
|---|---|---|
| Understand user service requests in natural language | ✅ | [agent-workflow.md § Intent Parser](./agent-workflow.md#2-intent-parser-agent) |
| Identify relevant providers using location/context | ✅ | [agent-workflow.md § Discovery](./agent-workflow.md#3-discovery-agent) |
| Select or recommend the best provider | ✅ | [agent-workflow.md § Ranking & Decision](./agent-workflow.md#4-ranking--decision-agent) |
| Simulate booking and confirmation | ✅ | [agent-workflow.md § Booking](./agent-workflow.md#5-booking-agent) |
| Handle follow-up interactions | ✅ | [agent-workflow.md § Follow-up](./agent-workflow.md#6-follow-up-agent) |
| Show complete reasoning and workflow execution | ✅ | Trace drawer + `/trace/[runId]` |
| **Use Google Antigravity as the core platform** (mandatory) | ✅ | Entire pipeline in `lib/antigravity/` |

---

## System Requirements — line-by-line

### 1. Intent Understanding
| Sub-req | Status | Notes |
|---|---|---|
| Process natural language | ✅ | Gemini via Antigravity |
| Urdu, Roman Urdu, English | ✅ | 3 locales in `next-intl` + Intent agent fixtures |
| Extract: service type, location, time | ✅ | Output schema in [agent-workflow.md](./agent-workflow.md#2-intent-parser-agent) |
| **🟡 Multi-turn clarification** | 🟡 → ✅ | Brief implies one-shot, but ambiguous inputs need a follow-up. Added to user-journey.md and Planner agent. |

### 2. Provider Discovery
| Sub-req | Status | Notes |
|---|---|---|
| Mock dataset OR Google Maps / Places | ✅✅ | Doing both. Locked in [§ Decisions](#decisions-locked-in). |
| Nearby providers | ✅ | PostGIS `ST_DWithin` + Places Nearby. |
| Service category match | ✅ | `categories` enum + keyword expansion for Roman Urdu. |

### 3. Matching & Ranking
| Sub-req | Status | Notes |
|---|---|---|
| Rank by distance, availability, rating | ✅ | Plus price-fit and language match. Composite score detailed in [agent-workflow.md § 4](./agent-workflow.md#4-ranking--decision-agent). |
| Clear reasoning for selection | ✅ | Bilingual reasoning string emitted per top pick. |

### 4. Decision & Recommendation
| Sub-req | Status | Notes |
|---|---|---|
| Best provider OR top options | ✅ | Top 3 cards. |
| Explain in simple terms | ✅ | "Why?" expand on each card. |

### 5. Action Simulation (CRITICAL)
| Sub-req | Status | Notes |
|---|---|---|
| Booking confirmation | ✅ | Receipt screen + PDF + booking_id. |
| Provider assignment | ✅ | `bookings.provider_id` + appears in provider inbox via Realtime. |
| Scheduling | ✅ | `slot_start`/`slot_end` persisted; reminder enqueued. |
| **❌ → ✅ Confirmation message** (textual artifact) | Added | New: Booking agent emits a bilingual confirmation message into the chat, in addition to the PDF. See [agent-workflow.md § 5](./agent-workflow.md#5-booking-agent). |
| **🟡 → ✅ Structured summary card** matching brief's example format | Added | New: After booking, chat renders a card matching the exact format from the brief (Service Request / Location / Time / Provider / Reasoning / Booking / Follow-up). See [ui-screens.md § Structured summary](./ui-screens.md#structured-summary-card). |

### 6. Follow-Up Automation
| Sub-req | Status | Notes |
|---|---|---|
| Reminders | ✅ | Pre-appointment push at `slot - 1h`. |
| Status updates | ✅ | `bookings.status` transitions, pushed live. |
| Completion confirmation | ✅ | Completion check + rating prompt. |

### 7. Agentic Workflow (MANDATORY)
| Sub-req | Status | Notes |
|---|---|---|
| Multiple agents OR structured pipeline | ✅ | 6 agents + planner. |
| Planning → decision → action → follow-up | ✅ | Planner agent explicitly emits the plan. |
| Traceable logs (decisions, tool usage, action execution) | ✅ | `agent_traces` + UI drawer + JSON export. |

---

## Deliverables — line-by-line

| Deliverable | Status | Where |
|---|---|---|
| Working Prototype with **Mobile App (MUST)** | ✅ | PWA installable to phone home screen, standalone display, splash, push — meets the "mobile app" bar without a native shell. Detailed in [pwa-and-mobile.md](./pwa-and-mobile.md). |
| Web App (Optional) | ✅ | Same PWA, installable on laptop. |
| Demo Video (3–5 min) | ✅ | [demo-script.md](./demo-script.md) |
| Agent Trace / Logs | ✅ | `/trace/[runId]` UI + JSON export endpoint. |
| Documentation (README) — architecture, Antigravity usage, APIs, assumptions, limitations | 🟡 → ✅ | Outline now explicit in [§ README plan](#readme-plan). |

---

## Evaluation Criteria — coverage

| Criterion | Weight | Coverage |
|---|---|---|
| Use of Google Antigravity | 25% | Entire orchestration pipeline. All tool calls. Visible in trace drawer. |
| Agentic Reasoning & Workflow | 20% | 6 distinct agents + planner; reasoning text emitted at every step; live trace UI. |
| Matching Quality & Decision Logic | 20% | 5-factor composite score; bilingual reasoning per pick. |
| Action Simulation & Execution | 15% | Real DB writes + receipt PDF + confirmation message + provider state change + scheduled reminders. |
| Technical Implementation | 10% | Next.js 16 + TS + Supabase + Antigravity + 4 Google APIs. Clean modular repo. |
| Innovation & UX | 10% | Multilingual chat + voice input + PWA install + live trace + provider self-onboard + map preview + RTL Urdu. |

---

## Important Guidelines from the brief

| Guideline | Compliance |
|---|---|
| NOT a simple listing/booking app | ✅ Agent-led orchestration is the product. |
| Focus on agentic automation, not UI complexity | ✅ Most build time on agents; UI is functional + clean, not over-engineered. |
| At least one booking simulated end-to-end | ✅ Full flow with state changes in DB + receipt + reminder. |
| Demonstrate reasoning + decision-making | ✅ Bilingual reasoning surfaced in UI and traces. |
| Use mock data if real APIs unavailable | ✅ Zero-API fallback flag in [google-apis.md](./google-apis.md#fallback-plan-zero-api-mode). |
| **❌ → ✅ Avoid real personal/sensitive data** | Added | Seed data uses obviously-fake names, phones (`+92 300 555 01xx`), emails (`@example.com`). Note added to [data-model.md](./data-model.md). |

---

## Decisions locked in

### 1. Seed data + live Places API → **Both**
- ~30 curated providers seeded via `supabase/seed.sql` (deterministic, demo-safe).
- Discovery agent merges seeded providers with live Places API results (deduped by name + location).
- A demo toggle (`?seed_only=1`) lets us force the deterministic path on stage if the network is bad.

**Cost for hackathon:** essentially free. Google Maps Platform gives **$200 monthly credit** (about 10k free calls/month per SKU under current pricing). With <500 demo runs we won't go over a few cents. New Google Cloud accounts also get a **$300 90-day free trial** on top, so we're safe even in the worst case. See [google-apis.md § Cost guardrails](./google-apis.md#cost-guardrails).

### 2. LLM path → **Antigravity LLM directly** (Round 3 lock-in, 2026-05-18)
- The team chose to call Antigravity's LLM interface (Gemini under the hood) directly, dropping Vercel AI Gateway and Langfuse from the MVP.
- Rationale: Antigravity is the rubric's biggest weight (25%); routing all LLM calls through it maximizes that score and reduces one network hop.
- Observability: Antigravity's native trace + our `agent_traces` mirror table. No third layer.
- **Fallback:** if Phase-0 smoke test shows Antigravity SDK can't do structured-output LLM calls, swap `lib/antigravity/llm.ts` to `@google/generative-ai` direct (only `GOOGLE_GEMINI_API_KEY` needed). Agents/tools stay unchanged.

### 3. Provider booking surface → **Web only**, with WhatsApp webhook as stretch
- MVP: web dashboard only (real-time inbox via Supabase Realtime).
- Stretch (Phase 5+ if time): provider opt-in WhatsApp webhook — when a booking lands, send a formatted message to the provider's number via a free Twilio sandbox or Meta WhatsApp Cloud API test number. *Provider tap on a link* in the message → opens dashboard. We do **not** build inbound WhatsApp parsing (out of scope).
- Detailed in [§ WhatsApp webhook (stretch)](#whatsapp-webhook-stretch).

---

## Gaps found and patched

These were missing or under-specified in v1 of the scope. All now addressed:

| Gap | Where it's now covered |
|---|---|
| Multi-turn clarification dialog in UI | [user-journey.md § Failure modes](./user-journey.md#1-customer-journey--i-need-a-service-now) |
| Bilingual textual confirmation message (not just PDF) | [agent-workflow.md § 5 Booking](./agent-workflow.md#5-booking-agent) |
| Structured summary card matching brief's example output | [ui-screens.md § Structured summary card](./ui-screens.md#structured-summary-card) |
| Error/empty states (no providers, booking failure, geo denied) | [ui-screens.md § Empty & error states](./ui-screens.md#empty--error-states) |
| Trust signals on provider cards (verified badge, response time, language match pill) | [ui-screens.md § Common UI elements](./ui-screens.md#common-ui-elements) |
| Privacy note — no real PII in seeds | [data-model.md § Privacy & test data](./data-model.md#privacy--test-data) |
| README structure | [§ README plan](#readme-plan) below |
| Antigravity access risk de-risked early | [milestones.md § Phase 0](./milestones.md#phase-0--prep-before-hackathon-clock-starts) |
| LLM path decision (was Gateway+Langfuse; now Antigravity direct — see Round 3 lock-in) | [google-apis.md § LLM path](./google-apis.md) |
| WhatsApp webhook (stretch) | [§ below](#whatsapp-webhook-stretch) |

---

## README plan

The README is a scored deliverable. It will live at the repo root and cover, in this order:

1. **What this is** — 2-paragraph product pitch.
2. **Live demo** — deployed URL + sample queries to try + login for provider demo account.
3. **Architecture** — the diagram from [technical-architecture.md](./technical-architecture.md#high-level-diagram) inlined.
4. **How Antigravity is used** — explicit section listing each agent + tool, with a screenshot of the trace drawer.
5. **APIs / tools used** — table from [google-apis.md](./google-apis.md).
6. **Data model** — short ER overview + link to migrations.
7. **Local development** — setup steps (clone, env, supabase, dev server).
8. **Demo mode** — how to trigger seeded queries.
9. **Agent trace export** — endpoint + sample JSON.
10. **Assumptions** — informal economy patterns we modeled.
11. **Limitations & future work** — payments, real WhatsApp, identity verification, etc.
12. **Team & credits**.

---

## WhatsApp webhook (stretch)

Goal: when a booking is created, send a WhatsApp message to the provider with a deep link to accept.

**Approach:** Meta WhatsApp Business Cloud API (free sandbox) **or** Twilio WhatsApp sandbox (free for verified test numbers).

**Implementation outline:**
1. `tools/whatsapp_notify.ts` — Antigravity-registered tool wrapping the chosen API.
2. Provider settings has a "Get bookings on WhatsApp" toggle + verified phone capture.
3. Booking agent, after writing the booking, fires `whatsapp_notify` if the provider opted in.
4. Message body: provider name, customer name, service, slot, location, and a tokenized link to `/provider/dashboard?accept=<booking_id>`.
5. Inbound webhook (POST `/api/whatsapp/inbound`) — optional, ignored for MVP.

**Not in scope:** customer-side WhatsApp ingress, parsing replies, two-way conversation.

---

## Round 2 — answers from the team (2026-05-18)

These were the open clarifications. All resolved.

### 1. Antigravity access → ✅ Team has Antigravity IDE
No action needed. Proceed with Antigravity as central orchestrator.

### 2. Target city → User-provided **multi-location profile**
Not a fixed demo city. Instead:
- User registers → onboarding asks for **at least one location** (Home / Work / Other).
- Each location: free-text address + map pin (Google Maps + Geocoding) → reverse-geocoded into city/town/area.
- User can add more locations later from their profile.
- When making a request, user **selects which location** (defaults to most recently used).
- **Hard rule:** a request cannot be sent without a selected location.

New schema in [data-model.md § user_locations](./data-model.md#user_locations). New onboarding screens in [ui-screens.md § Customer auth & onboarding](./ui-screens.md#customer-auth--onboarding).

### 3. Customer auth → Email/password via Supabase Auth
- Sign up, sign in, **forgot password (email link)**, **change password** (signed-in setting).
- Supabase Auth handles email templates out of the box; we customize copy + branding.
- Drops the anonymous flow entirely.
- Bookings are tied to `auth.uid()`; RLS simplified.

### 4. Voice input → **Cut from MVP.**
Removed from features. Move keyboard input to primary.

### 5. Cron driver → **No Vercel Cron available** (team on Hobby plan)
Replacement: **Supabase `pg_cron` + `pg_net`** (both free, both built in to Supabase).
- `pg_cron` runs `drain_due_reminders()` every minute.
- Function `pg_net.http_post()`s to `/api/reminders/fire` on Vercel with a shared-secret header.
- Vercel endpoint sends web push + WhatsApp/SMS + status updates.
- Failure handling: mark `reminders.status = 'failed'`, retry next minute up to N=5.

This entire path is free and survives the Vercel Hobby plan limits. Detailed in [technical-architecture.md § Reminder driver](./technical-architecture.md#reminder-driver-supabase-pg_cron).

### 6. Receipt PDF → **`@react-pdf/renderer`** (free, server-rendered)
- MIT-licensed, server-side rendering in Vercel functions, no external service.
- Bonus: also render the receipt as a **print-optimized HTML page** so users without "Save as PDF" support still get a viewable receipt.

---

## Round 2 — new workflow (per team's product call)

The team described this flow:

> *"User makes a query → agent works in background showing the in-process VIEW on UI → results nearby shown → if part of a registered business on the portal, use its number to send invitation on number (mock API if not free) → set the calendar reminder."*

This sharpens the booking flow into a clearer two-phase model:

### Phase A — Discovery (the agent run)
1. Customer submits query (with selected location).
2. **In-process VIEW** opens: streaming trace drawer + a high-level "We're working on it…" card showing stages (Understanding → Finding nearby → Ranking).
3. Agent pipeline runs (unchanged).
4. Results render: top 3 provider cards + map. **Each card marked bookable or contact-only.**

### Phase B — Booking & Invitation (after user taps "Book")
1. User picks a slot.
2. `bookings` row inserted with status = **`invitation_sent`**.
3. **`notify_provider` tool fires** (Antigravity-registered, strategy pattern):
   - **a.** If provider has a Realtime dashboard session → Supabase Realtime push *(instant)*.
   - **b.** If provider opted into WhatsApp → WhatsApp Cloud API message *(free tier)*.
   - **c.** Else if SMS opt-in → Twilio trial SMS *(free credit)*.
   - **d.** Else **mock mode** → write to `mock_messages` table + UI badge "Sent to +92 300 555 01xx via WhatsApp ✓" so the demo still tells the same story.
4. Provider taps the link in the message → mobile-optimized **acceptance page** → status → **`confirmed`**.
5. Customer gets push: *"Booking confirmed by Ali AC Services"*.
6. **Calendar reminder** generated: `.ics` download + "Add to Google Calendar" deep link (no API auth needed for deep-link approach — free).
7. Supabase `pg_cron` enqueues the 1-hour-before reminder.

### Provider categories on result cards
- **Registered (self-onboarded)** → "Book" button → full invitation flow.
- **Discovered via Places API but not registered** → "Call directly" button + "Is this your business? Claim it" CTA (lightweight onboarding link). No invitation flow.

This is the only flow that's bookable; Places-only providers are shown for discovery breadth but aren't part of the booking simulation.

---

## Files affected by Round 2

| File | What changed |
|---|---|
| [data-model.md](./data-model.md) | Added `user_locations`, `mock_messages`; updated `bookings.status` enum; added `users_profile`; tightened RLS |
| [features.md](./features.md) | Added customer auth (B group), multi-location (B group), invitation flow (in A6); removed voice |
| [user-journey.md](./user-journey.md) | New journey 0 (signup + location onboarding); updated journey 1 with location picker + invitation flow |
| [agent-workflow.md](./agent-workflow.md) | Added `notify_provider` tool with strategy fallback; updated Booking agent flow with invitation phase |
| [ui-screens.md](./ui-screens.md) | Added auth screens (signup, login, forgot pw, change pw), location manager, location picker on chat, invitation-sent state, provider acceptance page |
| [technical-architecture.md](./technical-architecture.md) | Added `pg_cron` reminder driver; auth via Supabase Auth; routes for `/api/reminders/fire` and `/provider/accept/[token]` |
| [google-apis.md](./google-apis.md) | WhatsApp Cloud API free tier added; Google Calendar deep link (no API auth); pg_cron noted |
| [pwa-and-mobile.md](./pwa-and-mobile.md) | Receipt PDF via `@react-pdf/renderer`; in-app calendar add via deep link |
| [milestones.md](./milestones.md) | New tasks: auth, locations, pg_cron, invitation tool, provider acceptance page |
| [scope.md](./scope.md) | Decisions table updated to Round 2 outcomes |
