# 09 — Customer UI

Chat surface, recommendations, two-phase booking flow, bookings list, ratings.

[← back to README](./README.md) · scope: [ui-screens.md](../scope/ui-screens.md) · [user-journey.md § 1](../scope/user-journey.md#1-customer-journey--i-need-a-service-now)

---

## Build order (overlaps with Phase 2)

1. Landing + Chat shell (stubbed agent).
2. Location picker.
3. SSE consumer + in-process VIEW.
4. Recommendation cards + map preview.
5. Slot picker → Invitation pending → Confirmed flip.
6. My bookings + booking detail.
7. Rating prompt.
8. Structured summary card.

---

## 1. Landing (`app/(marketing)/page.tsx`)

Hero + 3 suggestion chips + 3 trust badges + business CTA + locale toggle. Static RSC.

---

## 2. Chat (`app/(customer)/chat/page.tsx`)

Mostly client because of streaming. Composition:

```
<ChatPage>
  ├── <LocationPicker />               [client, Zustand store]
  ├── <ChatHistory>                    [client, message list]
  │     ├── <UserBubble />
  │     ├── <InProcessView />          [animates with SSE events]
  │     ├── <RecommendationStack />    [3 ProviderCards + Map]
  │     ├── <InvitationPendingCard />
  │     ├── <ConfirmationMessage />
  │     └── <StructuredSummary />
  ├── <ChatInput />                    [textarea + send]
  └── <TraceDrawerToggle />            [right side]
```

### SSE consumer hook

```ts
// lib/hooks/use-agent-run.ts
export function useAgentRun() {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [done, setDone] = useState(false);
  const run = async (body) => {
    const res = await fetch('/api/agent/run', { method: 'POST', body: JSON.stringify(body) });
    const reader = res.body!.getReader();
    /* parse SSE chunks, push to events, mark done on terminal */
  };
  return { events, done, run };
}
```

### In-process VIEW (`components/chat/in-process-view.tsx`)

Renders a stepper that lights up as agent steps stream:
- Planning → Understanding intent → Finding nearby → Ranking *N* options → Ready

Each step shows a checkmark or spinner. Tap to expand the full trace drawer.

---

## 3. Recommendation stack (`components/recommendations/`)

`<ProviderCard>` props:
```ts
{ provider, score, reasoning: { en, ur }, distanceKm, etaMin, isBookable, slotsPreview }
```

- Bookable cards: `<Button>Book at HH:MM</Button>` → opens slot picker.
- Contact-only cards: `<Button variant="outline">Call</Button>` + `<Button variant="ghost">Claim this business</Button>`.
- Trust signals pill row: `Verified ✓ · Replies in ~12 min · 95% completion`.
- "Why?" expand: 2-line reasoning, language-aware.

Map preview: `<MapPreview pins={top3} userLocation={selectedLocation} />` collapsible.

---

## 4. Slot picker (`components/booking/slot-picker.tsx`)

- Bottom sheet (mobile) / Dialog (desktop).
- Fetches `/api/providers/[id]/availability/check` for next 7 days.
- Confirm CTA → calls `useAgentRun().run({ event: 'slot_selected', provider_id, slot_start })` → goes to invitation-pending state.

---

## 5. Invitation pending → Confirmed flip (`app/(customer)/booking/[id]/page.tsx`)

Server component loads booking by id; client subcomponent subscribes to a Supabase Realtime channel on `bookings:id=<id>` to flip UI when status changes.

States:
- `invitation_sent` → `<InvitationPendingCard>` with channel badge + countdown.
- `confirmed` → `<ConfirmationReceipt>` with confetti (Framer Motion), summary card, Add to Calendar, PDF link.
- `rejected` → `<RejectedCard>` with retry CTA.

Confetti: `framer-motion` keyframes + a sprite layer; ~80 LOC, no extra deps needed.

### Structured summary card (`components/recommendations/structured-summary.tsx`)

Matches brief example exactly. Component takes `{ serviceRequest, location, time, recommended: { name, distance }, reasoning, booking: { slot, confirmationSent }, followUp: { reminderAt } }`.

---

## 6. My bookings (`app/(customer)/bookings/page.tsx`)

- Server component fetches via `/api/bookings`.
- Tabs: Upcoming / Past (filter client-side).
- Each row → `<BookingCard>` with status pill + tap to detail page.

---

## 7. Rating prompt (`components/ratings/rating-sheet.tsx`)

- Open conditions: query param `?rate=<booking_id>` OR push notification action.
- 5-star input + textarea + submit → `POST /api/ratings`.

---

## 8. Stores

```
lib/stores/
├── location.ts        # selectedLocationId
├── chat.ts            # current messages + run state
└── trace.ts           # drawer open + selected step
```

Use Zustand for these; everything else uses TanStack Query for server cache.

---

## 9. i18n strings

Top all customer surfaces with bilingual strings:
- `lib/i18n/en.json`, `ur.json`, `ur-Latn.json`.
- Use `next-intl`'s `useTranslations()` in client components, `getTranslations()` in server.
- Direction: set `dir="rtl"` on root `<html>` when locale === `ur`.

---

## 10. Accessibility

- All interactive elements keyboard-reachable.
- ARIA labels on icon-only buttons.
- Focus management when sheets/dialogs open/close.
- Reduced motion: respect `prefers-reduced-motion` for confetti + step animations.

---

## Acceptance for 09-customer-ui

- [ ] Customer can sign in, pick a location, type the canonical Roman Urdu query, watch the in-process view, see 3 recommendation cards, tap Book, see Invitation pending, see Confirmation flip when provider accepts (tested via the provider window or by hitting `/api/provider/accept` directly).
- [ ] Structured summary card renders in the brief's exact format.
- [ ] My bookings list shows live and past bookings; status pills are color-coded.
- [ ] Trace drawer toggles open/closed and shows steps streaming.
- [ ] Rating sheet submits and updates provider average (verified in DB).
- [ ] RTL works when locale = `ur`.
- [ ] Mobile-first: works at 360 px wide.
