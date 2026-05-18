# Demo Script — 3 to 5 minute video

[← back to scope.md](./scope.md)

The video is a deliverable and a major rubric driver. This script optimizes for the **6 things judges score**:

1. Use of Antigravity (25%) → shown in the trace drawer + tool-registry flash.
2. Agentic reasoning (20%) → narration of Planner → action across multiple runs.
3. Matching quality (20%) → bilingual reasoning text on each provider card.
4. Action simulation (15%) → two-phase invitation flow with real DB state, mock-message fallback, calendar artifacts, pg_cron reminders.
5. Technical implementation (10%) → quick architecture flash.
6. Innovation & UX (10%) → multilingual + multi-location profile + PWA install + live trace + login-free provider acceptance.

Target length: **4:00**. Hard ceiling: **5:00**.

**Two-window recording setup:** customer (signed in as Ayesha, has Home + Work locations) and provider (Ali AC Services). Use two browser windows side-by-side or two devices.

---

## Timeline

### 0:00 — 0:15 · Hook
- Open on the installed PWA on a phone (or phone-shaped browser frame).
- Voiceover: *"In Pakistan, finding a plumber, AC technician, or tutor still means scrolling WhatsApp groups and calling five people. SahuliatAI replaces that with an agentic AI booking system — powered by Google Antigravity."*

### 0:15 — 0:35 · Setup + the query
- Land on the chat surface, signed in as Ayesha.
- **Quickly tap the location picker** to show "Home — G-13" pre-selected, with "Work" and "+ Add location" available. Close it.
- Cursor lands on the input.
- Paste the canonical example: **"Mujhe kal subah G-13 mein AC technician chahiye"**.
- Press Enter.

### 0:35 — 1:30 · The agent pipeline (45% rubric moment)
- The **in-process VIEW** appears in chat ("Understanding intent → Finding nearby → Ranking").
- Trace drawer auto-opens on the right, streaming each agent step.
- Narrate, pausing on each milestone:
  - *"Planner agent decides the workflow."* — show the plan JSON.
  - *"Intent Parser translates the Roman Urdu, then extracts service, time, and resolves location against Ayesha's saved Home."* — pause on the parsed JSON.
  - *"Discovery merges our provider database with Google Places — seven candidates after dedup."* — show the dedup breakdown line.
  - *"Ranking uses Distance Matrix and a 5-factor composite score."* — pause on Ali AC Services scoring 87/100.
- 3 provider cards slide up. Map populates with pins.

### 1:30 — 1:55 · The recommendation
- Hover the top card.
- Expand **"Why?"** — bilingual reasoning (English + Urdu) appears.
- Voiceover: *"Every pick comes with a human-readable reason, in the user's language."*

### 1:55 — 2:30 · Booking · Phase A (invitation)
- Tap **"Book at 10:00 AM"**.
- Slot picker confirms the slot.
- Screen flips to the **Invitation sent** state:
  - Status pill: *"Awaiting provider acceptance"*.
  - Channel badge: *"via WhatsApp"* — **or "via Mock"** if no WhatsApp credentials, with the message body visible inline in the trace.
  - 15-min countdown.
- Voiceover: *"Phase A — booking row written, invitation sent through a strategy chain: Realtime → WhatsApp → SMS → mock fallback. The demo works on day one with zero external credentials because the mock channel keeps the system telling the same story."*
- Show the receipt PDF preview link (already downloadable).

### 2:30 — 3:00 · Provider acceptance · Phase B
- Switch to the **provider window** (Ali AC Services dashboard).
- The invitation appears live via Supabase Realtime — countdown ticking.
- *Alternative path to highlight:* show the provider opening the link from their phone → mobile-first acceptance page (no login).
- Tap **Accept**.
- **Cut back to customer window** — screen flips automatically: confetti, **Confirmation message** in chat ("Confirmed! Ali AC Services will arrive at Home (G-13) tomorrow at 10:00 AM"), **Structured summary card** matching the brief's exact example output, **Add to Calendar** buttons (.ics + Google Calendar deep link), receipt PDF download.
- Voiceover: *"Provider can accept from the dashboard or a tokenized link with no login. Customer state updates in real time."*

### 3:00 — 3:25 · Follow-up automation
- Open the trace drawer briefly — show the new run (`booking_confirmed → followup`) queueing two reminders.
- Voiceover: *"Follow-up agent enqueues the pre-appointment reminder and a completion check. Supabase pg_cron drains the queue every minute — no Vercel cron needed."*
- Fast-forward clock animation to T-1h → web push notification arrives: *"AC tech Ali arriving in 1 hour"*.
- Skip to T+slot_end → screen shows status flipping in_progress → completed → rating prompt sheet appears.

### 3:25 — 3:45 · Provider self-onboarding
- Quick montage of the 5-step wizard (sped up 4×):
  - Basics → categories → service area (drop pin + 5 km radius) → weekly hours → **notification preferences (WhatsApp opt-in)** → publish.
- Voiceover: *"Any business can list itself in under 90 seconds — optional WhatsApp opt-in determines how they receive invitations."*

### 3:45 — 4:00 · Close
- Open the trace JSON export button → JSON visible for a beat.
- Architecture diagram on screen for 2 seconds.
- Voiceover: *"Six agents. Twenty-two tools. Four Google APIs. Antigravity-orchestrated end-to-end. SahuliatAI."*

---

## Recording checklist

- 1080p, 30 fps minimum.
- **Two windows side-by-side** (customer + provider), labeled with overlay text.
- No devtools, no Slack pings, no system notifications.
- Mic check: ambient noise gate; verify Urdu pronunciation if speaking.
- Use system zoom (Cmd-+) on key UI moments — judges watch on phones.
- Add captions (English) for accessibility and judge scanning.
- **Pre-seed**: demo customer (Ayesha) with Home + Work locations + push enabled. Demo provider (Ali AC Services) with WhatsApp opt-in. Pre-warm the agents with one test run so the first real run is fast.
- Record one full take, then re-record any rough segments.
- Edit in CapCut / DaVinci Resolve. Add clock-fast-forward overlay for the follow-up section.

---

## Backup contingencies

| If… | Then… |
|---|---|
| Live Antigravity is flaky during recording | Switch to seeded trace replay (`/trace/[runId]`) and narrate it as a recording. |
| Google APIs are quota-blocked | Toggle `NEXT_PUBLIC_USE_GOOGLE_APIS=false` to demo the fallback path; agent flow is unchanged. |
| WhatsApp Cloud API not configured / Meta verification pending | **Lean into the mock channel as a feature** — show the `mock_messages` row in the trace drawer, with the rendered message body and the tokenized accept URL. This *is* the resilience story. |
| Push notification doesn't arrive in time | Show the `reminders` table row directly + manually hit `/api/reminders/fire` with curl — proves the queue + dispatcher work. |
| pg_cron lag at recording time | Hit `/api/reminders/fire` directly during the fast-forward moment; the function is idempotent. |
| Provider acceptance link fails to load on the second window | Use the dashboard Accept button instead — same outcome, faster cut. |