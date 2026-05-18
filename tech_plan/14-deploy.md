# 14 — Deploy & README

Vercel deploy, env config, smoke test, README structure.

[← back to README](./README.md) · scope: [milestones.md § Phase 7](../scope/milestones.md#phase-7--documentation--video-hours-4048--critical) · [requirements-review.md § README plan](../scope/requirements-review.md#readme-plan)

---

## 1. Vercel project

Already linked in [01-bootstrap.md](./01-bootstrap.md). For final deploy:

```bash
vercel --prod
```

### Env vars — apply to **Production + Preview**
```bash
vercel env add ANTIGRAVITY_API_KEY production preview
vercel env add ANTIGRAVITY_PROJECT_ID production preview
vercel env add GOOGLE_MAPS_SERVER_KEY production preview
vercel env add GOOGLE_GEMINI_API_KEY production preview   # fallback only — used if Antigravity SDK has gaps
vercel env add SUPABASE_SERVICE_ROLE_KEY production preview
vercel env add VAPID_PRIVATE_KEY production preview
vercel env add REMINDERS_FIRE_SECRET production preview
# optional channels
vercel env add WHATSAPP_PHONE_NUMBER_ID production preview
vercel env add WHATSAPP_ACCESS_TOKEN production preview
vercel env add TWILIO_ACCOUNT_SID production preview
vercel env add TWILIO_AUTH_TOKEN production preview
vercel env add TWILIO_FROM_NUMBER production preview
# public
vercel env add NEXT_PUBLIC_SUPABASE_URL production preview
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production preview
vercel env add NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY production preview
vercel env add NEXT_PUBLIC_USE_GOOGLE_APIS production preview
vercel env add NEXT_PUBLIC_VAPID_PUBLIC_KEY production preview
vercel env add NEXT_PUBLIC_APP_URL production preview
```

### After first prod deploy
1. Update Supabase Postgres app settings to point at production URL:
   ```sql
   alter database postgres set app.reminders_fire_url = 'https://<prod>.vercel.app/api/reminders/fire';
   ```
2. Update Google Maps browser-key referer restriction to include the prod domain.
3. Update Supabase Auth → URL configuration → Site URL = prod URL.

---

## 2. Smoke test (run on prod)

| Step | Expected |
|---|---|
| Visit prod URL on Android Chrome | Landing renders; "Install" prompt available |
| Install PWA | Standalone splash shown |
| Sign up + verify email | Verification email arrives; signin succeeds |
| Onboard location | Map pin saves; reverse-geocode returns Pakistan city |
| Run canonical Roman Urdu query | In-process VIEW animates; 3 cards arrive in < 8 s |
| Tap Book | Invitation pending screen with channel badge |
| Open `/provider/accept/<token>` in incognito | Page loads without auth; Accept works |
| After accept | Customer screen flips to Confirmed within 2 s |
| Hit `/api/reminders/fire` with wrong secret | 401 |
| Reduce a reminder's `due_at` to now and wait ≤ 60 s | Push notification arrives |
| Open `/trace/<runId>` | Full trace visible; export JSON works |

---

## 3. README structure (`/README.md` at repo root)

Per the [scope's README plan](../scope/requirements-review.md#readme-plan). Sections in this order:

1. **What this is** — 2-paragraph product pitch + screenshot.
2. **Live demo** — deployed URL + 4 sample queries + demo customer credentials + demo provider credentials.
3. **Architecture** — embed the diagram from [technical-architecture.md](../scope/technical-architecture.md) (use a Mermaid version if possible so GitHub renders it).
4. **How Antigravity is used** — list of 6 agents, list of 22 tools, screenshot of trace drawer.
5. **APIs / tools used** — table copied from [google-apis.md](../scope/google-apis.md).
6. **Data model** — short ER overview + link to `supabase/migrations/`.
7. **Local development** — clone, install, env, run.
8. **Demo mode** — how to trigger seeded queries (`/demo` URL).
9. **Agent trace export** — endpoint + sample JSON file in `docs/example-trace.json`.
10. **Assumptions** — informal-economy patterns we modeled (Islamabad sectors, language mix, mobile-first providers).
11. **Limitations & future work** — no payments, no real identity verification, no inbound WhatsApp, only outbound notifications.
12. **Team & credits** — names, Antigravity acknowledgement, scope/tech_plan folders.

---

## 4. Backup demo asset

Record a 5-min screen capture of the working app **before submission** even if you also do the live demo video. Upload to YouTube unlisted as a fallback.

---

## Acceptance for 14-deploy

- [ ] Production URL responds 200 + valid TLS.
- [ ] All env vars set in Vercel for Production + Preview.
- [ ] Smoke test table passes end-to-end on prod.
- [ ] README renders cleanly on GitHub with diagrams.
- [ ] `docs/example-trace.json` committed for judges who want to view a real run JSON.
- [ ] Backup screen capture exists.
