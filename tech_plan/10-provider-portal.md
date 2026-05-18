# 10 — Provider Portal

Onboarding wizard, dashboard inbox, login-free acceptance page, settings.

[← back to README](./README.md) · scope: [ui-screens.md § Provider-side screens](../scope/ui-screens.md#provider-side-screens) · [user-journey.md § 2](../scope/user-journey.md#2-business-owner-journey--i-want-bookings) · [features.md § B](../scope/features.md#b-business--provider-portal)

---

## 1. Provider auth

Same Supabase Auth (email/password) but `users_profile.role = 'provider'` or check existence of a `providers` row owned by the user. Routing helper:

```ts
// lib/auth/role.ts
export async function getRole(user) {
  const p = await db.from('providers').select('id').eq('owner_user_id', user.id).limit(1);
  return p.data?.length ? 'provider' : 'customer';
}
```

The same `/auth/signup` page works for providers; after signup, route to `/for-business/onboarding` if they came from the business landing.

---

## 2. Provider landing (`app/(provider)/provider/page.tsx` → redirect, plus `/for-business`)

- Static RSC marketing page.
- Big CTA `<List your service>` → `/auth/signup?next=/provider/onboarding`.

---

## 3. Onboarding wizard (`app/(provider)/provider/onboarding/`)

5 steps, each its own route or query-step:

| Step | File | Saves |
|---|---|---|
| 1 — Basics | `step-1.tsx` | name, owner, photo upload (Supabase Storage bucket `provider-photos` — public, free 1 GB tier). If user skips upload → render a DiceBear avatar `https://api.dicebear.com/9.x/initials/svg?seed=<business_name>` (free, no key, no setup). |
| 2 — Categories | `step-2.tsx` | multi-select |
| 3 — Service area | `step-3.tsx` | map polygon OR pin + radius OR sector dropdown |
| 4 — Hours & price | `step-4.tsx` | `weekly_hours` jsonb + `price_band` |
| 5 — Notify prefs | `step-5.tsx` | phone, OTP verify (optional), `whatsapp_opt_in`, `sms_opt_in` → publish |

Progress saved per step via `PATCH /api/providers/[id]`.

### Service area editor (`components/provider/service-area-editor.tsx`)

Two modes:
- **Pin + radius** — drop pin → slider 1–20 km → stores `hub_location` + `service_radius_km`.
- **Polygon draw** — click-to-add vertices on Google Map → stores `service_area` (PostGIS Polygon).
- Toggle between modes; only one persists.

### Phone OTP

Use Supabase Auth's `signInWithOtp({ phone })` flow purely for verification (don't change the session). Or use Twilio Verify if Supabase phone auth isn't enabled.
- If neither configured → mock OTP: accept any 6-digit code, set `phone_verified=true`. Mark with a `MOCK_OTP` warning badge in the UI for the demo.

---

## 4. Provider dashboard (`app/(provider)/provider/dashboard/page.tsx`)

### Layout
- KPIs row: pending invitations · confirmed today · completion rate · rating.
- Tabs: Invitations | Today | Upcoming | Past.
- Each Invitation row: customer name, service, slot, location, **15-min countdown**, channel badge → Accept / Reject buttons.

### Realtime subscription

```ts
// 'use client'
useEffect(() => {
  const channel = supabase.channel(`provider_dashboard:${providerId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings', filter: `provider_id=eq.${providerId}` }, payload => {
      addInvitation(payload.new);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `provider_id=eq.${providerId}` }, payload => {
      updateInvitation(payload.new);
    })
    .subscribe();
  return () => { channel.unsubscribe(); };
}, [providerId]);
```

### Accept / Reject actions
- Accept → `POST /api/provider/accept { token }` (uses the provider's `invitation_token` directly since they're authenticated and own the booking).
- Reject → `POST /api/provider/reject { token }`.

---

## 5. Acceptance page — login-free (`app/(provider)/provider/accept/[token]/page.tsx`)

Mobile-first. Renders without auth.

```tsx
// Server component
export default async function AcceptPage({ params }) {
  const booking = await admin.from('bookings').select('*, providers(business_name)').eq('invitation_token', params.token).single();
  if (!booking.data) return <NotFound />;
  if (booking.data.status !== 'invitation_sent') return <AlreadyHandled status={booking.data.status} />;
  return <AcceptUI booking={booking.data} />;
}
```

`<AcceptUI>`:
- Big card: customer name, service, slot, location.
- Countdown to expiry.
- Two big buttons: `<Accept>` / `<Reject>` → POST to `/api/provider/accept` or `/api/provider/reject` with the token.
- After action: thank-you screen + CTA "Sign in to your dashboard".

Rate limiting: 5 requests/minute per IP per token (Upstash-free rate limit OR a simple in-memory map for hackathon).

---

## 6. Settings (`app/(provider)/provider/settings/page.tsx`)

- Edit any onboarding field.
- Toggle WhatsApp/SMS opt-in.
- Blackout date picker (calendar UI).
- Public profile preview (renders `<ProviderCard>` with current data).

---

## 7. Provider-side i18n

Per scope, provider portal is English-only for hackathon scope. No `ur` strings needed.

---

## Acceptance for 10-provider-portal

- [ ] New provider can complete the 5-step wizard in under 90 seconds (timed).
- [ ] Published provider is immediately discoverable (run Discovery agent test).
- [ ] Dashboard Realtime: invitation appears within 2 seconds of being created.
- [ ] Acceptance page works without logging in; token-only.
- [ ] Accept → customer's screen flips to Confirmed (verified in customer window).
- [ ] Reject → customer notified; recommendation list re-renders without that provider.
- [ ] 15-min auto-expiry tested by waiting (or by setting `invitation_sent_at` to 16 min ago in SQL and running the sweep).
- [ ] WhatsApp opt-in toggle persists and is respected by `notify_provider`.
