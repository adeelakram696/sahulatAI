# Open Questions — RESOLVED (2026-05-18)

All 14 questions resolved before Phase 0. Defaults that weren't overridden are explicitly accepted.

[← back to README](./README.md)

---

## 🔴 Round-3 decisions (overrode defaults)

| # | Question | **Locked answer** | Implementation impact |
|---|---|---|---|
| **1** | Antigravity SDK vs custom wrapper? | **Trust the SDK first.** Register agents + tools natively with Antigravity. If a gap appears, swap to `lib/antigravity/runtime.ts` façade then. | No code change yet; Phase-0 smoke test is the trigger. |
| **2** | Vercel AI Gateway vs direct Gemini + Langfuse? | **Antigravity LLM directly.** Drop Gateway + Langfuse entirely. Use Antigravity's structured-output LLM. Direct `@google/generative-ai` SDK only as gap-fallback. | Removed `AI_GATEWAY_API_KEY` env; removed benchmark task; updated `05-antigravity-setup.md § 6`. |
| **3** | Phone OTP for provider — real or mock? | **Mock.** Any 6-digit code accepts. `MOCK_OTP` badge shown in UI. | `10-provider-portal.md § Phone OTP` already states this. |
| **9** | Customer outbound WhatsApp/SMS? | **Push-only for MVP.** No `users_profile.whatsapp_opt_in/sms_opt_in` flags this round. | `12-reminders-and-notify.md § 5` already marked optional/cut. |
| **4** | Provider photo storage? | **Supabase Storage** (free 1 GB tier) bucket `provider-photos`, public. **DiceBear initials avatar** fallback (`api.dicebear.com`) when no photo uploaded — free, no key, no setup. | `10-provider-portal.md § Onboarding step 1` updated. |

---

## 🟡 / 🟢 Defaults accepted as-is

| # | Question | Locked default |
|---|---|---|
| 5 | Demo account seeding | Auth admin API in `supabase/seed-auth.ts` |
| 6 | Local pg_cron testing | Manual SQL during dev; ngrok only for live E2E |
| 7 | Receipt PDF retention | Keep forever |
| 8 | Roman Urdu time-phrase resolution | Hand-curated lookup table + LLM fallback |
| 10 | Service area for Places-API providers | Distance-only filter; polygon only enforced for DB providers |
| 11 | Multiple concurrent bookings per slot | Cap = 1 (exclusion constraint) |
| 12 | LLM call budget | < $5 expected; monitor in Antigravity dashboard |
| 13 | Production analytics / errors | Vercel built-in logs only |
| 14 | Provider session lifetime | Supabase defaults (1 h access, ~7 d refresh) |

---

## Net effect on Phase 0 + Phase 1

- Skip: Vercel AI Gateway provisioning, Langfuse provisioning, benchmark script.
- Add: Google AI Studio account for `GOOGLE_GEMINI_API_KEY` (fallback only).
- Add: Supabase Storage bucket `provider-photos` (one CLI command).
- Add: DiceBear avatar helper component (`<ProviderAvatar src? name />` — 15 LOC).

Everything else proceeds as planned.

---

## When in doubt

1. **Free** — always the free option if it works.
2. **Mock-resilient** — every external dep has a mock path.
3. **Visible in trace** — if a step happens, it must show up in the trace drawer.
4. **Auth-first** — no anonymous paths except `/provider/accept/[token]`.
5. **Antigravity-native** — call Antigravity SDK directly wherever possible; wrap only on demonstrated gaps.
