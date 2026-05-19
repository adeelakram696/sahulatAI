# User Journeys

Three personas: **Customer**, **Business Owner**, and **Judge / Demo Viewer**.

[← back to scope.md](./scope.md) · related: [agent-workflow.md](./agent-workflow.md) · [ui-screens.md](./ui-screens.md)

---

## 0. Customer onboarding journey — "First time using SahuliatAI"

**Persona:** Ayesha, opening the app for the first time.

| # | Step | Screen | Behind the scenes |
|---|---|---|---|
| 1 | Lands on home, taps **Sign up** | Landing → Sign up | Supabase Auth, email/password. |
| 2 | Enters email + password (8+ chars, strength meter); receives verification email; clicks the link | Email verify | Supabase email template (lightly branded). |
| 3 | Returns to app, signed in; greeted by **Welcome — let's add your first location** | Onboarding step 1/2 | Mandatory. |
| 4 | Picks **Home**, types address, drops a map pin (Google Maps); city + sector reverse-geocoded automatically | Location editor | Google Geocoding API. |
| 5 | Saves; option to **Add another location now** or **Continue** | Onboarding step 2/2 | At least 1 location is the unblock condition. |
| 6 | Lands on the chat surface with location picker pre-selected to "Home" | Chat | — |

**Forgot password flow:** standard Supabase reset — email link → set new password → sign in.
**Change password flow:** profile settings → re-enter current + new → confirm.

---

## 1. Customer journey — "I need a service, now"

**Persona:** Ayesha, lives in G-13 Islamabad, AC just stopped working, prefers Roman Urdu. Already signed in with Home + Work saved.

| # | Step | Screen | What's happening behind the scenes |
|---|---|---|---|
| 1 | Opens the installed PWA | Chat (signed in) | Location picker shows "Home" pre-selected; "Work / + Add" available. |
| 2 | Sees big input + suggestion chips; confirms "Home" is the right location for this request | Chat | — |
| 3 | Types: *"Mujhe kal subah G-13 mein AC technician chahiye"* | Chat | Submits with selected `location_id` to `/api/agent/run` → Antigravity **Planner** kicks off. |
| 4 | **In-process VIEW** appears: progress card ("Understanding intent · Finding nearby · Ranking 7 options") plus an expandable trace drawer streaming each agent step | Chat | **Intent Parser** extracts intent; **Discovery** + **Ranking** stream their steps live. |
| 5 | Map appears with provider pins; 3 cards slide up | Recommendations | Top 3 ranked. Registered providers show **Book** button; Places-only providers show **Call** + **Claim this business**. |
| 6 | Reads top card: *"Ali AC Services · 2.1 km · ★4.7 · ~25 min · PKR 1500–2500"* with "Why?" expand showing bilingual reasoning | Recommendations | Reasoning text from Ranking agent. |
| 7 | Taps **Book at 10:00 AM** | Slot picker modal | **Booking** agent runs Phase A: writes `bookings` row with `status='invitation_sent'`, runs `notify_provider` (WhatsApp → SMS → mock chain), generates receipt PDF + calendar artifacts. |
| 8 | Sees an **"Invitation sent"** screen: invitation status pill, channel used ("via WhatsApp"), live wait indicator, "Awaiting acceptance" message | Booking status | Customer push sent for invitation-pending. |
| 9 | Provider (Ali) gets WhatsApp message (or mock UI badge if no creds) → taps link → mobile acceptance page → taps **Accept** | Provider acceptance page | `bookings.status='confirmed'`. Customer push fires: "Confirmed by Ali AC Services". |
| 10 | Customer screen flips to **confirmed receipt** with QR + provider contact + booking id + **Add to Calendar** (`.ics` + Google Calendar deep link) | Confirmation | Reminder enqueued in `reminders` table for slot − 1 h. |
| 11 | Closes the app | — | — |
| 12 | Next morning 9:00 → Supabase `pg_cron` runs `drain_due_reminders` → POSTs to `/api/reminders/fire` → web push: *"AC tech Ali arriving in 1 hour"* | Push toast | Booking status → `reminded`. |
| 13 | After visit → push: *"How was your service?"* | Rating modal | 1–5 stars + comment; updates provider reputation. |

**Failure modes handled:**
- No saved location → request blocked with CTA to add one (hard requirement).
- Unknown service → agent asks a clarifying bilingual question (Planner reroutes to Intent re-run).
- No providers nearby → agent suggests expanding radius or alternative service.
- Provider doesn't accept within window (default 15 min, capped at slot_start) → booking auto-`rejected`, customer notified, recommendation list shown again with the timed-out provider greyed out.
- `notify_provider` external API fails or no creds → tool falls back through Realtime → WhatsApp → SMS → mock; whichever succeeds writes to `bookings.invitation_channel`. Demo story unchanged.

---

## 2. Business owner journey — "I want bookings"

**Persona:** Ali, runs a 2-tech AC repair shop in Sector F-11.

| # | Step | Screen | Behind the scenes |
|---|---|---|---|
| 1 | Visits `/for-business` and taps **List your service** | Provider landing | — |
| 2 | Signs up with **email + password** (separate provider role flag) | Auth | Supabase Auth; verification email sent. |
| 3 | Wizard step 1 — business basics (name, owner, photo upload) | Onboarding 1/5 | — |
| 4 | Wizard step 2 — pick categories (AC repair, AC installation, refrigeration) | Onboarding 2/5 | — |
| 5 | Wizard step 3 — service area: drops a pin on the Google Map, drags radius slider to 5 km, or picks Islamabad sectors from a multi-select | Onboarding 3/5 | Stored as polygon or `service_radius_km` + `hub_location`. |
| 6 | Wizard step 4 — sets weekly hours (Mon–Sat 9–18) and price band (mid: PKR 1500–2500) | Onboarding 4/5 | — |
| 7 | Wizard step 5 — **notification preferences**: enter phone, optionally verify via OTP, toggle **Get invitations on WhatsApp** and/or **SMS**. Then review + publish | Onboarding 5/5 | Phone OTP is optional; required only if WhatsApp/SMS opt-in is enabled. Determines `notify_provider`'s strategy chain priority. |
| 8 | Lands on dashboard with empty **booking invitations inbox** | Dashboard | Realtime channel subscribed: `provider_dashboard:<provider_id>`. |
| 9 | When a customer books → invitation row (`status='invitation_sent'`) appears with countdown to 15-min expiry. Ali can either tap **Accept** in the dashboard OR open the WhatsApp/SMS message and tap the acceptance link (which works without logging in) | Dashboard or `/provider/accept/[token]` | `bookings.status='confirmed'`; customer push fires; `booking_confirmed` event emitted → Planner re-routes to Follow-up to enqueue the pre-appointment reminder. |
| 10 | Reject path: ignoring the invitation past 15 min → auto-`rejected` → `invitation_expired` event → customer's screen re-renders with Ali's card greyed out and an alternative provider proposed | — | Drained by Supabase `pg_cron` invitation-sweep. |
| 11 | After slot_end → Follow-up agent auto-transitions to `in_progress → completed`; customer auto-prompted for rating | — | For hackathon: no manual provider "mark complete" required. |

**Acceptance criteria:**
- A new provider can list in **under 90 seconds** (5-step wizard).
- Once published, the provider is immediately discoverable by the Discovery agent.
- Provider can accept an invitation **without logging in** via the tokenized link from WhatsApp/SMS.

---

## 3. Judge / Demo viewer journey — "Show me the agents"

**Persona:** Hackathon judge reviewing the build.

| # | Step | What they see |
|---|---|---|
| 1 | Opens the deployed URL on their laptop, signs in with a pre-seeded demo customer account | Landing → Chat (already onboarded with Home + Work locations) |
| 2 | Toggles **Demo mode** → unlocks a panel with 4 prefilled queries | Demo dashboard |
| 3 | Picks query: *"Mujhe kal subah G-13 mein AC technician chahiye"* — confirms "Home" is the selected location | Chat |
| 4 | Watches the **trace drawer** auto-open, streaming each agent's reasoning, tool call, and output as it happens (Planner → Intent → Discovery → Ranking) | Live trace |
| 5 | Sees provider cards appear with bilingual reasoning and bookable/contact-only badges | Recommendations |
| 6 | Taps **Book at 10:00 AM** → screen flips to **Invitation sent** with channel badge ("via WhatsApp" — or **"via Mock"** if no creds, with the message body visible inline) | Invitation pending |
| 7 | Opens the **Provider** tab in a second browser → sees the invitation land in Ali's dashboard in realtime with the 15-min countdown | Provider dashboard |
| 8 | (Alternative path) Opens the provider acceptance URL from the mock message → mobile-first acceptance page → taps **Accept** | `/provider/accept/[token]` |
| 9 | Customer screen flips to **Confirmed receipt** — confetti, structured summary card, PDF download, Add-to-Calendar buttons. Trace drawer shows new run (`booking_confirmed` → Follow-up enqueued 2 reminders) | Confirmation |
| 10 | Opens **Trace timeline** → exportable JSON of full agent run (all 4 logical runs joined by `run_id`) | Trace inspector |
| 11 | Toggles **Replay** → re-runs the agent pipeline from the same input, traces re-render | Trace replay |

**Why this matters:** judges award the Antigravity score and reasoning score based on *visibility* of the agent flow. This journey makes both visible without the judge needing to read code.

---

## 4. Browse-via-categories journey — "I just want a plumber"

**Persona:** Ayesha doesn't want a conversation; she knows she needs a plumber.

| # | Step | Screen | Behind the scenes |
|---|---|---|---|
| 1 | Opens app → lands on Home (signed in) | Home grid | Quick-row + grouped category grid |
| 2 | Taps **Plumber** tile | Home | Navigates to `/chat?q=Plumber%20chahiye&autosubmit=1` |
| 3 | Chat surface auto-fills the input + submits | Chat | Agent runs full pipeline; URL is cleaned via replaceState to prevent re-trigger on refresh |
| 4 | 3 bookable cards + 5 Places cards stream in | Chat | Same as Journey 1 from step 5 onward |

---

## 5. Discover-via-map journey — "Show me what's around"

**Persona:** Ayesha wants to see options visually before choosing.

| # | Step | Screen | Behind the scenes |
|---|---|---|---|
| 1 | Bottom nav → **Map** | `/map` | Map centers on default location; calls `/api/providers/nearby` with viewport bbox |
| 2 | Sees DB providers as primary-color pins with ✓ badge; Google Places pins are gray | Map | DB query (PostGIS bbox) + Places Nearby in parallel, deduped |
| 3 | Pans to a different area; pins refresh after 500 ms debounce | Map | New bbox → cached for 60 s per (category, bbox-key) |
| 4 | Taps a DB pin → bottom sheet shows ProviderCard with Book button | Map | Reuses the same component shown in chat |
| 5 | Taps Book → drops into the chat with provider preselected, runs Phase A | Chat | Same booking flow as Journey 1 |

Or, on a Places pin → Contact button → opens PlacesContactDialog → creates a query_sent booking + sends message.

---

## 6. Service-quality + dispute journey — "Something went wrong"

**Persona:** Ayesha booked Ali AC Services; the AC tech didn't show up.

| # | Step | Screen | Behind the scenes |
|---|---|---|---|
| 1 | Confirmed booking → 1h before slot, push fires | Push | pg_cron drains `pre_appointment` reminder |
| 2 | Slot time arrives; Ali doesn't tap "On the way" | — | Status stays `confirmed`. Customer's status timeline shows no progress |
| 3 | Ayesha taps **Report an issue** on `/booking/[id]` | Dispute modal | Picks kind=`no_show`, enters statement |
| 4 | Submits → `/api/disputes` creates row; Dispute Resolution agent kicks in | Agent run | Sets `under_review`, applies no-show policy (100% refund + blacklist threshold check) |
| 5 | Ayesha sees "Refund initiated · provider flagged" | Dispute status card | `disputes.resolution` rendered |
| 6 | Ali's dashboard shows a **Disputes** section with the open case | Provider | He can submit a counter-statement |
| 7 | Provider's `on_time_score` ticks down; `cancellation_rate` ticks up | Provider score | Trigger from migration #16 |

For a *happy-path* completion (provider does show up):

| # | Step | Screen |
|---|---|---|
| A | Provider taps **On the way** | Provider dashboard |
| B | Customer's status timeline animates to "On the way" | Booking page |
| C | Provider taps **Arrived** | Provider dashboard |
| D | Provider taps **Mark complete** → opens checklist modal | Provider |
| E | Checks "Problem fixed" + "Area cleaned" + attaches photo placeholder | Modal |
| F | Customer sees "Completed" + rating prompt | Booking page |

---

## Cross-journey design principles

- **Mobile-first** — all flows tested at 375 px width first.
- **Two-phase clarity** — never claim confirmation before the provider has accepted. UI shows "Invitation sent" → "Confirmed" as distinct states with visible channel and countdown.
- **Latency mask** — agent steps stream visually so 4–8 s of LLM work feels intentional.
- **Demo always works** — every external dependency (WhatsApp, SMS, Maps, Antigravity) has a free or mock fallback so the flow never breaks during the demo.
- **Bilingual UI** — every customer-facing string in English + Urdu; provider portal English-only for hackathon scope.
- **Auth-first customer flow** — all users must sign in via email/password; no anonymous flow.
- **Login-free provider acceptance** — provider can accept via tokenized link from WhatsApp/SMS without logging in (mobile-first acceptance page).
