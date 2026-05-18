# 13 — Testing & Fixtures

Lightweight test layer focused on the agent pipeline + critical regressions.

[← back to README](./README.md)

---

## 1. Stack

- **Vitest** for unit + integration.
- **`@testing-library/react`** for component tests (sparingly — UI changes fast at hackathon pace).
- **Playwright** only for the one end-to-end happy-path test (skip if time-pressed).

`package.json` scripts:
```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:integration": "vitest run --dir tests/integration",
  "test:e2e": "playwright test"
}
```

---

## 2. Unit tests

### Per-agent fixtures (`tests/fixtures/intents/`)

JSON files. 3 per language × 6 categories = ~18 inputs.

```json
// tests/fixtures/intents/ur-latn-ac-tomorrow.json
{
  "raw_text": "Mujhe kal subah G-13 mein AC technician chahiye",
  "locale": "ur-Latn",
  "selected_user_location": { "city": "Islamabad", "town_or_area": "G-13", "point": { "lat": 33.65, "lng": 72.95 } },
  "expected": {
    "service_slug": "ac_repair",
    "urgency": "tomorrow",
    "location.source": "user_mentioned",
    "time.iso": "matches /T09:00:00\\+05:00$/"
  }
}
```

### `tests/unit/agents/intent-parser.test.ts`

```ts
import.each([...allFixtures])('parses %s', async ({ raw_text, expected }) => {
  const out = await intentParser.run({ raw_text, ... });
  expect(out.service_slug).toBe(expected.service_slug);
  expect(out.location.source).toBe(expected['location.source']);
  expect(out.time.iso).toMatch(new RegExp(expected['time.iso']));
});
```

### Other agent tests

| Agent | What to assert |
|---|---|
| Planner | Each event → correct plan; LLM failure → deterministic fallback |
| Discovery | DB-only + Places merge; dedup correctness on synthetic name pairs; adaptive radius bumps |
| Ranking | Composite math; low-confidence threshold; bilingual reasoning shape |
| Booking | Idempotency on `(run_id, slot)`; exclusion-constraint error path; `notify_provider` chain order |
| Follow-up | Each mode → correct DB writes + reminder enqueues |

---

## 3. Tool tests (`tests/unit/tools/`)

- Pure unit: input/output Zod validation; fallback paths (Google off).
- Mock Google/HTTP using `msw` (Mock Service Worker).

---

## 4. Integration test (`tests/integration/agent-flow.test.ts`)

Boots a test Supabase project (separate from dev) via `supabase start`, runs the canonical query, asserts:
- Trace rows for all 4 runs joined by `run_id`.
- `bookings` row with correct status transitions.
- `reminders` table has 2 queued rows after `booking_confirmed`.
- `mock_messages` row exists when WhatsApp creds absent.

---

## 5. E2E happy path (`tests/e2e/canonical.spec.ts`)

Single Playwright test:
1. Sign up Ayesha → onboard one location.
2. Run canonical Roman Urdu query.
3. Assert 3 cards visible + invitation pending screen.
4. Programmatically POST to `/api/provider/accept` with the token from DB.
5. Assert confirmation screen appears (Realtime flip).

Skip if browser automation isn't budgeted; manual repro on the deployed URL is fine.

---

## 6. CI (optional)

If pushing to GitHub: a `.github/workflows/ci.yml` running `pnpm install && pnpm test && pnpm build` on every PR. Free on public repos.

---

## 7. Manual QA checklist (run before demo recording)

| Surface | Check |
|---|---|
| Auth | Signup → email verify → signin → forgot → reset → change-password |
| Onboarding | Cannot reach `/chat` without a location; pin drop reverse-geocodes |
| Chat | Roman Urdu query works; in-process VIEW animates; 3 cards arrive |
| Booking | Invitation pending shows channel badge; confetti on confirm |
| Provider | Realtime invitation appears in <2s; Accept flips customer screen |
| Acceptance page | Works without login; rate-limited |
| Reminders | `select drain_due_reminders();` fires push within seconds |
| PWA | Install → standalone mode → push subscription works |
| Trace | Drawer streams; export JSON downloads; replay re-runs the workflow |
| Demo | All 4 prefilled queries succeed |
| RTL | Urdu locale flips layout direction |
| Mobile | Works at 360 px wide |
| Offline | Service worker shell loads; bookings cached |

---

## Acceptance for 13-testing

- [ ] At least 3 fixtures per language committed.
- [ ] Each agent has a passing unit test.
- [ ] One green integration test for the canonical flow.
- [ ] Manual QA checklist completed before recording the demo video.
