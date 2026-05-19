# 17 — Dynamic pricing + 8-factor matching + complexity

Rubric-critical: this lifts matching quality (25%) and pricing (part of 15%) from 5/6 factors and zero-pricing to full coverage.

[← back to README](./README.md) · scope: [features.md C1–C3, A16](../scope/features.md)

---

## DB changes (new migration columns)

**`providers` adds:**
- `on_time_score numeric(3,2) DEFAULT 0.85` — rolling on-time rate
- `cancellation_rate numeric(3,2) DEFAULT 0.05` — rolling cancel rate
- `last_review_at timestamptz` — most recent review for recency decay
- `risk_score numeric(3,2) DEFAULT 0` — derived (0 best, 1 worst)
- `specializations text[] DEFAULT '{}'` — e.g. `['ac_gas_refill', 'inverter_ac']`
- `capacity int DEFAULT 1` — concurrent jobs at the same time slot
- `base_visit_fee numeric DEFAULT 500` — fixed callout in PKR
- `base_hourly_rate numeric DEFAULT 800` — hourly in PKR

**`bookings` adds:**
- `price_breakdown jsonb` — full structured breakdown set by `compute_price`
- `complexity text CHECK IN ('basic','intermediate','complex')` — set by Intent Parser

---

## `compute_price` tool

Inputs: `provider_id`, `service_slug`, `slot_iso`, `user_location_point`, `complexity`, `urgency`, `customer_user_id`.

Algorithm:

```
hours_estimate = complexity === 'complex' ? 2.5 : complexity === 'intermediate' ? 1.5 : 1.0
base_visit_fee = provider.base_visit_fee
hourly = provider.base_hourly_rate × hours_estimate
distance_km = haversine(user_point, provider.hub_location) / 1000
distance_cost = max(0, (distance_km - 3) × 50)  // first 3 km free

subtotal = base_visit_fee + hourly + distance_cost

urgency_pct = { now: 25, today: 15, tomorrow: 0, this_week: -5 }[urgency]
complexity_pct = { basic: 0, intermediate: 10, complex: 25 }[complexity]
surge_pct = activeBookingsInSameCategoryAndArea24h > 5 ? 20 : 0

loyalty_pct = customer's prior completed bookings: 0→0, 1-2→-5, 3-5→-10, 6+→-15

total_pct = urgency_pct + complexity_pct + surge_pct + loyalty_pct
total = round(subtotal × (1 + total_pct/100))
```

Output is JSON the UI renders as a line-item breakdown.

---

## Ranking changes — 8 factors

| Factor | Weight | Formula |
|---|---|---|
| Distance | 25 | `25 × (1 - min(distKm, 15)/15)` |
| Rating × recency | 20 | `20 × (rating/5) × recencyDecay(days_since_last_review)` |
| On-time score | 15 | `15 × on_time_score` |
| Availability (capacity-aware) | 10 | `available_now ? 10 : (next_within_24h ? 5 : 0)` |
| Cancellation rate (inverse) | 10 | `10 × (1 - cancellation_rate)` |
| Price-fit | 10 | user didn't say → 5 neutral; else compare against price_band |
| Language match | 5 | provider languages overlap user locale |
| User preference / returning | 5 | `5 × (priorBookingsWithProvider > 0 ? 1 : 0)` |

`recencyDecay(days)`:
- 0–30 days → 1.0
- 31–90 → 0.85
- 91–180 → 0.65
- 180+ → 0.4

Specialization bonus: if `intent.complexity === 'complex'` AND provider has matching specialization → +5 score (above the 100 ceiling is fine).

Trace per pick (visible in trace drawer):
```
Ali AC Services: 86/100
  distance: 22/25 (2.1km)
  rating:   18/20 (★4.7 × 0.95 recency)
  on-time:  13/15 (0.87)
  avail:    10/10 (open at 10 AM)
  cancel:    9/10 (0.05 rate)
  price:     5/10 (mid-band)
  language:  5/5
  pref:      0/5 (first booking)
  +5 specialization (gas_refill match for complex job)
```

---

## Intent Parser update

Add to its output:
```ts
complexity: z.enum(['basic', 'intermediate', 'complex'])
```

LLM prompt addition:
> Classify job complexity:
> - basic: single-task, no specialized tools (e.g. "fan ki switch lagao", "fridge clean")
> - intermediate: needs tools or 1-2 hours (e.g. "AC service kar do", "tap leak fix")
> - complex: multi-hour, specialized skill (e.g. "AC gas refill + cooling diagnostic", "whole-house wiring check")

Default to `basic` if unclear.

---

## Acceptance for 17

- [ ] Every booking row has populated `price_breakdown` jsonb after Phase A.
- [ ] Booking page renders the breakdown as a table.
- [ ] Structured summary card in chat shows price total + breakdown.
- [ ] Ranking trace shows all 8 factor scores per pick.
- [ ] Complex jobs route to providers with matching specialization more often than basic jobs.
- [ ] Returning customer sees -5/-10/-15% loyalty discount on subsequent bookings.
- [ ] Urgent ("now") booking shows +25% urgency line in breakdown.
