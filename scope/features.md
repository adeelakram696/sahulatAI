# Features

Three-tier prioritization: **MVP** (must ship), **Stretch** (ship if time), **Cut** (explicitly skipped).

[← back to scope.md](./scope.md)

---

## MVP — required to win the rubric

### A. Customer experience
- **A0. Email/password auth** (Supabase) — sign up, sign in, **forgot password** (email link), **change password** (signed-in setting), sign out. Standard Supabase email templates lightly branded.
- **A1. Customer onboarding** — after first sign-in, prompt for at least one **location** (Home / Work / Other) with map pin + reverse-geocoded city/town. **Hard rule:** no request can be made without ≥1 location.
- **A2. Multi-location management** — add / edit / delete locations from profile; default location auto-selected from most recent use.
- **A3. Chat-style request input** with text (typed). Location picker pinned above the input (defaults to most-recent location; tap to switch).
- **A4. Multilingual NLU** for English, Urdu (`اردو`), Roman Urdu — *handled by the Intent agent*.
- **A5. Service catalog**: at least 8 categories — AC tech, plumber, electrician, tutor, beautician, carpenter, car wash, mobile repair.
- **A6. In-process VIEW** — while the agent runs, customer sees a streaming progress card ("Understanding intent → Finding nearby → Ranking 7 options → Done") wired to the trace drawer.
- **A7. Provider recommendations card stack** — top 3 ranked, each with photo, distance, rating, price band, ETA, *reasoning text*, and a clear **bookable vs contact-only** state (registered providers are bookable; Places-API-only providers show "Call directly" + "Claim this business" CTA).
- **A8. Map preview** of providers around the selected location (Google Maps JS).
- **A9. Booking + invitation simulation** — pick slot → `bookings.status = invitation_sent` → `notify_provider` tool fires (Realtime → WhatsApp → SMS → mock fallback chain) → provider taps acceptance link → `confirmed` → customer push + **bilingual confirmation message** in chat + **structured summary card** matching the brief's example output + receipt PDF + **calendar reminder** (`.ics` + Google Calendar deep link, no API auth needed).
- **A10. My bookings** page — timeline of upcoming + past, with status (invitation_sent / confirmed / reminded / in_progress / completed / rejected).
- **A11. Follow-up rating prompt** after completion.

### B. Business / Provider portal
- **B1. Sign up + email/password** (Supabase auth, separate from customer; provider role flag).
- **B2. Business profile** — name, owner, photo, categories, languages, year started.
- **B3. Service areas** — pick on a Google Map (radius from pin or polygon) OR add city sectors from a dropdown.
- **B4. Availability** — recurring weekly hours + blackout dates.
- **B5. Price band** per category (low / mid / premium with PKR ranges).
- **B6. Notification preferences** — WhatsApp opt-in (verified phone) and/or SMS opt-in. Determines which channel the `notify_provider` tool tries first.
- **B7. Booking invitation inbox** with Realtime updates — Accept / Reject / Reschedule. Pending invitations time-out after a configurable window (default 15 min) → status `rejected`, customer notified.
- **B8. Provider acceptance page** (mobile-first, tokenized URL): bare-bones view when provider opens the invitation link from WhatsApp/SMS — accept/reject without logging in.
- **B9. Reputation panel** — average rating, total bookings, response time.

### C. Agentic system (the heart)
- **C1. Antigravity-orchestrated pipeline** with 6 agents (see [agent-workflow.md](./agent-workflow.md)):
  1. Planner (decides which agents to invoke)
  2. Intent Parser
  3. Provider Discovery
  4. Ranking & Decision
  5. Booking
  6. Follow-up Scheduler
- **C2. Tool integrations** routed through Antigravity:
  - Google Places API (provider discovery)
  - Google Distance Matrix (distance & ETA)
  - Supabase RPC (booking writes)
  - Internal scheduler (follow-up reminders)
- **C3. Full trace persistence** — every agent step (input, output, tool calls, reasoning) saved to `agent_traces` table and linked to the booking.
- **C4. Live trace viewer UI** — drawer that streams the trace as the pipeline runs.

### D. PWA & responsive
- **D1. Installable PWA** (manifest, icons, service worker, offline shell).
- **D2. Fully responsive** — mobile-first, works on desktop.
- **D3. RTL layout** when Urdu locale selected.
- **D4. Web Push** for booking confirmations + reminders.

### E. Demo polish
- **E1. Seeded demo data** — ~30 providers across categories in Islamabad.
- **E2. "Try a sample" buttons** with prefilled example queries (incl. Roman Urdu example from the brief).
- **E3. Trace replay** — pick any past booking and replay the agent run.

---

## Stretch — bonus points

- **S1. Multi-provider LLM fallback** (Claude / GPT via direct SDK) only if Antigravity's Gemini hits a quota wall during demo; otherwise unused.
- **S2. Voice output** — agent reads decision aloud (Web Speech Synthesis).
- **S3. Provider live-location share** for "on the way" status (mocked).
- **S4. Pricing negotiation agent** — extra agent that simulates a haggle within bounds.
- **S5. WhatsApp echo** — push a formatted message to a sandbox number via Twilio.
- **S6. PWA offline browsing** of past bookings (IndexedDB cache).
- **S7. Provider mobile shortcut** — short URL + QR for providers to install PWA.

---

## Cut — do not build

- **Voice input** (Web Speech API) — cut from MVP per team call.
- Real payments (Stripe/JazzCash etc.)
- CNIC / license verification
- Multi-language *speech recognition*
- iOS / Android native shells
- Multi-tenant / franchise hierarchy
- Dispute resolution & refund flow
- Provider-side analytics dashboards beyond the reputation panel
- Anonymous customer bookings — auth required.
