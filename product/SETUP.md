# Setup Guide — SahuliatAI

Step-by-step setup for new contributors. Total time: ~30 minutes if all accounts are ready.

> Architecture, agents, and feature scope live in [`../scope/`](../scope/). Phase-by-phase build plans in [`../tech_plan/`](../tech_plan/).

---

## 1. Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 24 LTS (works with ≥ 20) | https://nodejs.org/ |
| pnpm | 9+ | `npm install -g pnpm` |
| Supabase CLI | latest | `brew install supabase/tap/supabase` |
| Vercel CLI | latest | `pnpm add -g vercel` |

---

## 2. Clone & install

```bash
cd product
pnpm install
cp .env.example .env.local
```

Now fill in `.env.local` using the keys below.

---

## 3. Get each required key

### 3.1 Supabase (free tier — required)

1. Create a project at https://supabase.com/dashboard.
2. **Project Settings → API**: copy these to `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` (Project URL)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon public key)
   - `SUPABASE_SERVICE_ROLE_KEY` (service role — **keep secret**)
3. **Project Settings → General**: copy "Reference ID" → `SUPABASE_PROJECT_REF`.
4. **Project Settings → Database → Connection string → URI**: pick **"Transaction pooler"**, replace `[YOUR-PASSWORD]` with your DB password, copy → `DATABASE_URL`. *(Used by `db:seed` via `psql` since the Supabase CLI removed `db execute`.)*

Install `psql` if you don't have it (macOS):
```bash
brew install libpq && brew link --force libpq
```

Then enable required extensions (already covered by the first migration, but verify in **Database → Extensions**): `postgis`, `pg_cron`, `pg_net`, `btree_gist`, `pgcrypto`.

### 3.2 Google Gemini (required — runtime LLM)

> Antigravity is the *IDE* you use to design and iterate agents during development. The **deployed** app calls Gemini directly. Build your agent prompts inside the Antigravity IDE, then port them into `lib/antigravity/agents/`. No runtime Antigravity keys are needed.

1. Go to https://aistudio.google.com/apikey.
2. Click **Create API key** (pick or create a Google Cloud project when prompted).
3. Copy the value into `GOOGLE_GEMINI_API_KEY` in `.env.local`.

Free tier: ~15 requests/minute for Gemini 2.0 Flash. More than enough for a hackathon demo. The app also runs without a Gemini key — it falls back to deterministic responses so you can develop UI without consuming quota.

### 3.3 Google Maps Platform (recommended — has generous free tier)

1. Create a project at https://console.cloud.google.com.
2. **APIs & Services → Library**: enable: **Maps JavaScript API**, **Places API (New)**, **Geocoding API**, **Distance Matrix API**.
3. **APIs & Services → Credentials → Create credentials**:
   - **Server key** (no restrictions for hackathon; tighten later) → `GOOGLE_MAPS_SERVER_KEY`
   - **Browser key** with HTTP referrer restriction (`http://localhost:3010/*`, `https://*.vercel.app/*`) → `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`

Don't have Maps keys yet? Set `NEXT_PUBLIC_USE_GOOGLE_APIS=false` — the app falls back to PostGIS + Haversine + static sectors. The full flow still works.

### 3.4 Web Push VAPID keys (required for push notifications)

```bash
pnpm vapid:generate
```

Copy the two keys printed:
- `VAPID_PUBLIC_KEY` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` ← same value
- `VAPID_PRIVATE_KEY`

### 3.5 Reminders endpoint secret (required)

```bash
openssl rand -hex 32
```

Copy to `REMINDERS_FIRE_SECRET`. Used by Supabase `pg_cron` when posting to `/api/reminders/fire`.

### 3.6 App URL (required)

```
NEXT_PUBLIC_APP_URL=http://localhost:3010
```

Update to your prod URL when deploying.

### 3.7 Optional channels

- **WhatsApp Cloud API** (1000 free conversations / month): create a Meta developer app and use the test phone number id + access token.
- **Twilio SMS** ($15 trial credit): account SID + auth token + verified test number.

If both are absent, `notify_provider` automatically writes to `mock_messages` — the demo flow still works.

---

## 4. Database setup

### One-time CLI authentication
The Supabase CLI needs its own access token (separate from the project keys above). Either:

```bash
# Option A — interactive (recommended for local dev)
pnpm exec supabase login
```

Or generate a token at https://supabase.com/dashboard/account/tokens and add to `.env.local`:
```bash
SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxxxxx
```

### Migrations + seeds
```bash
# Link CLI to your project
pnpm db:link

# Push migrations to the remote DB
pnpm db:push

# Seed categories + 30 demo providers
pnpm db:seed

# Create demo Auth users (Ayesha + Ali + Tutor)
pnpm db:seed:auth

# Generate TypeScript types from the live schema
pnpm db:types
```

After migrations, tell `pg_cron` where to POST by inserting two rows into `app_config` (Supabase's hosted Postgres denies the `alter database … set` privilege, so we use a table instead):

```sql
-- Run in Supabase SQL editor:
insert into public.app_config(key, value) values
  ('reminders_fire_url',    'http://localhost:3010/api/reminders/fire'),
  ('reminders_fire_secret', 'YOUR_REMINDERS_FIRE_SECRET')
on conflict (key) do update set value = excluded.value, updated_at = now();
```

For production, update the `reminders_fire_url` value to your deployed Vercel URL.

For local development, `pg_cron` runs inside Supabase Cloud and can't reach `localhost`. Either:
- Use `ngrok http 3010` and put the ngrok URL in `app_config.reminders_fire_url`, or
- Manually trigger a sweep when testing reminders:
  ```sql
  select public.drain_due_reminders();
  ```

---

## 5. Run the app

```bash
pnpm dev
```

Visit http://localhost:3010.

### Demo accounts (pre-seeded)

| Role | Email | Password |
|---|---|---|
| Customer (Ayesha) | `ayesha@example.com` | `Demo!1234` |
| Provider (Ali AC Services) | `ali@example.com` | `Demo!1234` |
| Provider (Bright Tutors) | `tutor@example.com` | `Demo!1234` |

Open two browser windows (one for customer, one for provider) to see the realtime two-phase booking flow.

---

## 6. Deploy to Vercel

### Env file strategy

Each environment has its own gitignored env file. The deploy script reads the right one based on target:

| Command | Env file used | Purpose |
|---|---|---|
| `pnpm dev` | `.env.local` | Local dev (`NEXT_PUBLIC_APP_URL=http://localhost:3010`) |
| `pnpm deploy:preview` | `.env.preview` (fallback `.env.local`) | Vercel preview deploys |
| `pnpm deploy:prod` | `.env.prod` (fallback `.env.local`) | Vercel production deploys |

Each file is the FULL set of vars for that environment. Typical differences:
- `NEXT_PUBLIC_APP_URL` — localhost vs `https://your-prod.vercel.app`
- `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` — separate keys with different referer restrictions (optional)
- Everything else (Supabase, Gemini, VAPID, REMINDERS_FIRE_SECRET) can be identical if you're using one Supabase project.

**Set up the prod env file:**
```bash
cp .env.local .env.prod
# Edit .env.prod and change NEXT_PUBLIC_APP_URL to your prod Vercel URL
# Optionally change NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY if you have a separate prod key
```

### First-time Vercel setup
```bash
# 1. (one-time) sign in to Vercel from this terminal
pnpm exec vercel login

# 2. (one-time) link this folder to a Vercel project
pnpm exec vercel link
```

### Every deploy
```bash
# Preview URL — uses .env.preview (or .env.local fallback)
pnpm deploy:preview

# Production URL — uses .env.prod (or .env.local fallback)
pnpm deploy:prod
```

The `deploy.sh` script does **everything** in order:
1. Picks the right env file based on target (`prod` → `.env.prod`, else `.env.preview`).
2. Validates required vars; bails with a friendly list if any are missing.
3. Runs `pnpm typecheck` and `pnpm build` locally as a fail-fast sanity check.
4. Pushes any new DB migrations to Supabase via `supabase db push`.
5. Logs into Vercel + links the project if needed.
6. **Pushes every env var from the chosen file to Vercel** for the target environment.
7. Runs `vercel deploy` (`--prod` for production).
8. Prints a **post-deploy checklist** with the actual deployed URL.

### Post-deploy reminders (the script tells you these)
After deploying:

1. **Update pg_cron URL** so reminders POST to the deployed app (run in Supabase SQL editor):
   ```sql
   update public.app_config
   set value = 'https://<your-vercel-url>/api/reminders/fire', updated_at = now()
   where key = 'reminders_fire_url';
   ```

2. **Supabase Auth → URL Configuration**:
   - Site URL: `https://<your-vercel-url>`
   - Add `https://<your-vercel-url>/**` to Redirect URLs

3. **Google Maps browser key** (if you set HTTP-referer restriction): add `https://<your-vercel-url>/*` to the allowed list.

4. **`NEXT_PUBLIC_APP_URL`** in `.env.local` and Vercel env: set to production URL so the WhatsApp / SMS / mock message body links work. Re-deploy after updating.

### Vercel project config

`vercel.json` is committed:
- `framework: nextjs` (auto-detected anyway)
- `regions: ["sin1"]` (Singapore — closest to Pakistan-based users; change if your users are elsewhere)
- Per-route `maxDuration` overrides for the agent run + reminders endpoints
- Service worker + manifest cache headers

---

## 7. Useful scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm typecheck` | TypeScript check (no emit) |
| `pnpm test` | Run unit + integration tests |
| `pnpm db:reset` | Push migrations + reseed |
| `pnpm db:types` | Regenerate Supabase types |
| `pnpm db:seed:auth` | Create demo Auth users |
| `pnpm vapid:generate` | Generate fresh VAPID keys |
| `pnpm env:pull` | Pull Vercel env into `.env.local` |
| `pnpm deploy:preview` | Deploy to Vercel preview |
| `pnpm deploy:prod` | Deploy to Vercel production |

---

## 8. Troubleshooting

- **`pnpm build` fails on missing module**: run `pnpm install` again; ensure Node ≥ 20.
- **Auth redirects loop**: check Supabase **Auth → URL Configuration** has the right Site URL and redirect URLs.
- **Push not delivering**: verify `VAPID_*` keys, that you accepted the browser prompt, and the PWA is installed on iOS.
- **`pg_cron` not firing**: confirm the two `alter database postgres set …` statements ran (they live in DB settings, not env).
- **Antigravity LLM errors**: temporary fallback to direct Gemini works automatically; set `GOOGLE_GEMINI_API_KEY` and restart.
- **Map tiles missing**: either set `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` with a referrer-restricted key or toggle `NEXT_PUBLIC_USE_GOOGLE_APIS=false`.
