# Serfees Jordan — PRD v2 (Next.js PWA)

> Working title "Serfees" (سيرفيس, the local term for shared inter-city taxis). Placeholder.
> Replaces the Expo/React Native PRD (`old-PRD.md`). Same marketplace, re-platformed as an installable web app — and web is not just a port target: **links are the growth mechanic**.

## Summary

Web marketplace (installable PWA) for inter-governorate travel in Jordan. Two intents in one app:

- **Drivers** post scheduled trips with seats, price, and approximate time.
- **Passengers** post on-demand ride requests, or book a seat on a posted trip.

The system cross-matches trips and requests by **governorate pair + time window** and pushes the *pre-existing* party when a counterpart appears. Cash only, driver sets price, coordination via revealed phone + WhatsApp link, two-way ratings. Arabic-first, RTL, all 12 governorates.

**Stack:** Next.js (App Router) on Vercel · Convex (data, auth, realtime, push actions) · Tailwind · Serwist (service worker).

**Why web (what v2 buys over v1):**

1. **Every trip and request is a public URL.** This coordination happens today in WhatsApp/Facebook groups — a link travels there; an app-store install doesn't. Route pages are server-rendered and Google-indexable.
2. **No app stores** — no fees, no review queue; ship and fix in minutes. Install is a home-screen prompt.
3. **Desktop for free** — same responsive pages.
4. **The trade:** push is no longer guaranteed-native. Web Push is solid on Android (Jordan's majority); on iPhone it works only after add-to-home-screen. Accepted for MVP — see Notifications.

Out of MVP: payments, live tracking, ID verification, no-show penalties, in-app chat, map pins, SMS/WhatsApp OTP, WhatsApp Cloud API alerts, English UI, offline data.

## Users

- **Passenger** — finds a posted trip and books a seat, or posts a request and waits for a driver.
- **Driver** — posts a trip (seats/price/time/mode), approves or auto-accepts bookings, accepts matching requests.

One account does both. Role is per action, not per user.

## Goals

- Post or find an inter-governorate ride in under a minute, without installing anything.
- Surface the relevant counterpart automatically (the match push).
- Every trip/request shareable as a link that unfurls well in WhatsApp.
- Zero payment/verification friction at launch.

## Non-goals (MVP)

In-app payment, live GPS tracking, ID/license verification, cancellation/no-show penalties, in-app chat, map pins/geocoding, recurring trips, OTP of any kind, search beyond route + date, offline reads/writes, English UI.

## Core concepts

| Concept | What it is |
|---|---|
| **Trip** | Driver's offer: route (origin/dest governorate), approximate depart time, seats, price/seat, booking mode (`instant`\|`approve`), optional area text + stops. |
| **Ride request** | Passenger's intent: route, approximate time, seats, optional area text. Drives matching + driver acceptance. |
| **Booking** | Confirmed link between a passenger and a trip (the seat reservation). Always references a trip; optionally the request it came from. |
| **Match** | *Computed, never stored.* A trip and a request whose governorate pair is equal and whose times fall within ±90 min. |

## Matching & notifications

**Rule (unchanged from v1):** on creating a trip *or* a request, query open records of the opposite type on the same route within the time window, and notify their owners. The creator sees matches inline on the result screen — no push to the creator.

- Passenger posts request → matching open trips' drivers get *"Potential passenger on your route."*
- Driver posts trip → matching open requests' passengers get *"Potential driver for your trip."*

Every (trip, request) pair is evaluated exactly once — at creation of whichever came second. No stored match table, no dedup bookkeeping.

```ts
// after inserting request r:
const trips = await db.query("trips")
  .withIndex("by_route_status", q =>
    q.eq("originGov", r.originGov).eq("destGov", r.destGov).eq("status", "open"))
  .collect();
const hits = trips.filter(t =>
  Math.abs(t.departAt - r.desiredAt) <= MATCH_WINDOW_MS && t.seatsAvailable >= r.seats);
for (const t of hits) notify(t.driverId, "potential_passenger", { tripId: t._id, requestId: r._id });
// symmetric for trip insert vs open requests
```

`MATCH_WINDOW_MS` is a single constant (default 90 min). `notify()` = insert a `notifications` row + schedule the push action.

**Delivery (new):** Web Push to all of the user's browser subscriptions (`pushSubscriptions` — a user has N browsers). A Convex `"use node"` action sends via the `web-push` package, VAPID keypair in env; subscriptions that return 404/410 are deleted. Every push also exists as an in-app `notifications` row — the feed is the fallback for users without push (uninstalled iOS). Push click deep-links to the trip/request.

**Permission:** requested only on explicit action — a "نبّهني عند وجود مطابقة" toggle on the post-success screen and in My activity — never on page load (browsers punish that). On iOS Safari without install, the toggle shows add-to-home-screen steps instead (the Notification API doesn't exist there).

## Flows

### Book a posted trip
Passenger opens trip → `Book(seats)`.
- **Instant** → booking `confirmed`, seats decremented now.
- **Approve** → booking `pending`; driver approves → `confirmed`, seats decremented (reject → nothing reserved).

On `confirmed`, both parties see phone + tap-to-call (`tel:`) + tap-to-WhatsApp (`wa.me/9627…`) — WhatsApp is the real channel.

### Driver accepts a ride request
Driver sees matching/open requests → `Accept` → enters price + confirms depart time (prefilled from request) → system creates a **trip** (`seatsTotal = request.seats`) + a `confirmed` **booking** linked to the request; request → `matched`. Phones revealed.

### Completion & rating
Driver marks trip `completed` → its `confirmed` bookings → `completed`. Both parties can rate each other per completed booking: 1–5 stars + optional comment. One rating per rater per booking. Ratee's aggregate (avg + count) updated.

### Cancellation
Either party cancels before completion → booking `cancelled`, seats released. No penalty, no enforcement.

## Seat accounting

- Reserve seats only on `confirmed` (instant book, or driver approval). `pending` bookings do **not** hold seats.
- At approval, re-check `seatsAvailable >= seats`; block if short.
- On `confirmed`, decrement; if `seatsAvailable == 0` → trip `full`.
- On cancel/reject of a `confirmed` booking, increment; if was `full` → `open`.
- Convex serializes mutations per document, so last-seat races resolve via OCC retry that re-reads `seatsAvailable`.

```
// ponytail: pending bookings don't hold seats; a driver in approve-mode can
// receive more pending requests than seats and approve until full, rest blocked.
// Add seat-hold/expiry only if overbooking complaints appear.
```

## Public pages, sharing & SEO

The core new surface. Browsing never requires an account; booking/posting/accepting does.

- **`/route/[from]/[to]`** — 132 indexable route pages ("سيرفيس من عمان إلى إربد"), SSR with `revalidate: 60`, listing upcoming open trips and open requests for the pair; optional `?date=` filter. Sitemap lists all 132 routes; individual trips expire too fast to sitemap.
- **`/trips/[id]`, `/requests/[id]`** — public detail pages: name, rating, vehicle make/color, route, time, price, seats, stops. **Phone and plate never appear in public payloads** — the Convex query returns them only to a counterpart with a `confirmed` booking (enforced server-side, not in UI).
- **Share** — Web Share API button (native share sheet → straight into the WhatsApp groups where demand already lives), clipboard fallback on desktop. `generateMetadata` per page + OG image via `next/og` (Arabic card: route, day/time, price). The WhatsApp unfurl is the ad.

## PWA

- **Manifest:** `name: "سيرفيس"`, `dir: "rtl"`, `lang: "ar"`, `display: "standalone"`, icons, theme color.
- **Service worker:** Serwist (`@serwist/next` — next-pwa is unmaintained). Precache the app shell, runtime-cache static assets, `push` + `notificationclick` handlers. Convex data rides its own WebSocket; the SW doesn't touch it.
- **Install UX:** Chromium — capture `beforeinstallprompt`, offer install after the first successful post/booking (the moment they have a reason to return). iOS — dismissible add-to-home-screen instruction banner at the same moments.
- **Offline:** app shell + "لا يوجد اتصال" state. No cached data, no queued actions — it's a live marketplace.

## Notifications

| Trigger | To | MVP |
|---|---|---|
| Match found (potential passenger/driver) | pre-existing party | push + in-app |
| Booking pending | driver | push + in-app |
| Booking confirmed / rejected | passenger | push + in-app |
| Trip completed | passengers | in-app only |
| New rating received | ratee | in-app only |

```
// ponytail: push wired only for match + booking-status; the rest is the in-app feed.
// If iOS push-miss measurably hurts matching, WhatsApp Cloud API alerts are the escalation.
```

## Data model (Convex)

Changes from v1: `users.pushToken` (single Expo token) → `pushSubscriptions` table (N browsers per user); new `notifications` table (v1 had a Notifications screen with no table behind it — now it's also the iOS fallback, so it's real). `trips`, `rideRequests`, `bookings`, `ratings` are unchanged.

```ts
const GOV = v.union(
  v.literal("amman"), v.literal("irbid"), v.literal("zarqa"), v.literal("balqa"),
  v.literal("mafraq"), v.literal("jerash"), v.literal("ajloun"), v.literal("madaba"),
  v.literal("karak"), v.literal("tafilah"), v.literal("maan"), v.literal("aqaba"),
);

users: defineTable({
  phone: v.string(),            // login id, E.164 (+9627…)
  name: v.string(),
  vehicle: v.optional(v.object({ make: v.string(), color: v.string(), plate: v.string() })),
  ratingAvg: v.number(),        // 0 if none
  ratingCount: v.number(),
}).index("by_phone", ["phone"]),
// password hash lives in Convex Auth's own tables

pushSubscriptions: defineTable({
  userId: v.id("users"),
  endpoint: v.string(),
  p256dh: v.string(),
  auth: v.string(),
}).index("by_user", ["userId"])
  .index("by_endpoint", ["endpoint"]),   // dedupe on re-subscribe, delete on 404/410

notifications: defineTable({
  userId: v.id("users"),
  type: v.union(v.literal("potential_passenger"), v.literal("potential_driver"),
                v.literal("booking_pending"), v.literal("booking_confirmed"),
                v.literal("booking_rejected"), v.literal("trip_completed"),
                v.literal("rating_received")),
  tripId: v.optional(v.id("trips")),
  requestId: v.optional(v.id("rideRequests")),
  bookingId: v.optional(v.id("bookings")),
  readAt: v.optional(v.number()),
}).index("by_user", ["userId"]),

trips: defineTable({
  driverId: v.id("users"),
  originGov: GOV, destGov: GOV,
  departAt: v.number(),
  originArea: v.optional(v.string()), destArea: v.optional(v.string()),
  stops: v.optional(v.array(v.string())),
  seatsTotal: v.number(), seatsAvailable: v.number(),
  pricePerSeat: v.number(),
  bookingMode: v.union(v.literal("instant"), v.literal("approve")),
  status: v.union(v.literal("open"), v.literal("full"), v.literal("completed"), v.literal("cancelled")),
  note: v.optional(v.string()),
}).index("by_route_status", ["originGov", "destGov", "status"])
  .index("by_driver", ["driverId"]),

rideRequests: defineTable({
  passengerId: v.id("users"),
  originGov: GOV, destGov: GOV,
  desiredAt: v.number(),
  originArea: v.optional(v.string()), destArea: v.optional(v.string()),
  seats: v.number(),
  status: v.union(v.literal("open"), v.literal("matched"), v.literal("completed"), v.literal("cancelled")),
  note: v.optional(v.string()),
}).index("by_route_status", ["originGov", "destGov", "status"])
  .index("by_passenger", ["passengerId"]),

bookings: defineTable({
  tripId: v.id("trips"),
  passengerId: v.id("users"),
  requestId: v.optional(v.id("rideRequests")),
  seats: v.number(),
  status: v.union(v.literal("pending"), v.literal("confirmed"), v.literal("rejected"),
                  v.literal("cancelled"), v.literal("completed")),
}).index("by_trip", ["tripId"])
  .index("by_passenger", ["passengerId"]),

ratings: defineTable({
  bookingId: v.id("bookings"),
  raterId: v.id("users"), rateeId: v.id("users"),
  stars: v.number(),            // 1..5
  comment: v.optional(v.string()),
}).index("by_ratee", ["rateeId"])
  .index("by_booking", ["bookingId"]),
```

## Auth

Convex Auth, **Password** provider, via `@convex-dev/auth`'s Next.js integration (server-side session, `convexAuthNextjsMiddleware`). Identifier = phone, normalized to E.164 at input (`07…` / `9627…` / `+9627…` all accepted). No OTP — accepted risk, see Risks. Signup: phone, password, name → minimal profile (`ratingAvg=0`, `ratingCount=0`). Vehicle optional, filled later, shown on trips.

Middleware guards `/trips/new`, `/requests/new`, `/activity`, `/notifications`, `/profile`. Everything else is public.

## Routes (App Router)

| Route | What | Access |
|---|---|---|
| `/` | search form (route + date) + latest departures | public, SSR |
| `/route/[from]/[to]` | route results: trips + open requests | public, SSR |
| `/trips/[id]` | trip detail → Book | public; Book = auth |
| `/requests/[id]` | request detail → Accept | public; Accept = auth |
| `/trips/new` | post a trip | auth |
| `/requests/new` | post a request → inline matches on result | auth |
| `/activity` | my trips + bookings to approve + complete + rate; my requests | auth, live |
| `/notifications` | in-app feed | auth, live |
| `/profile` | vehicle, ratings, logout | auth |
| `/login`, `/signup` | phone + password | public |

Logged-in views are client components on Convex `useQuery` — live seat counts and booking states. Public pages fetch server-side (`fetchQuery` from `convex/nextjs`); a slightly stale seat count there is fine, the booking mutation re-validates.

Mobile: bottom tab bar (Search / Post / Activity / Notifications / Profile). Desktop: same pages, top nav, max-width content. Native `<input type="date">` / `type="time"` — no picker lib.

## i18n / RTL

`<html lang="ar" dir="rtl">`. Tailwind logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`) make RTL free. Strings in `ar.json` from day one, but **Arabic-only at launch**. Governorate names localized off the `GOV` enum. All times rendered in `Asia/Amman` regardless of viewer clock.

```
// ponytail: no i18n framework for one language — ar.json + a t() helper.
// Add next-intl with an /en prefix when English demand is real, not before.
```

## Non-functional

- Validate at the mutation boundary: `seats > 0`, `price >= 0`, `originGov != destGov`, `departAt` in the future, phone is valid E.164.
- Phone and plate stripped server-side from every payload except a `confirmed` counterpart's.
- Anti-spam floor: max 3 open trips + 3 open requests per user, checked in the insert mutation. No captcha until abuse appears.
- Fast on mid-range Androids over mobile data: SSR public pages, minimal JS on them, PWA installable (Lighthouse).

## Risks (accepted for MVP)

- Open signup + cash + no verification ⇒ trust/safety and no-show exposure. Ratings are the only soft signal.
- Unverified phone can burn a confirmed booking (fake number). `wa.me` links soft-verify — dead numbers don't answer. Phone OTP is the first post-MVP fix if this bites.
- iOS users who don't install miss the match push — the core mechanic degrades to "open the app and check". Install banner + in-app feed mitigate; WhatsApp Cloud API alerts are the escalation.
- Public pages invite scraping/spam. Phones are never public; posting is rate-limited.

## Launch

All 12 governorates enabled (it's an enum), but liquidity is seeded corridor by corridor: **Amman↔Irbid** first (universities — the classic serfees crowd), then Amman↔Zarqa and Amman↔Aqaba. Mechanic: share route pages and fresh trip links into the existing serfees Facebook/WhatsApp groups. The share links are the acquisition channel; the groups are where demand already sits.

## Next (post-MVP)

Phone OTP (WhatsApp or SMS), WhatsApp Cloud API alerts, English `/en`, payments, live tracking, in-app chat, structured pickup areas + map, richer filters, cancellation policy + penalties, reporting/blocking, recurring trips.
