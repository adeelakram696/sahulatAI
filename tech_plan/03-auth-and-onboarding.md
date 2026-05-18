# 03 — Auth & Customer Onboarding

Email/password auth, password reset, location onboarding wizard.

[← back to README](./README.md) · scope: [user-journey.md § 0](../scope/user-journey.md#0-customer-onboarding-journey--first-time-using-sahuliatai) · [ui-screens.md § Customer auth & onboarding](../scope/ui-screens.md#customer-auth--onboarding)

---

## 1. Supabase Auth config

In Supabase Dashboard → **Authentication → Providers → Email**:
- Enable Email/Password.
- **Disable** "Confirm email" only if we want skip-verification for hackathon demo (recommend keep enabled).
- Configure redirect URL: `https://<vercel-url>/auth/callback` and `http://localhost:3000/auth/callback`.

In **Auth → Email Templates**, lightly brand the 3 we use:
- Confirm signup
- Magic Link (unused but customize text anyway)
- Reset Password (point to `/auth/reset?token={token}`)

---

## 2. `users_profile` autocreate trigger

In `supabase/migrations/0007_profile_trigger.sql`:

```sql
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.users_profile(user_id, display_name, preferred_locale)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email), 'en');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

---

## 3. Auth pages (Server Components where possible)

Reference Supabase Next.js App Router docs for cookie-based session handling. Each page below:

| Route | File | Notes |
|---|---|---|
| `/auth/signup` | `app/(auth)/signup/page.tsx` | RHF + Zod schema; password strength meter (`zxcvbn-ts`). Submit → `supabase.auth.signUp({ email, password, options: { emailRedirectTo: ... } })` |
| `/auth/signin` | `app/(auth)/signin/page.tsx` | `signInWithPassword`. On success → check for `user_locations`; route to `/onboarding/location` if none, else `/chat`. |
| `/auth/forgot` | `app/(auth)/forgot/page.tsx` | `auth.resetPasswordForEmail(email, { redirectTo: ... })`. |
| `/auth/reset` | `app/(auth)/reset/page.tsx` | Reads recovery token from URL; calls `auth.updateUser({ password })`. |
| `/auth/callback` | `app/(auth)/callback/route.ts` | Code exchange for email confirmation + password reset flows. |
| `/profile/security` | `app/(customer)/profile/security/page.tsx` | Change password while signed in: prompt current → call `signInWithPassword` to verify → `updateUser({ password: new })`. |

### Form pattern (reusable)

```tsx
// components/auth/auth-form.tsx — wraps RHF + Zod + shadcn Form components
const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
});
```

---

## 4. Auth-aware middleware

Already stubbed in [01-bootstrap.md](./01-bootstrap.md). Extend it:

```ts
// lib/supabase/middleware.ts — supabase session refresh +
//   if path startsWith /chat|/bookings|/booking|/profile|/onboarding:
//     - require auth (redirect to /auth/signin if no user)
//   if path === /chat or /bookings:
//     - require ≥1 user_location (redirect to /onboarding/location if none)
```

Server-side check via `supabase.from('user_locations').select('id').eq('user_id', user.id).limit(1)`.

---

## 5. Location onboarding wizard

**Route:** `/onboarding/location` — only reachable when signed in and no locations.

### Components

| File | Role |
|---|---|
| `app/(customer)/onboarding/location/page.tsx` | Step host with progress (1/2 add, 2/2 add more or continue) |
| `components/location/location-editor.tsx` | Reused in onboarding AND profile manager |
| `components/map/draggable-pin-map.tsx` | `@vis.gl/react-google-maps` with draggable marker |

### Editor flow
1. User picks label (Home / Work / Other).
2. Types address → on debounce, hit `/api/locations/geocode` server route which calls `tools/geocode.ts`.
3. Map updates with pin; user can drag pin to fine-tune.
4. Reverse-geocode on pin drop → `city`, `town_or_area`, `country_code`.
5. Save → insert into `user_locations`; set as `users_profile.default_location_id` if first.

### API: `app/api/locations/route.ts`
- `POST /api/locations` — create.
- `PATCH /api/locations/[id]` — update.
- `DELETE /api/locations/[id]` — delete (block if it's the only one OR if it's referenced by an upcoming booking).
- `POST /api/locations/geocode` — proxy to server `tools/geocode.ts`.

---

## 6. Location manager (`/profile/locations`)

- Lists saved locations with label, city, address.
- Edit/delete/set-as-default actions.
- "+ Add location" opens the same `<LocationEditor>` in a sheet.

---

## 7. Location picker (used in `/chat`)

Lives in `components/chat/location-picker.tsx`. Shows current location as a chip; tap opens bottom sheet of saved locations + "+ Add location".

State (Zustand):
```ts
// lib/stores/location.ts
interface LocationState {
  selectedLocationId: string | null;
  set: (id: string) => void;
}
```

Initial value: `users_profile.default_location_id` (loaded server-side and passed to client).

---

## Acceptance for 03-auth-and-onboarding

- [ ] Can sign up, receive verification email, click link, sign in.
- [ ] Cannot reach `/chat` without a location → redirected to onboarding.
- [ ] Adding a location via map pin reverse-geocodes to a real Islamabad sector.
- [ ] Forgot password email arrives; reset link sets a new password.
- [ ] Change password from `/profile/security` works.
- [ ] Locations manager CRUD works; default location selector functions.
- [ ] Location picker on chat shows current; switching updates state.
- [ ] RLS verified: a second user cannot read another user's locations.
