# Data Model — Supabase Postgres

[← back to scope.md](./scope.md) · related: [technical-architecture.md](./technical-architecture.md) · [agent-workflow.md](./agent-workflow.md)

All tables have RLS enabled. `auth.uid()` ties to Supabase Auth.

---

## Tables

### `providers`
Self-onboarded businesses.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `owner_user_id` | `uuid` | FK → `auth.users` |
| `business_name` | `text` | |
| `slug` | `text unique` | for shareable URLs |
| `photo_url` | `text` | |
| `phone` | `text` | OTP-verified |
| `languages` | `text[]` | `["en","ur"]` |
| `categories` | `text[]` | enum slugs |
| `service_area` | `geometry(Polygon, 4326)` | PostGIS — drawn polygon |
| `service_radius_km` | `numeric` | alt to polygon |
| `hub_location` | `geography(Point, 4326)` | for distance calc |
| `weekly_hours` | `jsonb` | `{ mon: ["09:00","18:00"], ... }` |
| `blackout_dates` | `date[]` | |
| `price_band` | `jsonb` | `{ ac_repair: { min: 1500, max: 2500 } }` |
| `google_rating` | `numeric` | rating sourced from Google Places |
| `google_rating_count` | `int` | Google review count |
| `portal_rating` | `numeric` | SahuliatAI's own rating — avg of `ratings` (denormalized, trigger-maintained) |
| `portal_rating_count` | `int` | number of SahuliatAI customer ratings |
| `response_time_minutes` | `int` | rolling avg |
| `phone_verified` | `bool` | phone OTP done (only required if opted into WhatsApp/SMS) |
| `whatsapp_opt_in` | `bool` | provider receives invitations on WhatsApp |
| `sms_opt_in` | `bool` | provider receives invitations via SMS |
| `published` | `bool` | shown to discovery? |
| `source` | `text` | `"self_onboarded"` or `"places_api"` (for seeded entries) |
| `external_place_id` | `text` | Google Places id when imported |
| `avg_duration` | `interval` | typical job length; used to derive `slot_end` and completion check |
| `created_at` | `timestamptz` | |

Indexes: GIST on `service_area`, GIST on `hub_location`, GIN on `categories`.

---

### `users_profile`
Profile row per signed-in user, paired 1:1 with `auth.users`.

| Column | Type | Notes |
|---|---|---|
| `user_id` | `uuid pk` | FK → `auth.users.id` |
| `display_name` | `text` | |
| `phone` | `text` | optional, used for calls / WhatsApp invites if customer wants |
| `preferred_locale` | `text` | `"en" \| "ur" \| "ur-Latn"` |
| `default_location_id` | `uuid` | FK → `user_locations.id` (nullable) |
| `created_at` | `timestamptz` | |

---

### `user_locations`
Saved addresses per user. At least one required to make a request.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `user_id` | `uuid` | FK → `auth.users.id` |
| `label` | `text` | `"home"` / `"work"` / `"other"` (free text) |
| `address_text` | `text` | as user typed / picked |
| `point` | `geography(Point, 4326)` | from map pin |
| `city` | `text` | reverse-geocoded |
| `town_or_area` | `text` | sector / neighborhood from geocoding |
| `country_code` | `text` | ISO |
| `last_used_at` | `timestamptz` | for default-pick logic |
| `created_at` | `timestamptz` | |

RLS: only `user_id = auth.uid()` can read/write.

---

### `service_categories`
Reference data.

| Column | Type |
|---|---|
| `slug` | `text pk` |
| `name_en` | `text` |
| `name_ur` | `text` |
| `icon` | `text` |
| `keywords` | `text[]` | (incl. Roman Urdu — `["ac","cooling","th anda"]`) |

Seeded with: `ac_repair`, `plumber`, `electrician`, `tutor`, `beautician`, `carpenter`, `car_wash`, `mobile_repair`.

---

### `bookings`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `customer_user_id` | `uuid` | FK → `auth.users.id` (required — no anon flow) |
| `customer_user_location_id` | `uuid` | FK → `user_locations.id` (selected at request time) |
| `customer_name_snapshot` | `text` | denormalized at booking time |
| `customer_phone_snapshot` | `text` | denormalized at booking time |
| `customer_lang` | `text` | `"en" \| "ur" \| "ur-Latn"` |
| `provider_id` | `uuid` | FK → providers |
| `service_category` | `text` | FK → service_categories.slug |
| `slot_start` | `timestamptz` | |
| `slot_end` | `timestamptz` | |
| `location_text` | `text` | display label + address |
| `location_point` | `geography(Point, 4326)` | copied from `user_locations` at booking |
| `status` | `text` | `invitation_sent \| confirmed \| reminded \| in_progress \| completed \| cancelled \| rejected` |
| `invitation_token` | `text unique` | random token for the provider acceptance link |
| `invitation_channel` | `text` | `dashboard \| whatsapp \| sms \| mock` — actual channel used |
| `invitation_sent_at` | `timestamptz` | |
| `confirmed_at` | `timestamptz null` | |
| `price_estimate` | `jsonb` | `{ min, max, currency: "PKR" }` |
| `agent_run_id` | `uuid` | FK → agent_traces.run_id (the originating run) |
| `receipt_pdf_url` | `text` | |
| `notes` | `text` | from intent parser |
| `created_at`, `updated_at` | `timestamptz` | |

Indexes/Constraints: Exclusion Constraint on `(provider_id WITH =, tstzrange(slot_start, slot_end) WITH &&) WHERE status IN ('invitation_sent','confirmed','reminded','in_progress')` (requires `btree_gist` extension).

---

### `agent_traces`
The full audit log of every Antigravity run. Schema described in [agent-workflow.md](./agent-workflow.md#trace-persistence).

---

### `reminders`
Queue of scheduled follow-ups. Drained by **Supabase `pg_cron`** every minute (free; no Vercel Cron required). The SQL function `drain_due_reminders()` selects rows where `due_at <= now() AND status = 'queued'` and POSTs each via `pg_net.http_post` to `/api/reminders/fire` with a shared-secret header.

| Column | Type |
|---|---|
| `id` | `uuid pk` |
| `booking_id` | `uuid` |
| `kind` | `text` | `pre_appointment \| completion_check \| rating_prompt` |
| `due_at` | `timestamptz` |
| `status` | `text` | `queued \| sent \| failed` |
| `payload` | `jsonb` |
| `sent_at` | `timestamptz null` |

---

### `ratings`

SahuliatAI's own (portal) provider ratings — one per completed booking, submitted by the customer.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `booking_id` | `uuid unique` | one rating per booking |
| `provider_id` | `uuid` | denormalized from the booking, for clean aggregation |
| `stars` | `int 1..5` | |
| `comment` | `text` | optional free-text feedback |
| `created_at` | `timestamptz` | |

RLS: a customer may insert/read ratings for their own bookings; the provider on the booking may read them.
Trigger: on insert → recompute `providers.portal_rating` + `providers.portal_rating_count` (the SahuliatAI rating — distinct from the Google rating).

---

### `mock_messages`
When no free outbound channel is available, the `notify_provider` tool writes here instead of calling an external API. The trace drawer surfaces these so the demo story stays intact.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `booking_id` | `uuid` | FK → bookings |
| `channel` | `text` | `whatsapp \| sms` (the channel that *would* have been used) |
| `to_phone` | `text` | provider's phone |
| `body` | `text` | rendered message text |
| `accept_url` | `text` | tokenized acceptance link |
| `created_at` | `timestamptz` | |

---

### `push_subscriptions`

Standard Web Push subscription store keyed by user/anon-session id.

| Column | Type |
|---|---|
| `id` | `uuid pk` |
| `user_id` | `uuid null` |
| `anon_session` | `text null` |
| `endpoint` | `text` |
| `keys` | `jsonb` | `{ p256dh, auth }` |
| `created_at` | `timestamptz` |

---

## Seeded demo data

`supabase/seed.sql` seeds:
- 8 service categories with bilingual labels.
- **~30 providers** across categories, distributed in Islamabad sectors (G-13, F-11, F-10, I-8, etc.). Each has plausible hours, price bands, languages, ratings.
- **3 sample completed bookings** with ratings (so reputation panels look real on day one).
- A few **agent_traces** for completed runs (so the trace replay screen has something to show even before live runs).

This is critical for the demo video — judges shouldn't see an empty app.

---

## RLS sketch

```sql
-- providers: owner can mutate, everyone reads published
create policy "providers_read" on providers
  for select using (published = true);
create policy "providers_write" on providers
  for all using (owner_user_id = auth.uid());

-- bookings: customer or provider can read
create policy "bookings_read_customer" on bookings
  for select using (customer_user_id = auth.uid());
create policy "bookings_read_provider" on bookings
  for select using (provider_id in (select id from providers where owner_user_id = auth.uid()));
create policy "bookings_update_provider" on bookings
  for update using (provider_id in (select id from providers where owner_user_id = auth.uid()));

-- agent_traces: server-only writes; read for the run owner (via signed cookie or auth)
create policy "traces_read_owner" on agent_traces
  for select using (run_id::text = current_setting('request.jwt.claims', true)::jsonb->>'run_id');
```

(Final RLS to be hardened during build; this is the design intent.)

---

## Privacy & test data

Per the brief's guideline (*"Avoid use of real personal/sensitive data"*), all seeded and demo data must be unambiguously fake:

- **Phone numbers** — use the Pakistani non-routable test range, e.g. `+92 300 555 01xx` (clearly not a real number).
- **Names** — generic placeholders like *"Ali AC Services"*, *"Bright Tutors"*, *"Sector G-13 Plumber"* — no real business names from Google Maps even if Places API returns them; we substitute display names for seeded entries.
- **Emails** — `@example.com` only.
- **Photos** — placeholder avatars or AI-generated images; never scraped from real businesses.
- **Addresses** — sector-level only (e.g. "G-13, Islamabad"); never specific street/house numbers.
- **Live Places API results** — for providers we surface from Places at demo time, we do *not* persist their full details unless the business explicitly self-onboards. We show the public marker but flag them as `source = 'places_api'` and never write owner/contact info we don't have a right to.
- **Logs** — `agent_traces` strip phone numbers from inputs (kept only on `bookings.customer_phone`).

This is also called out in the README under *Assumptions & limitations*.
