# Milestones — Hackathon Execution Plan

[← back to scope.md](./scope.md)

Assumes ~48 hours of build time and a team of 2–4. Adjust slot widths to your actual schedule. Critical path is bolded.

---

## Phase 0 — Prep (before hackathon clock starts)

- [ ] Confirm Antigravity access for all team members; one member reads docs and writes a 5-line "hello agent" smoke test.
- [ ] Create a Google Cloud project; enable: Maps JavaScript API, Places API (New), Geocoding, Distance Matrix.
- [ ] Generate API keys: server (unrestricted for now) + browser (restricted by referer to localhost + Vercel preview wildcard).
- [ ] Create Vercel project, link Supabase via Marketplace. (No AI Gateway — we use Antigravity directly.)
- [ ] Generate VAPID keys for Web Push.
- [ ] Decide team roles (suggested below).

**Suggested roles for a team of 3:**
- **Agent lead** — Antigravity workflows, tools, trace persistence.
- **Frontend lead** — Next.js app shell, PWA, customer + provider UI, Maps.
- **Data + integrations lead** — Supabase schema, seed data, RLS, reminders cron, push.

---

## Phase 1 — Foundations (hours 0–8) · **CRITICAL**

- [ ] **Init Next.js 16 app** with TS, Tailwind, shadcn/ui, next-intl, ESLint.
- [ ] Wire `vercel.ts` with build command and framework.
- [ ] Stand up Supabase: run migrations from [data-model.md](./data-model.md); enable `pg_cron` + `pg_net` + PostGIS extensions; seed categories + 30 providers.
- [ ] Configure Supabase Auth (email/password); customize the 4 default email templates (verify, magic-link unused, recovery, change-email).
- [ ] Land `app/layout.tsx` with locale provider, theme, RTL switch, signed-in middleware.
- [ ] Drop in PWA manifest + icons + minimal service worker; verify install prompt on Chrome.
- [ ] Build `<Map>` wrapper with `@vis.gl/react-google-maps` and confirm a pin renders.
- [ ] Build auth screens (signup, signin, forgot, reset, change-password).
- [ ] Build location onboarding flow + locations manager (CRUD).
- [ ] Stub `/api/agent/run` endpoint returning a hardcoded response so frontend can build against it.
- [ ] Confirm Antigravity SDK exposes structured-output LLM calls (Phase-0 smoke test). If gap → switch `lib/antigravity/llm.ts` to direct `@google/generative-ai` SDK.

**Phase exit check:** App boots, PWA installs, map renders, user can sign up + add a location, fake agent run returns 3 fake provider cards.

---

## Phase 2 — Agent pipeline (hours 8–22) · **CRITICAL**

- [ ] `lib/antigravity/client.ts` — verified call to Antigravity.
- [ ] Register tools: `places`, `distance_matrix`, `geocode`, `supabase_search_providers`, `supabase_create_booking`, `notify_provider` (with strategy fallback chain: realtime → WhatsApp → SMS → mock), `generate_receipt`, `generate_calendar_artifacts`, `generate_confirmation_message`, `scheduler.enqueue_reminder`, `web_push`.
- [ ] Build agents one by one with unit tests against fixtures:
  - [ ] Intent Parser — verify Urdu + Roman Urdu + English (3 fixtures each).
  - [ ] Discovery — DB-only mode first, then add Places.
  - [ ] Ranking — composite score + reasoning emission.
  - [ ] Booking — Phase A: writes invitation row, fires `notify_provider`, generates PDF + calendar artifacts.
  - [ ] Follow-up — enqueues reminders (after Phase B confirmation).
  - [ ] Planner — wires the rest, emits a plan, handles `needs_clarification`, listens for `booking_confirmed` events to retrigger Follow-up.
- [ ] Implement `/provider/accept/[token]` page + acceptance server action.
- [ ] Implement `notify_provider` mock fallback that writes `mock_messages` + emits trace event.
- [ ] Persist every step to `agent_traces`.
- [ ] Stream events back via SSE on `/api/agent/run`.

**Phase exit check:** Real Antigravity run from a Postman/curl call returns the canonical example correctly, with a full trace in Supabase.

---

## Phase 3 — Customer UI (hours 18–30)

(Overlaps with Phase 2 — frontend can iterate against the stubbed endpoint, then swap to the real one.)

- [ ] Landing page with hero + suggestion chips + language toggle.
- [ ] Chat surface: input, streaming "thinking…" panel.
- [ ] Provider card with "Why?" expand.
- [ ] Map preview integration.
- [ ] Slot picker modal.
- [ ] Confirmation/receipt screen + PDF download.
- [ ] My bookings list.
- [ ] Trace drawer (slides in, streams from SSE).

**Phase exit check:** Full happy path works in the browser end-to-end.

---

## Phase 4 — Provider portal (hours 22–34)

- [ ] Provider landing.
- [ ] Onboarding wizard 5 steps with Map area picker.
- [ ] Provider dashboard with Realtime booking inbox.
- [ ] Accept / Reject / Reschedule actions.
- [ ] Settings screen.

**Phase exit check:** A brand-new provider can sign up, publish, and receive a booking via the customer flow.

---

## Phase 5 — Trace UX + demo polish (hours 30–40)

- [ ] Trace step animations, status colors, expand/collapse.
- [ ] `/trace/[runId]` full inspector + replay button.
- [ ] `/demo` dashboard with prefilled queries.
- [ ] Confetti + microcopy polish on confirmation screen.
- [ ] Seed 3 sample completed bookings + 3 sample traces so the app feels alive.
- [ ] Lighthouse pass — fix anything below 90.

---

## Phase 6 — Reminders + push (hours 34–42)

- [ ] **Supabase `pg_cron` + `pg_net`**: schedule `drain_due_reminders()` every minute. Function POSTs to `/api/reminders/fire` with shared-secret header.
- [ ] `/api/reminders/fire` endpoint: verify secret, send web push + WhatsApp/SMS, update booking status.
- [ ] Same cron drains **expired invitations** (auto-reject after 15 min window).
- [ ] Web Push send for invitation-pending, confirmation, pre-appointment, completion check, rating prompt.
- [ ] Rating submission flow.
- [ ] iOS install banner.

---

## Phase 7 — Documentation + video (hours 40–48) · **CRITICAL**

- [ ] README with architecture diagram, Antigravity usage, APIs, assumptions, limitations.
- [ ] Trace export endpoint verified.
- [ ] Record demo video per [demo-script.md](./demo-script.md).
- [ ] Backup recordings of trace replay in case of live failure.
- [ ] Deploy to Vercel production URL; smoke test on real Android + iPhone.
- [ ] Submit deliverables.

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Antigravity SDK surprises (auth, schemas) | L | High | Team confirmed Antigravity IDE access. Still: 5-line smoke test in Phase 0. |
| `pg_cron` / `pg_net` not enabled on Supabase free plan | L | High | Both extensions are available on Supabase free; verify in Phase 1. Backup: GitHub Actions cron POSTing to the same endpoint (5-min cadence, free). |
| WhatsApp Cloud API onboarding (Meta Business verification) too slow | M | Low | Mock fallback path keeps the demo working; real WhatsApp is a stretch upgrade. |
| LLM misunderstands Roman Urdu | M | Medium | Fixtures in tests; pre-translate step using Gemini in Intent agent. |
| Google API quota during demo | L | Medium | Fallback mode toggle (zero-API). |
| Push doesn't fire on iOS during demo | M | Low | Record demo on Android primary; show DB row as proof. |
| Map JS bill spikes | L | Medium | Browser key referer-restricted; lazy-load. |
| Realtime booking inbox lag | L | Medium | Manual refresh button as fallback. |
| Scope creep (someone wants payments) | H | High | Re-read [features.md](./features.md) Cut section. |

---

## Definition of Done (per deliverable)

| Deliverable | DoD |
|---|---|
| Working prototype (mobile) | Installable PWA, full customer + provider flow, agent pipeline live, deployed to public URL. |
| Demo video | 3–5 min, all 6 rubric pillars visible, captions, uploaded. |
| Agent trace / logs | `/trace/[runId]` page works; JSON export endpoint returns full run. |
| README | Architecture + Antigravity usage + API list + assumptions + limitations sections. |
