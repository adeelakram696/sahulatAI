# UI Screens

[← back to scope.md](./scope.md) · related: [user-journey.md](./user-journey.md)

Style: clean, modern, **mobile-first** with **chat-first** customer surface. shadcn/ui + Tailwind. RTL support for Urdu. Subtle Framer Motion on trace animations and card transitions.

---

## Customer auth & onboarding

### A. Sign up (`/auth/signup`)
- Email, password (strength meter), confirm password, preferred locale toggle.
- Submit → email verification link.
- Link to **Sign in** for returning users.

### B. Sign in (`/auth/signin`)
- Email + password + "Forgot password?" link.
- After successful sign-in: route to onboarding if no `user_locations` exist, else `/chat`.

### C. Forgot password (`/auth/forgot`)
- Email field → Supabase `resetPasswordForEmail` → confirmation screen.

### D. Reset password (`/auth/reset`)
- Lands here from the email link. New password + confirm → sign-in.

### E. Change password (`/profile/security`)
- Current password + new + confirm. In-app toast on success.

### F. Location onboarding (`/onboarding/location`)
- Two-step wizard. Step 1: pick label (Home / Work / Other), enter address, drop map pin → city/town reverse-geocoded inline. Step 2: "Add another?" or "Continue".
- Blocks progress to `/chat` until ≥1 location saved.

### G. Locations manager (`/profile/locations`)
- List of saved locations with edit/delete/set-as-default.
- "+ Add location" CTA opens the same map editor used in onboarding.

---

## Customer-side screens

### 1. Landing (`/`)
- Hero with a single big input: *"What service do you need?"* (en) / *"آپ کو کیا چاہیے؟"* (ur)
- Three suggestion chips (one in Roman Urdu — the brief example).
- Below: 3 trust badges (categories count, completed bookings, avg response time).
- Top-right: language toggle, "List your service" CTA.
- Footer with "Demo mode" toggle for judges.

```
┌─────────────────────────────────────────┐
│ SahuliatAI               EN ▾  Business │
├─────────────────────────────────────────┤
│                                          │
│   What service do you need?              │
│   ┌────────────────────────────────┐    │
│   │ Try: "Mujhe AC technician..."  │    │
│   └────────────────────────────────┘    │
│                                          │
│   [AC repair] [Plumber] [Tutor] ...     │
│                                          │
│   ★4.7 avg  ·  120+ providers  ·  8 cats│
└─────────────────────────────────────────┘
```

### 2. Chat / Recommendations (`/chat`)
- **Location picker** pinned above the input — chip with current location's label + city. Tap → bottom-sheet of saved locations + "Add new" CTA. Hard-blocks send if no location selected.
- Conversation bubbles (user input → **in-process VIEW** with progress card → recommendation cards).
- **In-process VIEW**: a compact card showing a vertical progress stepper ("Understanding intent ✓ → Finding nearby ✓ → Ranking 7 options …") tied to the streaming trace. Tappable to expand into the full trace drawer.
- Trace drawer toggle in header (slides in from right on desktop, full screen on mobile).
- Map preview pinned at top once recs arrive (collapsible).
- Recommendation cards show a **bookable** or **contact-only** state badge.

```
┌────────────────────────────┬──────────┐
│ ← back     EN ▾   trace ▶  │          │
├────────────────────────────┤          │
│  [user] Mujhe kal subah... │          │
│                            │          │
│  • Understanding intent ✓  │          │
│  • Finding providers ✓     │          │
│  • Ranking 7 options ✓     │          │
│                            │          │
│  ┌─────────────────────┐   │   MAP    │
│  │  Ali AC Services    │   │   with   │
│  │  2.1 km · ★4.7      │   │   pins   │
│  │  PKR 1500–2500      │   │          │
│  │  Why? ▾             │   │          │
│  │  [Book 10:00 AM]    │   │          │
│  └─────────────────────┘   │          │
│  ┌─────────────────────┐   │          │
│  │  Cool Tech …        │   │          │
│  └─────────────────────┘   │          │
└────────────────────────────┴──────────┘
```

### 3. Slot picker modal
- Bottom sheet on mobile, dialog on desktop.
- Slots from provider's `weekly_hours` minus existing bookings.
- Contact form: name + phone (required for confirmation).

### 4. Invitation pending (`/booking/[id]` when status = `invitation_sent`)
- Status pill: *"Awaiting provider acceptance"* with animated dots.
- Channel indicator: *"Invitation sent via WhatsApp"* (or SMS / Dashboard / Mock).
- Countdown to invitation window expiry.
- Receipt PDF preview already available (downloadable).
- "Cancel request" CTA.

### 5. Confirmation / Receipt (`/booking/[id]` when status = `confirmed`)
- Big checkmark animation + confetti.
- Booking id + QR.
- Provider card with call / WhatsApp deep links.
- **Add to Calendar** group: `.ics` download button + "Add to Google Calendar" deep link button (opens `calendar.google.com/calendar/render?action=TEMPLATE&...`, no API auth).
- Timeline preview of upcoming reminders.
- **Download receipt PDF** (generated by `@react-pdf/renderer`).

### 6. My bookings (`/bookings`)
- Tabs: Upcoming / Past.
- Card per booking with status pill (`invitation_sent` / `confirmed` / `reminded` / `in_progress` / `completed` / `rejected`).
- Tap → confirmation/tracking screen.

### 7. Rating prompt (sheet)
- Triggered by push or in-app on return.
- 5 stars + optional comment.

---

## Provider-side screens

### 8. Provider landing (`/for-business`)
- "Get more bookings from real customers nearby."
- 3 value props.
- Big CTA → onboarding wizard.

### 9. Onboarding wizard (`/provider/onboarding`)
- 5-step linear wizard with progress bar.
- Step 1: basics (name, owner, photo). Auth is email/password (already signed in by this point).
- Step 2: categories (multi-select with icons).
- Step 3: service area — Google Map with **pin + radius** or **polygon draw**; alternative tab "Pick sectors" (multi-select).
- Step 4: hours & price band (template + custom).
- Step 5: **notification preferences** (phone + optional OTP verify + WhatsApp/SMS opt-in toggles) → review + publish.

### 10. Provider invitation inbox (`/provider/dashboard`)
- Top KPIs: pending invitations, confirmed today, completion rate, rating.
- Real-time invitation inbox (Supabase Realtime).
- Each row: customer name, service, slot, location, **15-min countdown**, channel badge → Accept / Reject / Reschedule.
- Past bookings tab.

### 11. Provider acceptance page (`/provider/accept/[token]`) — login-free, mobile-first
- Renders without auth — token lookup only.
- Shows: customer name, service, slot, location, expiry countdown.
- Two big buttons: **Accept** / **Reject**.
- On Accept: `status='confirmed'`, redirects to a thank-you screen with a "Sign in to your dashboard" CTA.

### 12. Provider settings (`/provider/settings`)
- Edit anything from onboarding.
- Toggle notification channels.
- Blackout date picker.
- Public profile preview.

---

## Trace / demo screens

### 13. Live trace drawer
- Slide-out from right on desktop; full-height sheet on mobile.
- Vertical timeline of agent steps grouped by **run** (a single booking spans 3–4 runs joined by `run_id`).
- Each step: agent name, status (running / done / error), elapsed ms, expandable JSON of inputs/outputs/tool calls.
- Bottom: "Export JSON" + "Open full trace".

### 14. Full trace inspector (`/trace/[runId]`)
- Wider 2-column layout.
- Left: timeline tree (parent → child tool calls) across all runs of the booking.
- Right: selected step details.
- Top bar: replay button, export, copy run id.

### 15. Demo dashboard (`/demo`)
- Visible when `?demo=1` or via footer toggle.
- 4 prefilled query cards (English, Urdu, Roman Urdu, edge case "I need someone to fix my fridge tonight").
- "Last 5 runs" with quick links to traces.
- "Provider preview" link to a seeded provider's inbox.

---

## Structured summary card

After a successful booking, the chat surface renders a card whose layout matches the **exact format from the brief's example output**, so judges see direct alignment with the spec:

```
┌────────────────────────────────────────┐
│  Service Request   AC Technician        │
│  Location          G-13, Islamabad      │
│  Time              Tomorrow, 10:00 AM   │
│  Recommended       Ali AC Services      │
│                    (2.1 km away)        │
│  Reasoning         Closest available    │
│                    provider with ★4.7   │
│  Booking           Slot booked · sent ✓ │
│  Follow-up         Reminder at 9:00 AM  │
└────────────────────────────────────────┘
```

A bilingual confirmation message (the artifact emitted by the Booking agent) sits **above** the card as a chat bubble. The card itself has a "View receipt PDF" and "Add to calendar" footer.

---

## Empty & error states

Every flow has explicit empty/error UI — no silent failures.

| State | UI |
|---|---|
| Geo permission denied | Inline banner with "Type your area instead" + Islamabad sector dropdown. |
| Intent agent: ambiguous input | Chat bubble from the agent asking the missing field bilingually, e.g. *"Kya time chahiye? When do you need it?"* — answer feeds back through Planner → Intent re-run. |
| Discovery: no providers found | Card stack replaced by *"No providers nearby for this service. Try expanding the area or pick a different time?"* with two CTAs. |
| Ranking: only 1 provider | Single card, no card stack carousel. |
| Booking: slot taken (race) | Toast + slot picker re-opens with conflict highlighted. |
| Booking write failed | Receipt screen shows error state with "Try again" + booking is rolled back from DB. |
| Push permission denied | Inline note: *"We'll remind you in-app instead — reminders won't ring on your home screen."* |
| Trace stream interrupted | Drawer shows last known state + "Reconnecting…" + retry button. |
| Network offline | PWA shell still loads; banner *"Offline — last bookings shown from cache"*. |

---

## Common UI elements

- **Provider card** (`<ProviderCard>`): photo, name, distance pill, rating, ETA, price band, languages-spoken pill, **trust signals** (verified ✓ badge, response time *"replies in ~12 min"*, completion rate), "Why?" expand showing reasoning text (en + ur).
- **Trace step row** (`<TraceStep>`): icon (agent type), name, status dot, duration, expand chevron.
- **Service category chip** (`<CategoryChip>`): icon + bilingual label.
- **Map** (`<Map>`): thin wrapper over `@vis.gl/react-google-maps`.
- **Summary card** (`<StructuredSummary>`): brief-format card described above.
- **Confirmation message bubble** (`<ConfirmationMessage>`): bilingual chat bubble emitted by the Booking agent.

---

## Accessibility & responsiveness

- All forms keyboard-navigable, ARIA labels.
- Color contrast WCAG AA.
- Touch targets ≥ 44 px.
- Tested at: 360 × 640 (mobile), 768 × 1024 (tablet), 1440 × 900 (laptop).
- Urdu locale flips `dir="rtl"` at the layout level and uses an Urdu-optimized font (Noto Nastaliq Urdu).

---

## Visual design notes

- Palette: warm teal primary, deep navy text, soft off-white background. Avoid stock "tech startup" purple.
- Cards have soft shadows + subtle border (1 px slate-200) for a tactile feel.
- Trace drawer uses a monospaced font for tool call JSON.
- Lottie / Framer Motion confetti on booking confirmation — small but memorable for the demo video.
