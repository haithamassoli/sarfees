# Serfees Jordan — PRD

> Working title "Serfees" (سيرفيس, the local term for shared inter-city taxis). Placeholder.

## Summary

Mobile marketplace for inter-governorate travel in Jordan. Two intents in one app:

- **Drivers** post scheduled trips with seats, price, and approximate time.
- **Passengers** post on-demand ride requests, or book a seat on a posted trip.

The system cross-matches trips and requests by **governorate pair + time window** and pushes the *pre-existing* party when a counterpart appears. Cash only, driver sets price, coordination by revealed phone number, two-way ratings. Arabic-first, RTL, all 12 governorates. Expo (React Native) + Convex backend.

Out of MVP: payments, live tracking, ID verification, no-show penalties, in-app chat, map pins, SMS/OTP.

## Users

- **Passenger** — finds a posted trip and books a seat, or posts a request and waits for a driver.
- **Driver** — posts a trip (seats/price/time/mode), approves or auto-accepts bookings, accepts matching requests.

One account does both. Role is per action, not per user.

## Goals

- Post or find an inter-governorate ride in under a minute.
- Surface the relevant counterpart automatically (the match push).
- Zero payment/verification friction at launch.

## Non-goals (MVP)

In-app payment, live GPS tracking, ID/license verification, cancellation/no-show penalties, in-app chat, map pins/geocoding, recurring trips, SMS/OTP, search beyond route + date.

## Core concepts

| Concept | What it is |
|---|---|
| **Trip** | Driver's offer: route (origin/dest governorate), approximate depart time, seats, price/seat, booking mode (`instant`\|`approve`), optional area text + stops. |
| **Ride request** | Passenger's intent: route, approximate time, seats, optional area text. Drives matching + driver acceptance. |
| **Booking** | Confirmed link between a passenger and a trip (the seat reservation). Always references a trip; optionally references the request it came from. |
| **Match** | *Computed, never stored.* A trip and a request whose governorate pair is equal and whose times fall within ±90 min. |

## Matching & notifications

**Rule:** on creating a trip *or* a request, query open records of the opposite type on the same route within the time window, and push to their owners. The creator sees matches inline in the result screen — no push to the creator.

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
for (const t of hits) schedulePush(t.driverId, "potential_passenger", { tripId: t._id, requestId: r._id });
// symmetric for trip insert vs open requests
```

`MATCH_WINDOW_MS` is a single constant (default 90 min). Matching runs in the insert mutation; pushes are scheduled to an action.

## Flows

### Book a posted trip
Passenger opens trip → `Book(seats)`.
- **Instant** → booking `confirmed`, seats decremented now.
- **Approve** → booking `pending`; driver approves → `confirmed`, seats decremented (reject → nothing reserved).

On `confirmed`, both parties' phone numbers are revealed.

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

## Data model (Convex)

```ts
const GOV = v.union(
  v.literal("amman"), v.literal("irbid"), v.literal("zarqa"), v.literal("balqa"),
  v.literal("mafraq"), v.literal("jerash"), v.literal("ajloun"), v.literal("madaba"),
  v.literal("karak"), v.literal("tafilah"), v.literal("maan"), v.literal("aqaba"),
);

users: defineTable({
  phone: v.string(),            // login id
  name: v.string(),
  pushToken: v.optional(v.string()),
  vehicle: v.optional(v.object({ make: v.string(), color: v.string(), plate: v.string() })),
  ratingAvg: v.number(),        // 0 if none
  ratingCount: v.number(),
}).index("by_phone", ["phone"]),
// password hash lives in Convex Auth's own tables

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

Convex Auth, **Password** provider. Identifier = phone number. No email, no SMS/OTP. Signup: phone, password, name → minimal profile (`ratingAvg=0`, `ratingCount=0`). Vehicle fields optional, filled later, shown to passengers on trips.

## Notifications

Expo Push. Store `pushToken` per user. A Convex action posts to the Expo push API.

| Trigger | To | MVP |
|---|---|---|
| Match found (potential passenger/driver) | pre-existing party | push |
| Booking pending | driver | push |
| Booking confirmed / rejected | passenger | push |
| Trip completed | passengers | in-app only |
| New rating received | ratee | in-app only |

```
// ponytail: ship push only for match + booking-status. Rest is in-app badges.
// Wire their pushes when users ask for them.
```

## Screens (Expo Router)

- **Auth** — sign up (phone, password, name), log in.
- **Find a ride** — search trips by route (origin/dest gov) + date → list → **Trip detail** (driver name, rating, vehicle, route, time, price, seats, stops) → Book.
- **Post a trip** — driver form (route, time, seats, price, mode, optional area/stops/note).
- **Request a ride** — passenger form (route, time, seats, optional area/note) → result screen shows inline matches.
- **My activity** —
  - As driver: my trips + incoming bookings to approve + "mark completed".
  - As passenger: my bookings + my requests with matched drivers.
- **Notifications** — match + booking events.
- **Profile** — vehicle, ratings, edit, log out.
- **Rate** — after completion, rate the counterpart.

Phone numbers render only when a booking is `confirmed`.

## i18n / RTL

Arabic default, English secondary. RTL layout throughout. Governorate names localized via the `GOV` enum. Translation files `ar.json` / `en.json`.

## Non-functional

- Reactive Convex queries for live seat/booking state.
- Validate at the mutation boundary: `seats > 0`, `price >= 0`, `originGov != destGov`, `departAt` in the future.
- Phone hidden until `confirmed`.

## Risks (accepted for MVP)

Open signup + cash + no verification ⇒ trust/safety and no-show exposure. Ratings are the only soft signal. Spam/abuse possible. Mitigations deferred.

## Next (post-MVP)

Verification (phone OTP, license), payments, live tracking, in-app chat, structured pickup areas + map, richer search filters, cancellation policy + penalties, reporting/blocking, recurring trips.
