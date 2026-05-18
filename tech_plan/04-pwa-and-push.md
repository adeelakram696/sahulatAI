# 04 — PWA & Web Push

Manifest, service worker, install prompts, web push subscription + dispatch.

[← back to README](./README.md) · scope: [pwa-and-mobile.md](../scope/pwa-and-mobile.md)

---

## 1. Manifest

`app/manifest.webmanifest` (Next.js will serve as-is from `app/`):

```ts
// app/manifest.ts — programmatic manifest for typed routes
import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SahuliatAI',
    short_name: 'Sahuliat',
    description: 'AI-powered service booking for the informal economy',
    start_url: '/?utm_source=pwa',
    display: 'standalone',
    background_color: '#0b1220',
    theme_color: '#0ea5a4',
    orientation: 'portrait',
    lang: 'en',
    dir: 'auto',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-256.png', sizes: '256x256', type: 'image/png' },
      { src: '/icons/icon-384.png', sizes: '384x384', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'New request', url: '/chat', icons: [{ src: '/icons/shortcut-chat.png', sizes: '96x96' }] },
      { name: 'My bookings', url: '/bookings', icons: [{ src: '/icons/shortcut-bookings.png', sizes: '96x96' }] },
    ],
    screenshots: [
      { src: '/screens/chat.png', sizes: '1280x720', form_factor: 'wide' },
      { src: '/screens/mobile-chat.png', sizes: '390x844', form_factor: 'narrow' },
    ],
  };
}
```

---

## 2. Icons

Use a single 1024×1024 SVG/PNG source. Generate the set via [pwa-asset-generator](https://github.com/onderceylan/pwa-asset-generator) or manually export sizes: 192, 256, 384, 512, maskable-512. Place in `public/icons/`.

Quick generator one-liner:
```bash
pnpm dlx pwa-asset-generator ./public/icons/source-1024.png ./public/icons --background "#0b1220" --opaque false --maskable true
```

---

## 3. Service worker

Hand-rolled at `public/sw.js` (skip next-pwa to avoid Next 16 compat issues).

```js
// public/sw.js
const VERSION = 'v1';
const APP_SHELL = ['/','/chat','/bookings','/icons/icon-192.png','/manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/agent/')) return; // never cache agent runs

  if (url.origin.includes('googleapis') || url.pathname.startsWith('/api/')) {
    e.respondWith(staleWhileRevalidate(e.request));
  } else if (e.request.mode === 'navigate') {
    e.respondWith(networkFirst(e.request));
  }
});

async function staleWhileRevalidate(req) { /* … */ }
async function networkFirst(req) { /* … */ }

self.addEventListener('push', e => {
  const data = e.data?.json() ?? {};
  e.waitUntil(self.registration.showNotification(data.title ?? 'SahuliatAI', {
    body: data.body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
    data: data.url, actions: data.actions,
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow(e.notification.data || '/'));
});
```

Register from a client component mounted in `app/layout.tsx`:

```tsx
// components/pwa/register-sw.tsx — 'use client'
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  }
}, []);
```

---

## 4. Push subscription flow

### Client: `components/pwa/push-prompt.tsx`

Trigger from the booking confirmation screen (highest user intent moment):

```tsx
async function subscribeToPush() {
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
  });
  await fetch('/api/push/subscribe', { method: 'POST', body: JSON.stringify(sub.toJSON()) });
  return sub;
}
```

### Server: `app/api/push/subscribe/route.ts`

```ts
// POST { endpoint, keys: { p256dh, auth } }
// upsert into push_subscriptions keyed by endpoint
```

### Dispatch (server-side): `lib/antigravity/tools/push.ts`

```ts
import webpush from 'web-push';
webpush.setVapidDetails('mailto:team@example.com', process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);

export async function sendPush(userId: string, payload: { title, body, url? }) {
  const subs = await admin.from('push_subscriptions').select('*').eq('user_id', userId);
  await Promise.allSettled(subs.data!.map(s =>
    webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload))
      .catch(e => { if (e.statusCode === 410) admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint); })
  ));
}
```

---

## 5. iOS install banner

iOS only supports Web Push when the PWA is installed. Show an instructional banner on iOS Safari:

```tsx
// components/pwa/ios-install-banner.tsx
const ua = navigator.userAgent;
const isIOS = /iPhone|iPad|iPod/.test(ua);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
if (isIOS && !isStandalone) showBanner('Tap Share → Add to Home Screen to enable reminders');
```

---

## 6. Responsiveness checklist

Already specified in [pwa-and-mobile.md § Responsiveness](../scope/pwa-and-mobile.md#responsiveness). Build at 360 px first; test at 768 + 1440 before each phase exit.

---

## Acceptance for 04-pwa-and-push

- [ ] Chrome shows the install prompt; installed app launches in standalone mode.
- [ ] Manifest passes Lighthouse PWA audit.
- [ ] Service worker registers; cache populated on first load.
- [ ] Push subscription persists in `push_subscriptions`.
- [ ] Manual `webpush.sendNotification` from a script delivers a notification.
- [ ] iOS install banner appears on iOS Safari, hidden when installed.
- [ ] App works offline at `/bookings` (cached shell, last list visible).
