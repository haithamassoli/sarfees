# Serfees — Build Plan

Source: [PRD.md](./PRD.md). Seven milestones, each a shippable increment with a demo gate ("done when"). Order is dependency order; sized for a solo dev / small team. The full Convex schema lands in M0 (it's already written in the PRD) so nothing downstream waits on it.

**Cross-cutting rules (apply to every milestone, not repeated per task):**

- Every screen ships in Arabic via `ar.json` + `t()` as it's built — no hardcoded strings, no retrofit pass.
- All validation at the mutation boundary (`seats > 0`, `price >= 0`, `originGov != destGov`, future `departAt`, valid E.164).
- Phone + plate stripped server-side everywhere except a `confirmed` counterpart (shared query helper, built in M2, reused after).
- Times render in `Asia/Amman`; layout uses Tailwind logical properties only (`ms-*`/`me-*`/`ps-*`/`pe-*`).

**Sequencing notes:** M1–M4 are strictly serial (each builds on the last). M5 (push/PWA) needs M4's notification rows. M6 (ratings) only needs M3's completion flow, so it can run parallel to M5. M7 polish tasks can start any time after M2; it closes the project.

---

## M0 — Skeleton & deploy

Goal: Arabic RTL shell live on Vercel, Convex wired, schema landed.
**Done when:** the production URL renders the tab-bar shell in Arabic RTL on a real phone, connected to Convex dev + prod deployments.

- [x] Scaffold Next.js (App Router) + TypeScript + Tailwind; repo, Vercel project, env setup
- [x] Wire Convex (dev + prod) with `ConvexProvider` in the root layout
- [x] Root layout: `<html lang="ar" dir="rtl">`
- [x] `ar.json` + `t()` helper; `GOV` enum with Arabic governorate names
- [x] Land the full Convex schema from the PRD (7 tables + indexes)
- [x] App shell: bottom tab bar (Search / Post / Activity / Notifications / Profile) on mobile, top nav + max-width on desktop
- [x] `Asia/Amman` date/time formatting helper (`Intl`)

## M1 — Auth & profile

Goal: phone + password accounts, guarded routes, editable profile.
**Done when:** sign up with an `07…` number on a phone, log out, log back in with `+9627…` form of the same number; hitting a guarded route logged-out redirects to `/login`.

- [x] Convex Auth **Password** provider via `@convex-dev/auth` Next.js integration; identifier = phone
- [x] E.164 normalization + validation util (`07…` / `9627…` / `+9627…` → `+9627…`), used at signup and login
- [x] `/signup` (phone, password, name) and `/login` pages
- [x] `convexAuthNextjsMiddleware` guarding `/trips/new`, `/requests/new`, `/activity`, `/notifications`, `/profile`
- [x] User profile row on signup (`ratingAvg=0`, `ratingCount=0`)
- [x] `/profile`: edit name + vehicle (make, color, plate), logout

## M2 — Post & browse trips (the public surface)

Goal: drivers post; anyone browses without an account.
**Done when:** a driver posts a trip; a logged-out phone sees it on `/`, `/route/amman/irbid`, and `/trips/[id]`; phone and plate are absent from every public payload (verified in the network tab, not the UI).

- [x] `createTrip` mutation: validation + max-3-open-trips rate limit
- [x] `/trips/new` form — native `<input type="date">`/`type="time">`, no picker lib
- [x] Shared privacy helper: queries return phone/plate only to a `confirmed` counterpart — used by all public queries from here on
- [x] `/` home: search form (route + date) + latest departures, SSR
- [x] `/route/[from]/[to]`: SSR `revalidate: 60`, upcoming open trips + open requests, optional `?date=`, invalid pair → 404
- [x] `/trips/[id]` public detail: driver name, rating, vehicle make/color, route, time, price, seats, stops
- [x] `/activity` driver view v1: my trips (live `useQuery`) + cancel trip

## M3 — Booking & seat accounting

Goal: the money path — reserve seats correctly under both booking modes.
**Done when:** with two accounts on two devices: instant-book decrements seats immediately; approve-mode holds nothing until approval; the last seat can't be double-booked; cancel restores seats and `full` → `open`; phone + `wa.me` appear to both parties only on `confirmed`.

- [x] `book` mutation: instant → `confirmed` + decrement; approve → `pending` (no seat hold)
- [x] `approve` / `reject` mutations: re-check `seatsAvailable >= seats` at approval; `full`/`open` transitions
- [x] `cancel` booking (either party, pre-completion) → seats released
- [x] `completeTrip` mutation: trip → `completed`, its `confirmed` bookings → `completed`
- [x] Booking UI on `/trips/[id]`: seat count picker, auth-gated, mode-aware ("احجز" vs "اطلب موافقة")
- [x] `/activity` passenger view: my bookings with live status
- [x] `/activity` driver view: incoming `pending` bookings → approve/reject; mark trip completed
- [x] Confirmed-state UI both sides: phone, `tel:` link, `wa.me/9627…` link
- [x] Unit tests (`convex-test`): seat transitions, last-seat race, approve-beyond-capacity blocked, cancel restores

## M4 — Requests & matching

Goal: the second side of the marketplace and the core mechanic — the match.
**Done when:** passenger posts a request; a driver posting a matching trip sees inline matches, and the passenger gets an in-app notification (and vice versa); driver Accept on a request creates trip + `confirmed` booking in one step; unread badge shows on the tab.

- [x] `createRequest` mutation: validation + max-3-open limit; `/requests/new` form
- [x] `/requests/[id]` public detail page
- [x] Match-on-insert, both directions: route pair + `±MATCH_WINDOW_MS` + seat fit → `notify()` (notifications row + scheduled push action stub)
- [x] Inline matches on post-success screens (new trip → matching open requests; new request → matching open trips); no notification to the creator
- [x] Driver **Accept** flow: price + depart-time form (prefilled) → create trip (`seatsTotal = request.seats`) + `confirmed` booking linked to request; request → `matched`
- [x] Request lifecycle on `/activity`: my requests, matched driver, cancel
- [x] `/notifications` feed: live list, mark-as-read, unread badge on the tab bar
- [x] Unit tests: window boundary (±90 min edges), seat-fit filter, creator-not-notified

## M5 — PWA & Web Push

Goal: installable app; the match push actually reaches phones.
**Done when:** on an Android phone with the site closed, a booking-confirmed push arrives and tapping it opens `/trips/[id]`; the app installs from the custom prompt; iOS Safari shows the add-to-home-screen banner instead of a broken permission ask; airplane mode shows the offline page, not a white screen.

- [x] Manifest: `name: "سيرفيس"`, `dir: rtl`, `lang: ar`, `display: standalone`, icons, theme color
- [x] Serwist (`@serwist/next`): precache app shell, runtime-cache static assets, offline "لا يوجد اتصال" fallback page
- [x] SW `push` + `notificationclick` handlers — click deep-links to the trip/request
- [x] VAPID keypair in env; client subscribe flow → `pushSubscriptions` (dedupe by endpoint)
- [x] Permission toggle "نبّهني عند وجود مطابقة" on post-success + `/activity` — never on page load; on uninstalled iOS Safari, show A2HS steps instead (no Notification API there)
- [x] `"use node"` send action via `web-push`: fan out to all the user's subscriptions, delete on 404/410
- [x] Wire push to match + booking-status events only (completed/rating stay in-app per PRD)
- [x] Install UX: capture `beforeinstallprompt` → offer after first successful post/booking; dismissible iOS instruction banner at the same moments

## M6 — Ratings

Goal: the trust layer. (Can run parallel to M5 — only needs M3's completion flow.)
**Done when:** after a completed trip, both parties rate each other exactly once; a second attempt is rejected; the new average shows on profile and trip pages.

- [x] `rate` mutation: `completed` bookings only, rater must be a party, one rating per rater per booking, updates ratee's `ratingAvg` + `ratingCount`
- [x] Rate UI on `/activity` for completed bookings (1–5 stars + optional comment, both roles)
- [x] `rating_received` in-app notification
- [x] Aggregates displayed: `/profile`, `/trips/[id]`, `/requests/[id]`

## M7 — Sharing, SEO & launch

Goal: the growth loop — links that unfurl, pages that index, a seeded corridor.
**Done when:** a trip link pasted into WhatsApp unfurls with an Arabic OG card (route, day/time, price); `sitemap.xml` lists all 132 route pages; Lighthouse reports installable PWA and fast load on throttled 4G; Amman↔Irbid has seed trips live.

- [x] `generateMetadata` for `/trips/[id]`, `/requests/[id]`, `/route/[from]/[to]` — Arabic titles/descriptions
- [x] OG image via `next/og`: Arabic card with route, day/time, price
- [x] Share button: Web Share API on mobile, clipboard fallback on desktop — on trip, request, and route pages
- [x] `sitemap.xml` (132 route pages) + `robots.txt`
- [x] Perf pass on public pages: minimal client JS, Lighthouse PWA + performance on throttled 4G / mid-range Android
- [ ] Production checklist: domain, prod VAPID keys, Convex prod env vars, smoke-test signup→post→book on prod — documented in [launch.md](./launch.md) (needs prod access, not executable from dev)
- [ ] Launch ops: seed Amman↔Irbid trips, share route + trip links into existing serfees Facebook/WhatsApp groups — mechanics documented in [launch.md](./launch.md) (human launch-day task)
