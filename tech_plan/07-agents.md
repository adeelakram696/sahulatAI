# 07 — Agents (6 of them)

One file per agent under `lib/antigravity/agents/`. Each agent's spec is fully detailed in [agent-workflow.md § Agents](../scope/agent-workflow.md#agents-detailed); this doc says **how to build** them.

[← back to README](./README.md)

---

## Shared

`lib/antigravity/agents/_agent.ts` (interface in [05-antigravity-setup.md § 3](./05-antigravity-setup.md#3-agent-registration-pattern)).

Every agent file exports:
```ts
export const <agentName>: Agent<typeof Input, typeof Output> = { ... };
```

Build the 6 agents in this order:

1. **Planner** (no LLM dependency; easiest first)
2. **Intent Parser** (depends on LLM tools)
3. **Discovery** (depends on Google + Supabase tools)
4. **Ranking** (depends on Discovery output + Distance Matrix + availability check)
5. **Booking** (depends on Supabase RPC + notify_provider + artifacts)
6. **Follow-up** (depends on Supabase RPC + push + whatsapp/sms)

---

## 1. `lib/antigravity/agents/planner.ts`

- **Spec:** [agent-workflow.md § 1 Planner](../scope/agent-workflow.md#1-planner-agent)
- **Model:** `gemini-2.x-flash` via `llm.plan`.
- **System prompt sketch:**
  ```
  You are the Planner for SahuliatAI. Given an event, return a JSON plan listing which agents to run in what order. Use the canonical decision rules. If unsure, fall back to the deterministic map. Reasoning must be one short sentence.
  ```
- **Fallback:** if `llm.plan` throws or returns malformed JSON, use a static `DECISION_MAP` (table in spec).
- **Tests:** `tests/unit/agents/planner.test.ts` — one case per event in the canonical events table.

```ts
const PLAN_SCHEMA = z.object({
  plan: z.array(z.object({ agent: z.enum(AGENT_NAMES), input: z.any(), depends_on: z.string().optional() })),
  reasoning: z.string(),
  expected_artifacts: z.array(z.string()),
});
```

---

## 2. `lib/antigravity/agents/intent-parser.ts`

- **Spec:** [agent-workflow.md § 2](../scope/agent-workflow.md#2-intent-parser-agent)
- **Model:** Gemini 2.x via Gateway.
- **Step order:**
  1. `llm.translate_normalize(raw_text, locale)` → normalized text.
  2. `llm.parse_intent(normalized, ctx={ selected_user_location, prior_intent? })` → tentative intent.
  3. Resolve `service_slug`: exact-match against `service_categories.keywords[]` (Postgres array `&&`); if no hit, `llm.embed(service_phrase)` and cosine-compare against pre-embedded category names; require similarity ≥ 0.6.
  4. Resolve `location.point`:
     - If user mentioned area: `google.geocode(text)` within Pakistan.
     - Else: use `selected_user_location.point` (source = `user_location`).
     - If mentioned area ≠ selected location → `source = 'ambiguous'`, push to `needs_clarification`.
  5. Resolve `time.iso`: `date-fns-tz` with `Asia/Karachi`. Map Roman Urdu phrases ("kal subah" → tomorrow morning ≈ 09:00 local) via a small lookup table + LLM fallback for unknowns.
  6. Aggregate confidences; if any < 0.6 → set `needs_clarification`.
- **Fixtures:** [13-testing.md § Intent fixtures](./13-testing.md#intent-fixtures) — 3 each for en / ur / ur-Latn including edge cases.

---

## 3. `lib/antigravity/agents/discovery.ts`

- **Spec:** [agent-workflow.md § 3](../scope/agent-workflow.md#3-discovery-agent)
- **Algorithm:**
  1. `radius = 5km`.
  2. Run `supabase.search_providers` + `google.places_nearby` in parallel.
  3. Dedup with `_dedup.ts` helper: Jaro-Winkler on normalized name + Haversine distance < 100 m. DB row wins.
  4. If `< 5` candidates → bump radius to 10 km, then 20 km; cap at 15 total.
  5. For top candidates without rating/photo, enrich via `google.place_details`.
  6. Apply `exclude_provider_ids` filter (used on `invitation_expired`).
- **Output:** see schema in spec.
- **Empty handling:** return `{ candidates: [], reason: 'no_match' }`.

```ts
// lib/antigravity/agents/_dedup.ts
export function dedupe(db: Provider[], places: Place[]): Provider[] { /* ... */ }
```

---

## 4. `lib/antigravity/agents/ranking.ts`

- **Spec:** [agent-workflow.md § 4](../scope/agent-workflow.md#4-ranking--decision-agent)
- **Step order:**
  1. `google.distance_matrix(user_location.point, candidates.map(c => c.hub_location))` — single batched call.
  2. For each candidate: `supabase.check_availability(provider_id, intent.time, intent.time + provider.avg_duration)`.
  3. Compute composite score (TS function, deterministic):
     ```ts
     score = 0.35*distancePoints + 0.25*ratingPoints + 0.20*availabilityPoints + 0.10*priceFitPoints + 0.10*languagePoints
     ```
  4. Pick top 3; if top < 40 → return `low_confidence: true` with empty `top`.
  5. `llm.explain_bilingual(pick, intent)` for each top pick — *parallel* for latency.
- **Distance fallback:** if Distance Matrix fails or `NEXT_PUBLIC_USE_GOOGLE_APIS=false`, use Haversine + a constant speed assumption (30 km/h urban).
- **Output:** `{ top, all_scored, low_confidence, distance_used }`.

---

## 5. `lib/antigravity/agents/booking.ts`

- **Spec:** [agent-workflow.md § 5](../scope/agent-workflow.md#5-booking-agent)
- **Phase A** (single agent call from `slot_selected` event):
  1. Compute `slot_end = slot_start + provider.avg_duration`.
  2. `supabase.create_booking({ ... invitation_token: nanoid(32) })`.
     - On `exclude_constraint_violation` → look up next available via `ranking.next_available`; offer that slot back or throw conflict error.
  3. `notify_provider({ booking_id })` — strategy chain; records `invitation_channel`.
  4. In parallel: `generate_receipt`, `generate_calendar_artifacts`, `llm.confirmation_message(phase='pending')`.
  5. `web_push.send(userId, { title: 'Invitation sent', body: ..., url: /booking/<id> })`.
  6. Emit `booking_invitation_sent` event into the trace.
- **Phase B** is *not* in this agent — it's the `/provider/accept/[token]` route handler ([08-api-routes.md](./08-api-routes.md#post-providerexpedited)). The handler emits `booking_confirmed` which triggers the Planner → Follow-up.

---

## 6. `lib/antigravity/agents/followup.ts`

- **Spec:** [agent-workflow.md § 6](../scope/agent-workflow.md#6-follow-up-agent)
- **Single agent, 4 modes** (per `input.mode`):
  | Mode | Actions |
  |---|---|
  | `enqueue_pre_appointment` | `supabase.enqueue_reminder(pre_appointment, slot - 1h)` + `enqueue_reminder(completion_check, slot_end)` |
  | `dispatch` | `web_push.send(customer)` + `web_push.send(provider)` + (if opted in) WhatsApp/SMS; `update_booking_status(reminded)` |
  | `check_completion` | Auto-transition `confirmed → in_progress → completed`; enqueue `rating_prompt` at `slot_end + 1h` |
  | `send_rating_prompt` | `web_push.send(customer)` with action button; status stays `completed` |

---

## Agent map

`lib/antigravity/agents/index.ts`:
```ts
export const AGENT_MAP = {
  planner: planner,
  intent_parser: intentParser,
  discovery: discovery,
  ranking: ranking,
  booking: booking,
  followup: followup,
} as const;
```

---

## Acceptance for 07-agents

- [ ] Each agent file exports a typed `Agent` instance.
- [ ] Each agent has at least 3 unit-test fixtures (en/ur/ur-Latn) covering the happy path + `needs_clarification` + an edge case.
- [ ] Running the canonical example end-to-end via `pnpm test:integration agent-flow` produces a trace matching [agent-workflow.md § Example trace](../scope/agent-workflow.md#example-trace-the-briefs-canonical-query) shape.
- [ ] Planner deterministic fallback exercised in tests (forced LLM error).
- [ ] Ranking returns `low_confidence: true` when all scores < 40.
- [ ] Booking idempotency proven: replaying same `(run_id, slot)` returns existing booking.
- [ ] Booking concurrency: two parallel requests for same provider+slot → one wins, one returns conflict.
