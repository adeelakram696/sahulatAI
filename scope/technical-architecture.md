# Technical Architecture

[← back to scope.md](./scope.md) · related: [agent-workflow.md](./agent-workflow.md) · [data-model.md](./data-model.md) · [google-apis.md](./google-apis.md)

---

## High-level diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                       PWA (Next.js 16 App Router)                     │
│  ┌────────────────┐   ┌──────────────────┐   ┌────────────────────┐  │
│  │  Customer UI   │   │   Provider UI    │   │  Trace Viewer UI   │  │
│  │  /chat /book   │   │  /provider/*     │   │  /trace/[id]       │  │
│  └────────┬───────┘   └────────┬─────────┘   └────────┬───────────┘  │
└───────────┼────────────────────┼──────────────────────┼──────────────┘
            │                    │                      │
            ▼                    ▼                      ▼
   ┌────────────────────────────────────────────────────────────┐
   │     Next.js Route Handlers (Vercel Fluid Compute)          │
   │   /api/agent/run · /api/bookings · /api/providers          │
   └────────┬──────────────────────────────────────────┬────────┘
            │                                          │
            ▼                                          ▼
   ┌──────────────────────────┐               ┌─────────────────────┐
   │   Google Antigravity     │               │   Supabase          │
   │   ┌────────────────────┐ │               │   (Postgres + Auth  │
   │   │ Planner Agent      │ │               │    + Realtime + RLS)│
   │   │ ├ Intent Parser    │ │  RPC writes   │  - providers        │
   │   │ ├ Discovery        │◀┼───────────────│  - bookings         │
   │   │ ├ Ranking          │ │               │  - agent_traces     │
   │   │ ├ Booking          │ │   subscribe   │  - reminders        │
   │   │ └ Follow-up        │ │◀──────────────│  - ratings          │
   │   └────────┬───────────┘ │               └─────────────────────┘
   └────────────┼─────────────┘
                │ tool calls
                ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │  Tools (registered with Antigravity)                            │
   │  • google_places_search   • google_distance_matrix              │
   │  • google_geocode         • supabase_rpc(provider_search)       │
   │  • supabase_rpc(create_booking)   • scheduler.enqueue_reminder  │
   │  • llm_translate_urdu     • web_push.send                       │
   └─────────────────────────────────────────────────────────────────┘
```

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router)** | PWA-friendly, RSC for the trace viewer, Server Actions for booking. |
| Runtime | **Node.js 24 LTS on Vercel Fluid Compute** | Default; warm instances reduce agent latency. |
| Lang | **TypeScript strict** | — |
| UI | **Tailwind + shadcn/ui + Radix + Framer Motion** | Fast to compose; Motion great for trace animations. |
| State | **TanStack Query** + **Zustand** | Server cache + client UI state. |
| Auth | **Supabase Auth** (email + password, forgot/change password via Supabase email templates) | Free, fast, RLS-friendly. |
| DB | **Supabase Postgres** | Provisioned via Vercel Marketplace; Realtime for booking inbox. |
| Agent orchestration | **Google Antigravity** *(mandatory)* | All workflows, planning, tool calls. |
| LLM | **Antigravity LLM directly** (Gemini under the hood); direct `@google/generative-ai` SDK as gap-fallback | Maximizes Antigravity rubric weight; Antigravity native trace + our `agent_traces` mirror cover observability. |
| Maps | **Google Maps JS API**, **Places (New)**, **Geocoding**, **Distance Matrix** | All in one Google project. |
| i18n | **next-intl** | App-Router native, RTL support. |
| Voice in | **Web Speech API** | Browser-native, no cost. |
| PWA | **`next-pwa`** *(or hand-rolled manifest + SW)* | Installable + offline shell. |
| Push | **Web Push (VAPID)** | Standards-based, works on mobile Chrome + desktop. |
| Hosting | **Vercel** with `vercel.ts` | Single deploy, preview URLs per PR. |

---

## Repo layout (Next.js App Router monolith — single deployment)

```
google-hackathon/
├── scope/                         # this folder
├── app/
│   ├── (marketing)/
│   │   ├── page.tsx               # Landing
│   │   └── for-business/page.tsx
│   ├── (auth)/
│   │   ├── signup/page.tsx
│   │   ├── signin/page.tsx
│   │   ├── forgot/page.tsx
│   │   └── reset/page.tsx
│   ├── (customer)/
│   │   ├── onboarding/location/page.tsx
│   │   ├── chat/page.tsx          # Main chat surface
│   │   ├── bookings/page.tsx      # My bookings
│   │   ├── booking/[id]/page.tsx  # Receipt + tracking
│   │   └── profile/
│   │       ├── locations/page.tsx
│   │       └── security/page.tsx
│   ├── (provider)/
│   │   └── provider/
│   │       ├── onboarding/        # 5-step wizard
│   │       ├── dashboard/page.tsx
│   │       ├── accept/[token]/page.tsx  # mobile-first acceptance page (no login required)
│   │       └── settings/page.tsx
│   ├── (trace)/
│   │   └── trace/[runId]/page.tsx
│   ├── api/
│   │   ├── agent/run/route.ts            # POST → kicks off Antigravity workflow (streams)
│   │   ├── agent/trace/route.ts          # SSE stream of trace events
│   │   ├── bookings/route.ts
│   │   ├── providers/route.ts
│   │   ├── ratings/route.ts
│   │   ├── reminders/fire/route.ts       # Called by Supabase pg_cron via pg_net (shared-secret header)
│   │   ├── provider/accept/route.ts      # Server action for invitation acceptance
│   │   ├── locations/route.ts            # CRUD on user_locations
│   │   ├── auth/                         # password reset callbacks if not handled by Supabase directly
│   │   └── push/subscribe/route.ts
│   ├── manifest.webmanifest
│   └── layout.tsx                 # locale provider, theme, PWA registration
├── components/
│   ├── chat/
│   ├── provider-card/
│   ├── trace-drawer/
│   ├── map/                       # Google Maps wrapper
│   └── ui/                        # shadcn primitives
├── lib/
│   ├── antigravity/
│   │   ├── client.ts              # Antigravity SDK init
│   │   ├── agents/
│   │   │   ├── planner.ts
│   │   │   ├── intent-parser.ts
│   │   │   ├── discovery.ts
│   │   │   ├── ranking.ts
│   │   │   ├── booking.ts
│   │   │   └── followup.ts
│   │   └── tools/
│   │       ├── places.ts
│   │       ├── distance-matrix.ts
│   │       ├── geocode.ts
│   │       ├── supabase-rpc.ts
│   │       ├── scheduler.ts
│   │       └── push.ts
│   ├── supabase/
│   │   ├── server.ts
│   │   ├── client.ts
│   │   └── types.ts               # generated
│   ├── pwa/
│   │   └── service-worker.ts
│   └── i18n/
│       ├── en.json
│       ├── ur.json
│       └── ur-Latn.json
├── public/
│   ├── icons/                     # PWA icons (192, 256, 384, 512, maskable)
│   └── og.png
├── supabase/
│   ├── migrations/
│   └── seed.sql                   # demo providers + sample bookings
├── vercel.ts
├── next.config.ts
├── package.json
└── README.md
```

---

## API contracts (high level)

### `POST /api/agent/run`

```ts
// request
{
  message: string,          // raw user input, any language
  locale: "en" | "ur" | "ur-Latn",
  coords?: { lat: number, lng: number },
  fallbackLocation?: string // typed location if geo denied
}

// response: streaming SSE of trace events, terminating with:
{
  runId: string,
  intent: { service: string, location: string, time: string, confidence: number },
  recommendations: ProviderRecommendation[],
  needsClarification?: { question_en: string, question_ur: string }
}
```

### `POST /api/bookings`

```ts
{
  providerId: string,
  serviceCategory: string,
  slot: string,             // ISO datetime
  contact: { name: string, phone: string },
  runId: string             // ties back to agent trace
} → { bookingId, status: "confirmed" }
```

### `GET /api/agent/trace?runId=...`

SSE stream re-playable from `agent_traces` table — used by the live drawer and by the trace replay screen.

---

## Reminder driver (Supabase `pg_cron`)

The team is on **Vercel Hobby** which doesn't have ≤1-day cron granularity. Free workaround using Supabase built-ins:

```
┌──────────────────────────────────┐    every minute
│   Supabase Postgres              │  ──────────────▶  pg_cron schedule
│   ┌────────────────────────────┐ │
│   │ drain_due_reminders() SQL  │ │  ──pg_net.http_post──▶  https://<app>.vercel.app/api/reminders/fire
│   │  - SELECT * FROM reminders │ │                          Authorization: Bearer <SHARED_SECRET>
│   │    WHERE due_at <= now()   │ │
│   │      AND status = 'queued' │ │
│   │  - FOR EACH: http_post(…)  │ │
│   │  - UPDATE status='sent'    │ │
│   └────────────────────────────┘ │
└──────────────────────────────────┘
                                          │
                                          ▼
                              ┌───────────────────────────┐
                              │  /api/reminders/fire       │
                              │  - verify shared secret    │
                              │  - send web push           │
                              │  - send WhatsApp/SMS       │
                              │  - update booking.status   │
                              └───────────────────────────┘
```

Setup is two SQL statements (`create extension pg_cron;`, `create extension pg_net;`) + a scheduled function. Costs $0. Failure path: mark reminder `failed`, retry next minute up to 5 attempts, then alert.

This same driver is also what triggers the **invitation timeout** sweep — every minute, bookings with `status='invitation_sent'` and `invitation_sent_at < now() - interval '15 min'` are auto-rejected.

---

## Performance & latency budget

| Stage | Budget | Strategy |
|---|---|---|
| Page TTI | < 2 s | RSC + minimal client JS on landing/chat |
| Antigravity full run | 4–8 s | Stream every agent step; mask with animated trace |
| Map load | < 1 s after recs return | Lazy-load Google Maps JS only after recs |
| Booking write | < 500 ms | Direct Supabase RPC, no LLM in path |

---

## Security & RLS notes

- **Supabase RLS** enabled on all tables.
- Customers can read their own bookings (by `customer_phone` hash on anon, or `auth.uid()` when signed in).
- Providers can read/update bookings where `provider_id = auth.uid()`.
- `agent_traces` are public-read for the run owner (so the trace drawer works) but write-only from server.
- All Google API keys server-side via Antigravity tool wrappers — never exposed to client.
- Maps JS uses a referer-restricted browser key.

---

## Deployment

- **`vercel.ts`** with project config (rewrites, headers, crons).
- One Vercel project; previews per branch.
- Supabase provisioned via Vercel Marketplace → env vars auto-set.
- Google Maps API key + Antigravity creds set via `vercel env`.

See [milestones.md](./milestones.md) for setup ordering.
