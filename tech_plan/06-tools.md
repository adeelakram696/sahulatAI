# 06 — Tools (22 of them)

One file per tool under `lib/antigravity/tools/`. All wired through the pattern in [05-antigravity-setup.md](./05-antigravity-setup.md). Source-of-truth for the list: [agent-workflow.md § Tool registry](../scope/agent-workflow.md#tool-registry-single-source-of-truth).

[← back to README](./README.md)

---

## Build order (build in this sequence so dependents can be unit tested)

1. LLM tools (`llm.*`) — agents can't run without them.
2. Google tools (`google.*`) — Discovery + Ranking can't run.
3. Supabase RPC tools — Discovery, Ranking, Booking, Follow-up need these.
4. Booking artifacts — `generate_receipt`, `generate_calendar_artifacts`, `llm.confirmation_message`.
5. Notification tools — `web_push.send`, `whatsapp.send_template`, `sms.send`, then `notify_provider` (strategy chain).
6. `mock.write_message` — fallback path, build last but ship with everything.

---

## 1. LLM tools (`lib/antigravity/tools/llm.ts`)

All share one file because they share an LLM client.

| Tool | Input | Output | Notes |
|---|---|---|---|
| `llm.plan` | `{ event, payload, run_id }` | `Plan` (see [agent-workflow.md § Planner](../scope/agent-workflow.md#1-planner-agent)) | Gemini Flash, JSON mode |
| `llm.translate_normalize` | `{ text, locale }` | `{ normalized: string }` | Roman Urdu → English internal form |
| `llm.parse_intent` | `{ raw_text, locale, selected_user_location, prior_intent? }` | `Intent` (see [§ Intent Parser](../scope/agent-workflow.md#2-intent-parser-agent)) | Structured output with Zod schema |
| `llm.embed` | `{ text }` | `{ vector: number[] }` | For category fuzzy match |
| `llm.score` | `{ candidates, intent }` | `{ scored: ScoredProvider[] }` | Returns the composite score breakdown |
| `llm.explain_bilingual` | `{ pick, intent }` | `{ en: string, ur: string }` | One sentence each |
| `llm.confirmation_message` | `{ booking, locale, phase }` (phase = `pending`/`confirmed`) | `{ en: string, ur: string }` | Booking chat-bubble copy |

Implementation tips:
- Use `generateObject` with Zod schemas for everything — no string-parsing.
- Cache `llm.embed` by text hash in Redis-or-Postgres for the demo loop.
- For composite scoring, prefer a deterministic computation in TS + LLM for the *reasoning* string. Saves cost and tokens.

---

## 2. Google tools

### `lib/antigravity/tools/places.ts`
- `google.places_nearby({ category, point, radius_m })` — Places API (New) `places:searchNearby`.
- `google.place_details({ place_id })` — `places.get` with fieldMask for rating, photos, hours.
- Map `service_categories.slug` → Places `includedTypes` table (e.g. `ac_repair` → `home_services` / `electrician`). Static table at top of file.

### `lib/antigravity/tools/geocode.ts`
- `google.geocode({ text | coords })` — forward + reverse.
- Memoize Islamabad sectors (`G-13` → `{lat, lng, city, town}`) in `lib/i18n/islamabad-sectors.json`. Cuts API calls and works offline.

### `lib/antigravity/tools/distance-matrix.ts`
- `google.distance_matrix({ origin, destinations })` — single origin, ≤25 destinations.
- Fallback: Haversine in TS when `NEXT_PUBLIC_USE_GOOGLE_APIS=false` or quota gate.

All three share `lib/antigravity/tools/_google-client.ts` that holds the server-side fetch helper with `GOOGLE_MAPS_SERVER_KEY`.

---

## 3. Supabase RPC tools

### `lib/antigravity/tools/supabase-rpc.ts`

| Tool | What it does |
|---|---|
| `supabase.search_providers({ service_slug, point, radius_km })` | Postgres function `search_providers_rpc` using PostGIS: filters by category, `ST_DWithin(hub_location, point, radius_km*1000)`, AND either `ST_Contains(service_area, point)` OR `point within service_radius_km`. Returns ≤15 rows. |
| `supabase.check_availability({ provider_id, slot_start, slot_end })` | RPC checks `bookings` for overlap + `providers.weekly_hours`/`blackout_dates`. Returns `{ available, next_available }`. |
| `supabase.create_booking({ ...args })` | Insert with `status='invitation_sent'`, fresh `invitation_token` (32-byte url-safe random). Returns `BookingRef`. Throws on exclusion-constraint violation. |
| `supabase.update_booking_status({ booking_id, status })` | Simple update. |
| `supabase.enqueue_reminder({ booking_id, kind, due_at })` | Insert into `reminders`. |

Each RPC is implemented as a Postgres function in `supabase/migrations/0008_rpcs.sql` (server-side logic, single round-trip, RLS bypassed via SECURITY DEFINER for service-role-only paths).

---

## 4. Booking artifacts

### `lib/antigravity/tools/receipt.ts`
- `generate_receipt({ booking_id })` — renders a React-PDF document to a Buffer, uploads to Supabase Storage bucket `receipts`, returns public URL.
- Receipt content: booking id, customer name, provider, slot, location, price band, reasoning excerpt, QR code (`qrcode` lib) of the booking id.

### `lib/antigravity/tools/calendar.ts`
- `generate_calendar_artifacts({ booking_id })` — builds:
  - `.ics` string (RFC 5545) — no library needed, ~30 LOC.
  - Google Calendar deep link: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=...&details=...&location=...`.
- Returns `{ ics_data_url, gcal_url }`.

---

## 5. Notification tools

### `lib/antigravity/tools/push.ts`
- `web_push.send({ user_id, title, body, url })` — see [04-pwa-and-push.md § Dispatch](./04-pwa-and-push.md#dispatch-server-side-libantigravitytoolspushts).

### `lib/antigravity/tools/whatsapp.ts`
- `whatsapp.send_template({ to_phone, template, variables })` — POST to `https://graph.facebook.com/v20.0/{phone_number_id}/messages`.
- If `WHATSAPP_ACCESS_TOKEN` not set, this tool **immediately** throws `NotConfiguredError` so `notify_provider` falls through.

### `lib/antigravity/tools/sms.ts`
- `sms.send({ to_phone, body })` — Twilio REST call.
- Same `NotConfiguredError` pattern.

### `lib/antigravity/tools/notify-provider.ts` — the strategy chain

```ts
export async function notifyProvider({ booking_id }: Input, ctx: ToolContext) {
  const booking = await loadBooking(booking_id);
  const provider = await loadProvider(booking.provider_id);

  // 1. Realtime: skip — Realtime is push-from-DB; the provider dashboard subscribes already.
  //    (We still emit a trace step recording "dashboard channel: subscribed/not".)

  // 2. WhatsApp
  if (provider.whatsapp_opt_in) {
    try {
      const ref = await whatsappSend(...);
      await markChannel(booking_id, 'whatsapp');
      return { channel: 'whatsapp', ref };
    } catch (e) { ctx.logger.warn('whatsapp failed', e); }
  }

  // 3. SMS
  if (provider.sms_opt_in) {
    try {
      const ref = await smsSend(...);
      await markChannel(booking_id, 'sms');
      return { channel: 'sms', ref };
    } catch (e) { ctx.logger.warn('sms failed', e); }
  }

  // 4. Mock (always succeeds)
  const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/provider/accept/${booking.invitation_token}`;
  const body = renderMockBody(booking, provider, acceptUrl);
  await admin.from('mock_messages').insert({ booking_id, channel: 'whatsapp', to_phone: provider.phone, body, accept_url: acceptUrl });
  await markChannel(booking_id, 'mock');
  return { channel: 'mock' };
}
```

> `mock.write_message` is folded into `notify-provider.ts` as the terminal path.

---

## 6. The all-tools registry

`lib/antigravity/tools/index.ts`:

```ts
export const ALL_TOOLS = {
  'llm.plan': llmPlan,
  'llm.translate_normalize': llmTranslateNormalize,
  'llm.parse_intent': llmParseIntent,
  'llm.embed': llmEmbed,
  'llm.score': llmScore,
  'llm.explain_bilingual': llmExplainBilingual,
  'llm.confirmation_message': llmConfirmationMessage,
  'google.places_nearby': placesNearby,
  'google.place_details': placeDetails,
  'google.geocode': geocode,
  'google.distance_matrix': distanceMatrix,
  'supabase.search_providers': searchProviders,
  'supabase.check_availability': checkAvailability,
  'supabase.create_booking': createBooking,
  'supabase.update_booking_status': updateBookingStatus,
  'supabase.enqueue_reminder': enqueueReminder,
  'notify_provider': notifyProvider,
  'whatsapp.send_template': whatsappSendTemplate,
  'sms.send': smsSend,
  'web_push.send': webPushSend,
  'generate_receipt': generateReceipt,
  'generate_calendar_artifacts': generateCalendarArtifacts,
} as const;
```

---

## Acceptance for 06-tools

- [ ] Every tool has its file + Zod input/output schemas.
- [ ] Every Google tool has a `NEXT_PUBLIC_USE_GOOGLE_APIS=false` fallback path.
- [ ] `notify_provider` mock path writes a row even with no WhatsApp/Twilio creds.
- [ ] Receipt PDF renders for a sample booking.
- [ ] Calendar artifacts open the right event in Google Calendar (manual test).
- [ ] `ALL_TOOLS` exports all 22 entries.
- [ ] Each tool has at least one unit test in `tests/unit/tools/`.
