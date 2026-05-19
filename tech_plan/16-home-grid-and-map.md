# 16 — Home grid + Map + Bottom nav + Account

Mobile-first navigation surface. Browse categories visually, find providers on a map, manage account.

[← back to README](./README.md) · scope: [features.md A12–A15](../scope/features.md)

---

## Files to create

| File | Role |
|---|---|
| `lib/services/categories.ts` | Single source of truth: slug → icon (lucide), tile color, group, English/Urdu label |
| `components/layout/bottom-nav.tsx` | 5-tab nav, mobile only (`md:hidden`), active by route |
| `components/services/category-quick-row.tsx` | Horizontal-scroll snap row of 6 tiles |
| `components/services/category-grid.tsx` | Grouped grid of all 16 |
| `app/page.tsx` | Rewrite — for signed-in users renders quick row + grid; signed-out keeps marketing landing |
| `app/(customer)/map/page.tsx` | Server: loads default location, renders the map shell |
| `components/map/provider-map.tsx` | Client: `@vis.gl/react-google-maps` + debounced bbox refetch + DB-vs-Places pin styling + bottom sheet |
| `app/api/providers/nearby/route.ts` | Accepts bbox, returns DB + Places merged, deduped, capped at 50 |
| `app/(customer)/profile/page.tsx` | Real Account page (not just the dropdown) |
| chat-surface update | Read `?q=` + `?autosubmit=1` params, auto-submit once, replaceState to clean URL |

---

## Category groups

```ts
HOME_SERVICES:     plumber, electrician, ac_repair, carpenter, mason, painter, pest_control, gardening
MAINTENANCE:       appliance_repair, house_cleaning, cook
AUTO:              car_wash, car_mechanic
PERSONAL_CARE:     beautician, tutor, mobile_repair
```

Plus one virtual tile **Tank Cleaning** that maps to `plumber` + `notes: "water tank cleaning"`.

---

## Tile auto-submit contract

```
Home tile tap → router.push(`/chat?q=${encoded}&autosubmit=1`)
```

Chat surface on mount:
1. If `q` in URL → set `input` to its value.
2. If `autosubmit=1` → call `send(input)` immediately, but only once per mount.
3. After triggering, `replaceState(url-without-query)` so a refresh doesn't re-trigger.

---

## Map data contract

```
POST /api/providers/nearby
  { ne_lat, ne_lng, sw_lat, sw_lng, category?: slug }
→ { db: ProviderCard[], places: ProviderCard[] }
```

- DB query: PostGIS `ST_Intersects(hub_location::geometry, ST_MakeEnvelope(...))`, filter by category if given.
- Places query: only if center+category combo isn't in the 60s in-memory cache.
- Dedup: same name + within 200 m → DB wins.
- Cap: 50 total pins.
- Refetch debounced 500 ms in the client.

---

## Bottom nav rules

- Sticky bottom, height ~ 64 px (4 rem)
- 5 tabs equally spaced
- Hidden on `md+` (header takes over)
- Active tab = primary color + filled icon
- Inactive = muted text + outlined icon

---

## Acceptance for 16

- [ ] Tap a category tile → chat auto-submits exactly once → results render.
- [ ] Bottom nav shows on iPhone width, hides on laptop width.
- [ ] Map loads, pins visible, DB pins visually distinct from Places pins.
- [ ] Pan map → providers refetch after 500 ms; rapid pan doesn't burn API.
- [ ] Tap pin → bottom sheet matches the existing chat ProviderCard.
- [ ] Account page lists locations, links to security, has working Sign-out.
