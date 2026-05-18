# 01 — Project Bootstrap

Next.js app shell, dependencies, folder layout. Should take ~60 min.

[← back to README](./README.md) · prereq: [00-prereqs.md](./00-prereqs.md) · scope: [technical-architecture.md](../scope/technical-architecture.md)

---

## 1. Create the Next.js 16 app

```bash
cd /Users/adeelakram/Documents/projects/self/google-hackathon
pnpm create next-app@latest . \
  --typescript --tailwind --eslint --app --src-dir=false \
  --import-alias "@/*" --use-pnpm --turbopack --yes
```

If prompted about existing files (scope, tech_plan), keep them.

---

## 2. Core dependencies

```bash
pnpm add \
  @supabase/ssr @supabase/supabase-js \
  zod @hookform/resolvers react-hook-form \
  zustand @tanstack/react-query \
  next-intl \
  framer-motion \
  @vis.gl/react-google-maps \
  @react-pdf/renderer \
  web-push \
  date-fns date-fns-tz \
  nanoid

pnpm add -D \
  @types/web-push \
  vitest @vitest/coverage-v8 \
  @testing-library/react @testing-library/jest-dom \
  supabase
```

shadcn-ui init:

```bash
pnpm dlx shadcn@latest init
# pick: New York · Slate · CSS variables yes
pnpm dlx shadcn@latest add button input label form card sheet dialog \
  drawer tabs badge avatar checkbox select textarea toast tooltip \
  progress separator skeleton dropdown-menu sonner
```

---

## 3. Folder layout

Exact tree mirroring [technical-architecture.md](../scope/technical-architecture.md#repo-layout-nextjs-app-router-monolith--single-deployment). Pre-create empty files so paths are clear:

```bash
mkdir -p app/{\(marketing\),\(auth\),\(customer\),\(provider\),\(trace\)}
mkdir -p app/\(customer\)/{chat,bookings,onboarding/location,profile/locations,profile/security}
mkdir -p app/\(provider\)/provider/{onboarding,dashboard,accept/[token],settings}
mkdir -p app/\(trace\)/trace/[runId]
mkdir -p app/api/{agent/run,agent/trace,bookings,providers,ratings,reminders/fire,provider/accept,locations,push/subscribe,whatsapp/inbound}
mkdir -p components/{chat,provider-card,trace-drawer,map,ui}
mkdir -p lib/{antigravity/agents,antigravity/tools,supabase,pwa,i18n,utils}
mkdir -p public/icons
mkdir -p supabase/migrations
mkdir -p scripts
mkdir -p tests/{fixtures,unit,integration}
```

---

## 4. `vercel.ts` initial config

`/vercel.ts` at repo root:

```ts
import { routes, type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  buildCommand: 'pnpm build',
  framework: 'nextjs',
  headers: [
    routes.cacheControl('/icons/(.*)', { public: true, maxAge: '1 week', immutable: true }),
    routes.cacheControl('/manifest.webmanifest', { public: true, maxAge: '1 hour' }),
  ],
};
```

`pnpm add -D @vercel/config`.

---

## 5. Locale + theme + middleware skeleton

### `next.config.ts`
```ts
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts');

const config: NextConfig = {
  experimental: { typedRoutes: true },
  images: { remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }] },
};

export default withNextIntl(config);
```

### `lib/i18n/request.ts`
```ts
import { getRequestConfig } from 'next-intl/server';
const locales = ['en', 'ur', 'ur-Latn'] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) ?? 'en';
  return {
    locale: locales.includes(locale as any) ? locale : 'en',
    messages: (await import(`./${locale}.json`)).default,
  };
});
```

Create empty `lib/i18n/{en,ur,ur-Latn}.json` with `{}` for now.

### `middleware.ts` (root)
```ts
import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

The Supabase middleware helper goes in `lib/supabase/middleware.ts` (boilerplate from Supabase Next.js docs).

---

## 6. Vercel project link + first deploy

```bash
vercel link
# pick the empty project created in Phase 0
vercel env pull .env.local   # gets values we added
pnpm dev                      # smoke test
```

Then push initial commit + watch the preview deploy succeed.

---

## Acceptance for 01-bootstrap

- [ ] `pnpm dev` renders the default Next.js landing page on `:3000`.
- [ ] Folder tree matches `technical-architecture.md`.
- [ ] shadcn components import cleanly.
- [ ] Preview deploy on Vercel returns 200.
- [ ] Locale provider is wired (visible at `/` once content is added).
- [ ] `.env.local` pulled and Supabase URL/key accessible.

---

## Common pitfalls

- **Turbopack incompat** — if a dependency breaks under Turbopack, drop `--turbopack` and run with Webpack for that one task.
- **next-intl v3 vs v4** — pin v4 if available; otherwise check the request.ts signature against the installed version.
- **Tailwind v4 vs v3** — shadcn currently expects v4; the init wizard handles it but watch for `globals.css` directives.
