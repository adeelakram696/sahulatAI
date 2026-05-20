# SahulatAI — System Requirements Implementation Plan

> Living document. Updated as each item is implemented.
> Status key: ⬜ pending · 🔄 in progress · ✅ done · ⏭ skipped (already built)

---

## What was already built (no work needed)

| Requirement | Status | Notes |
|---|---|---|
| Dynamic pricing | ✅ | `compute_price_rpc` + `lib/antigravity/tools/pricing.ts` — full breakdown incl. urgency, surge, loyalty, complexity |
| Booking simulation | ✅ | Two-phase invitation, WhatsApp/SMS/mock, calendar .ics, receipt PDF, DB write |
| Dispute & escalation workflow | ✅ | All dispute kinds, deterministic refund %, reputation triggers in DB |
| 8-factor provider ranking | ✅ | distance, rating×recency, on-time, availability, cancel-inverse, price-fit, language, user-pref |
| Multilingual i18n | ✅ | en/ur/ur-Latn message catalogs; intent parser handles Urdu/Roman Urdu/English |
| Service-quality status loop | ✅ | en_route → arrived → in_progress → completed status updates + push notifications |
| Robustness: Haversine fallback | ✅ | Google Distance Matrix → Haversine fallback already in ranking agent |
| Double-booking prevention | ✅ | EXCLUDE gist constraint on bookings + check_availability_rpc |

---

## Implementation Backlog

### P1 — High impact, fills real gaps

#### 1. Low-confidence confirmation flow
**Requirement**: When confidence is low (<0.5) show a clarification question before searching.

| Step | Status |
|---|---|
| Intent parser already emits `needs_clarification` field | ✅ |
| Conversation agent / runtime: pause and re-ask when `needs_clarification` is set | ✅ |
| Chat UI: render clarification question as a bot message with quick-reply chips | ✅ |

---

#### 2. Price-fit factor fix in ranking
**Requirement**: Use actual user budget preference in ranking (currently hardcoded neutral 5).

| Step | Status |
|---|---|
| Extract budget hint from intent parser (cheap/mid/premium keywords) | ✅ |
| Add `budget_preference` to Intent type | ✅ |
| Wire budget → price-fit factor in ranking agent | ✅ |

---

#### 3. Alternate slot suggestions + waitlist
**Requirement**: When provider unavailable, suggest 3 alternate slots; offer waitlist if none available.

| Step | Status |
|---|---|
| Add `suggest_alternate_slots` tool (query provider's next free windows) | ✅ |
| Add `booking_waitlist` table migration | ✅ |
| Wire alternate-slot suggestions into conversation/runtime | ✅ |
| Chat UI: render slot chips the user can tap to rebook | ✅ |
| Waitlist API route + join confirmation message | ✅ |

---

#### 4. Service-quality checklist + photo evidence
**Requirement**: Completion checklist for provider; photo/video evidence upload; feeds rating.

| Step | Status |
|---|---|
| `service_checklist` column already on bookings table | ✅ |
| Add `evidence_photos` column (text[] of storage URLs) to bookings | ✅ |
| Supabase Storage bucket `booking-evidence` (public read, auth write) | ✅ |
| Provider dashboard: checklist component with check-off UI | ✅ |
| Provider dashboard: photo upload card (≤5 photos) | ✅ |
| API route `PATCH /api/bookings/[id]/checklist` | ✅ |
| API route `POST /api/bookings/[id]/evidence` (upload + store URL) | ✅ |

---

### P2 — Medium impact

#### 5. Provider-side optimization dashboard
**Requirement**: Workload balance, earnings forecast, demand heatmap, recommended availability slots.

| Step | Status |
|---|---|
| Add `GET /api/provider/insights` route (earnings, utilization, top service hours) | ✅ |
| Provider dashboard: Earnings KPI card (week / month) | ✅ |
| Provider dashboard: Utilization bar (bookings this week vs. capacity) | ✅ |
| Provider dashboard: "Best time slots" recommendation strip | ✅ |

---

#### 6. Skill/job complexity → provider tier matching
**Requirement**: Classify job as basic/intermediate/complex and prefer providers with matching certifications/tools.

| Step | Status |
|---|---|
| Intent parser already classifies complexity | ✅ |
| Add `certifications` and `tools_required` columns to providers table | ✅ |
| Ranking agent: refine specialization bonus using certifications match | ✅ |
| Provider settings: add certifications + tools fields | ✅ |

---

#### 7. Auto-reschedule on provider cancellation
**Requirement**: When provider cancels, find next-best provider and offer re-booking automatically.

| Step | Status |
|---|---|
| Dispute/cancellation flow: detect provider cancellation | ⬜ |
| Trigger re-ranking with same intent, exclude cancelled provider | ⬜ |
| Push notification to customer with new provider suggestion | ⬜ |
| Customer can accept/decline the auto-rebook offer | ⬜ |

---

### P2 — Medium impact

#### 9. Portal-native provider ratings (SahuliatAI rating + Google rating)
**Requirement**: After a service is completed, the customer rates the provider — 5 stars + optional comment. The provider then carries TWO ratings: SahuliatAI's own portal rating and the Google Places rating. The UI shows both wherever a provider is surfaced.

| Step | Status |
|---|---|
| Split rating columns on `providers` — `google_rating`/`google_rating_count` (renamed from `rating_avg`/`rating_count`) + new `portal_rating`/`portal_rating_count` | ✅ |
| `ratings` table gets `provider_id` (denormalised); `recompute_provider_rating` trigger now updates the **portal** rating | ✅ |
| `ratings` SELECT RLS policy so both booking parties can read ratings | ✅ |
| `search_providers_rpc` + `providers_in_bbox` return both ratings | ✅ |
| Ranking agent prefers the portal rating, falls back to Google when no portal reviews exist | ✅ |
| Rating form — 5-star selector + optional comment on a completed booking → `POST /api/ratings` | ✅ |
| `RatingBadges` component — shows "SahuliatAI ★" + "Google ★" on provider cards, map, booking detail | ✅ |
| `/api/ratings` — `GET`, completed-booking guard, `409` on duplicate, stores `provider_id` | ✅ |

---

### P3 — Nice to have / robustness

#### 8. Maps/API failure explicit fallback
**Requirement**: Graceful degradation when Google Maps or Gemini is unreachable.

| Step | Status |
|---|---|
| Maps: Haversine fallback already in place | ✅ |
| Gemini: keyword fallback already in intent parser | ✅ |
| Add user-visible error message when both primary + fallback fail | ⬜ |
| Payment confirmation failure: show retry UI in chat | ⬜ |

---

## Change Log

| Date | Change |
|---|---|
| 2026-05-19 | Plan created. Audit complete — 8 existing features confirmed built. 7 gap items scoped across P1/P2/P3. |
| 2026-05-19 | P1.1 Low-confidence confirmation flow — implemented (intent-parser, conversation agent, chat UI) |
| 2026-05-19 | P1.2 Price-fit factor — budget_preference extracted in intent parser, wired into ranking agent |
| 2026-05-19 | P1.3 Alternate slot suggestions + waitlist — tool, migration, runtime, UI |
| 2026-05-19 | P1.4 Service-quality checklist + photo evidence — migration, storage, API routes, provider dashboard UI |
| 2026-05-19 | P2.5 Provider insights dashboard — API route + earnings/utilization/best-slots UI |
| 2026-05-19 | P2.6 Complexity → provider tier — certifications/tools migration, ranking update, settings UI |
| 2026-05-20 | P2.9 Portal-native ratings — `providers` rating columns split into `google_rating` + `portal_rating`; `ratings` table gains `provider_id`; trigger now feeds the portal rating; rating form on completed bookings; `RatingBadges` shows both ratings across chat / map / booking detail |
