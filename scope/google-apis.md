# Google APIs — surface + fallback plan

[← back to scope.md](./scope.md)

The rubric explicitly mentions Maps/Search/APIs. We hit several to maximize coverage while keeping the bill bounded.

---

## APIs used

| API | Purpose | Where it's called | Quota concern |
|---|---|---|---|
| **Google Antigravity** | Agent orchestration (mandatory) | All `lib/antigravity/agents/*` | Use sparingly; cache LLM prompts where possible. |
| **Gemini 2.x** (via Antigravity SDK directly) | LLM reasoning inside agents | All `lib/antigravity/agents/*` | Antigravity native; direct `@google/generative-ai` SDK as gap-fallback. |
| **Google Maps JavaScript API** | Map rendering on the client | `<Map>` component, customer + provider | Browser referer-restricted key. |
| **Google Places API (New) — Nearby Search** | Discover providers from Google when our DB is thin | `tools/places.ts` | Server-side; cache by `(category, h3 cell, day)`. |
| **Google Places API — Place Details** | Photo + opening hours + rating enrichment for a chosen Place | `tools/places.ts` | Called only for top-N candidates, not all. |
| **Google Geocoding API** | "G-13" → `{lat,lng}`; reverse geocoding for the map pin | `tools/geocode.ts` | Memoize sector → coords in a small static JSON for Islamabad. |
| **Google Distance Matrix API** | Distance + ETA from each candidate to the customer | `tools/distance-matrix.ts` | Batched: 1 origin × N destinations per request. |

Optional / stretch:
- **Google Translate API** — only if Gemini's translation is unsatisfactory for Roman Urdu (default to Gemini in Intent agent).
- **Google Calendar via deep link** — `https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=...&details=...&location=...`. **No API auth needed.** We render this URL as a button in the confirmation screen. For users not on Google Calendar, we also serve a `.ics` file (free, hand-rolled).

---

## Provider notification channels

Used by the `notify_provider` Antigravity tool (strategy fallback chain):

| Channel | When | Cost |
|---|---|---|
| Supabase Realtime push to dashboard | Provider has active dashboard session | Free (Supabase Realtime free tier) |
| **WhatsApp Cloud API** (Meta) | Provider opted in + has verified WhatsApp number | **Free for 1000 business-initiated conversations/month** on the test/sandbox tier. Setup: Meta developer account + a Meta-provided test phone number. |
| **Twilio SMS** | Provider opted in to SMS | **$15 free trial credit** for new accounts (~150–300 messages). |
| **Mock fallback** | No external creds, or external call fails | **Free, always works.** Writes to `mock_messages` table; UI surfaces a badge in the trace ("Sent to +92 300 555 01xx via WhatsApp ✓"). |

The mock path is critical: it means the *flow* of the demo works on day one without any external credentials. Real WhatsApp can be turned on later when credentials are ready, without changing the agent code (strategy switch in `notify_provider`).

---

## Why this combination

- Demonstrates **multiple Google APIs** working together (good for the rubric).
- Keeps **all sensitive keys server-side** behind Antigravity tools.
- **Maps JS** on client is the only place a Google key is exposed — locked to our domain via referer restrictions.

---

## Fallback plan (zero-API mode)

If quota is hit or keys aren't ready during the demo:

| Real API | Fallback |
|---|---|
| Places Nearby | Query `providers` table with `ST_DWithin` (PostGIS) only. |
| Geocoding | Static lookup table for Islamabad sectors (G-13, F-11, …) in `lib/geo/islamabad-sectors.json`. |
| Distance Matrix | Haversine formula in Postgres / TS. |
| Maps JS | Static map image via OpenStreetMap tiles (no key required) — only as last resort. |

Toggle: `NEXT_PUBLIC_USE_GOOGLE_APIS=true|false` in env. When `false`, the agents transparently use fallbacks. This lets us:
- Demo offline if needed.
- Run automated tests without burning quota.
- Keep the booking flow working even if external APIs fail.

---

## Env vars

Set via `vercel env`. Project-scoped, not committed.

```
# Server-only
ANTIGRAVITY_API_KEY=...
ANTIGRAVITY_PROJECT_ID=...
GOOGLE_MAPS_SERVER_KEY=...       # Places, Geocoding, Distance Matrix
GOOGLE_GEMINI_API_KEY=...        # Fallback only — used if Antigravity SDK lacks LLM access

# Public (browser)
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=...   # referer-restricted
NEXT_PUBLIC_USE_GOOGLE_APIS=true

# Supabase (auto-provisioned via Marketplace)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Web Push
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

---

## Cost guardrails

- Wrap each external tool with a per-run counter; if a single agent run exceeds N tool calls, abort with an error.
- Daily quota check via Vercel Cron — disables non-essential APIs if approaching limit.
- LLM call results memoized in-process per `run_id` (cheap demo-retry resilience without an external cache).

### Google Maps Platform free tier (as of 2026)

Hackathon-scale usage sits well inside the free band:

| SKU | Free monthly allotment | Our expected demo usage |
|---|---|---|
| Places API (New) — Nearby Search | ~10,000 calls / month | < 100 |
| Places API (New) — Place Details | ~10,000 calls / month | < 100 |
| Geocoding | ~10,000 calls / month | < 50 (most sectors are memoized) |
| Distance Matrix | ~10,000 elements / month | < 500 (batched: 1 origin × N destinations) |
| Maps JavaScript API | ~28,000 dynamic loads / month | < 200 |

On top of that:
- **$200 monthly credit** applies automatically to every Google Cloud account using Maps Platform.
- **$300 90-day free trial** for new accounts stacks on top.
- Bottom line: a hackathon with under ~500 full demo runs cannot meaningfully bill us. We don't need a special promo or research credit.

To stay safe regardless: server-side calls go through Antigravity tool wrappers that increment a counter; if we approach 80% of a SKU's free band in a day, a Vercel Cron alert fires.

---

## LLM path — Antigravity native (Round 3 lock-in)

LLM calls go through Antigravity's SDK directly. No Gateway, no Langfuse.

| Decision | Why |
|---|---|
| Use Antigravity LLM | Maximizes the 25% Antigravity rubric weight; one fewer network hop. |
| Drop Gateway | Wasn't blocking anything; observability is already covered by Antigravity trace + our `agent_traces` mirror. |
| Drop Langfuse | Third layer was insurance against Gateway latency; no longer relevant. |
| Direct Gemini SDK fallback | Used only if Phase-0 smoke test shows Antigravity SDK can't do structured-output LLM calls. Single `GOOGLE_GEMINI_API_KEY` env var. |

**`agent_traces` remains the UI source of truth.** Antigravity's own trace is supplementary.
