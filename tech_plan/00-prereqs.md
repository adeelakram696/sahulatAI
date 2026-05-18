# 00 — Prerequisites

Everything that must exist *before* the hackathon clock starts. Target: 30–45 min total.

[← back to README](./README.md)

---

## Accounts to provision

| Service | Why | Free tier | Owner |
|---|---|---|---|
| **Google Antigravity IDE** | Mandatory agent orchestration (confirmed available) | yes | Agent lead |
| **Google Cloud Project** | Maps JS / Places / Geocoding / Distance Matrix | $200/mo Maps credit + $300/90-day trial | Data lead |
| **Supabase** | Postgres + Auth + Realtime + pg_cron + pg_net + PostGIS | Free tier suffices for hackathon | Data lead |
| **Vercel** (Hobby plan) | Hosting + Fluid Compute | Free | Frontend lead |
| **Google AI Studio** (Gemini API key) | Direct-Gemini fallback if Antigravity SDK has gaps | Free tier (generous) | Agent lead |
| **Meta WhatsApp Cloud API** (optional) | Provider invitation channel | 1000 conversations/mo | Data lead — stretch |
| **Twilio** (optional) | SMS fallback channel | $15 trial credit | Data lead — stretch |

---

## Tool versions

- **Node.js 24 LTS** (Vercel default).
- **pnpm 9+** (project standard).
- **Supabase CLI** (`brew install supabase/tap/supabase`).
- **Vercel CLI** (`pnpm i -g vercel`).
- **gcloud CLI** (optional; only if managing GCP from terminal).

---

## Keys to generate

Run all of these in Phase 0 so Phase 1 never blocks on a missing key.

1. **Google Cloud API keys** (Console → APIs & Services → Credentials):
   - **Server key** — unrestricted for now, will lock down before deploy.
   - **Browser key** — restricted by HTTP referrer to `localhost:3000/*` and `*.vercel.app/*`.
   - Enable APIs: Maps JavaScript API · Places API (New) · Geocoding API · Distance Matrix API.

2. **Antigravity credentials** — copy API key + project id from the IDE settings.

3. **Supabase project credentials**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only — never expose).

4. **VAPID keys** for Web Push:
   ```bash
   npx web-push generate-vapid-keys
   ```
   → `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.

5. **Shared secret for reminders endpoint** (random 32-byte hex):
   ```bash
   openssl rand -hex 32
   ```
   → `REMINDERS_FIRE_SECRET`.

6. **(Optional) WhatsApp Cloud API** test phone + token from Meta developer console.
7. **(Optional) Twilio Account SID + Auth Token + verified test number** from Twilio console.

---

## Env var checklist (single source of truth)

`.env.local` template (gitignored). Final values via `vercel env add`.

```bash
# --- Server-only ---
ANTIGRAVITY_API_KEY=
ANTIGRAVITY_PROJECT_ID=
GOOGLE_MAPS_SERVER_KEY=
GOOGLE_GEMINI_API_KEY=         # fallback only — used if Antigravity SDK lacks LLM access
SUPABASE_SERVICE_ROLE_KEY=
VAPID_PRIVATE_KEY=
REMINDERS_FIRE_SECRET=

# Optional outbound channels
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# --- Public (browser) ---
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=
NEXT_PUBLIC_USE_GOOGLE_APIS=true
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Repo bootstrap step (one-time)

```bash
cd /Users/adeelakram/Documents/projects/self/google-hackathon
git init
echo "node_modules\n.env.local\n.vercel\n.next" > .gitignore
git add . && git commit -m "Initial scope and tech plan"
```

(Remote: create a GitHub repo + push when ready. Optional for hackathon.)

---

## Acceptance for Phase 0

- [ ] Every team member has Antigravity IDE access verified.
- [ ] Google Cloud project exists, 4 APIs enabled, both keys generated.
- [ ] Supabase project created, all 3 keys captured.
- [ ] Vercel project linked to Supabase via Marketplace.
- [ ] Gemini API key generated from Google AI Studio (fallback path).
- [ ] VAPID keys generated and stored.
- [ ] Shared secret generated.
- [ ] `.env.local` populated locally on every dev machine.
- [ ] Team roles confirmed (see [milestones.md](../scope/milestones.md) suggested assignment).
