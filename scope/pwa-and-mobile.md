# PWA & Mobile

[← back to scope.md](./scope.md)

The brief requires a **Mobile App (MUST)**. A high-quality PWA satisfies this for hackathon scope and gives us desktop installability for free.

---

## Installability targets

- **Android Chrome** — installable via "Install app" prompt (manifest + service worker + HTTPS).
- **iOS Safari** — "Add to Home Screen" supported (limited push, see below).
- **macOS Chrome / Edge** — installable as standalone app.
- **Windows Chrome / Edge** — installable as standalone app.

---

## Manifest (`app/manifest.webmanifest`)

```json
{
  "name": "SahuliatAI",
  "short_name": "Sahuliat",
  "description": "AI-powered service booking for the informal economy",
  "start_url": "/?utm_source=pwa",
  "display": "standalone",
  "background_color": "#0b1220",
  "theme_color": "#0ea5a4",
  "orientation": "portrait",
  "lang": "en",
  "dir": "auto",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-256.png", "sizes": "256x256", "type": "image/png" },
    { "src": "/icons/icon-384.png", "sizes": "384x384", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "New request", "url": "/chat", "icons": [{ "src": "/icons/shortcut-chat.png", "sizes": "96x96" }] },
    { "name": "My bookings", "url": "/bookings", "icons": [{ "src": "/icons/shortcut-bookings.png", "sizes": "96x96" }] }
  ],
  "screenshots": [
    { "src": "/screens/chat.png", "sizes": "1280x720", "form_factor": "wide" },
    { "src": "/screens/mobile-chat.png", "sizes": "390x844", "form_factor": "narrow" }
  ]
}
```

---

## Service worker strategy

Hand-rolled SW in `lib/pwa/service-worker.ts` (or `next-pwa` if it plays nice with Next 16 — verify before using).

- **App shell precache** — landing, chat, bookings (HTML + critical CSS/JS).
- **Runtime caches:**
  - Maps tiles: `CacheFirst` with 7-day expiry.
  - API GET responses (`/api/providers`, `/api/bookings`): `StaleWhileRevalidate`.
  - Agent run results: never cached (`NetworkOnly`).
- **Offline fallback page** for navigation requests.

---

## Web Push

- **VAPID key pair** generated once, set in env.
- Push subscription captured on first booking confirmation.
- Server sends pushes from `tools/push.ts` (Antigravity tool wrapper for `web-push`).
- **iOS note:** Web Push works on iOS 16.4+ *only when the PWA is installed to home screen*. We surface an "Install for reminders" prompt to iOS users.

---

## Responsiveness

- Tailwind breakpoints: `sm 640`, `md 768`, `lg 1024`, `xl 1280`.
- Mobile-first: build at 360 px and scale up.
- Customer surfaces are usable single-handed (input + primary CTA in thumb zone).
- Provider dashboard works mobile but is optimized for desktop (real-world providers will use phones — design for both).

---

## Performance budget (Lighthouse goals)

| Metric | Target |
|---|---|
| Performance | ≥ 90 |
| Accessibility | ≥ 95 |
| Best practices | ≥ 95 |
| SEO | ≥ 90 |
| PWA installability | pass |

- Use `next/image` for all images.
- Lazy-load Maps JS (only when recommendations render).
- Inline critical CSS via Tailwind's JIT.
- Use RSC for static surfaces; client-only where state needed (chat, dashboard, trace drawer).

---

## Receipt PDF & calendar integration

- **Receipt PDF** rendered server-side via **`@react-pdf/renderer`** (free, MIT, works on Vercel Hobby). Receipt content: booking id, customer name, provider, slot, location, price band, reasoning excerpt.
- **Add to Google Calendar** uses a public deep link — no API auth, free, instant: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Service+Booking&dates=YYYYMMDDTHHMMSS/YYYYMMDDTHHMMSS&details=...&location=...`.
- **`.ics` download** for non-Google users — hand-rolled minimal generator, no library required.

---

## QA matrix before demo

| Device | Browser | Install | Push | Notes |
|---|---|---|---|---|
| Pixel (Android 14) | Chrome | ✓ | ✓ | Primary demo device |
| iPhone 14 (iOS 17) | Safari | ✓ | ✓ (after install) | |
| MacBook | Chrome | ✓ | ✓ | Judge's likely device |
| MacBook | Safari | partial | — | Verify chat + map still work |
| Windows | Edge | ✓ | ✓ | |
