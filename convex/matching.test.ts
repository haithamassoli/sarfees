/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const MIN_MS = 60 * 1000;
const HOUR_MS = 60 * MIN_MS;

function setup() {
  return convexTest(schema, modules);
}

async function createUser(
  t: ReturnType<typeof convexTest>,
  overrides: Record<string, unknown> = {},
): Promise<Id<"users">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("users", {
      name: "أبو خالد",
      phone: "+962791111111",
      ratingAvg: 4.5,
      ratingCount: 10,
      vehicle: { make: "كيا سيراتو", color: "أبيض", plate: "12-34567" },
      ...overrides,
    }),
  );
}

async function insertTrip(
  t: ReturnType<typeof convexTest>,
  driverId: Id<"users">,
  overrides: Partial<Omit<Doc<"trips">, "_id" | "_creationTime">> = {},
): Promise<Id<"trips">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("trips", {
      driverId,
      originGov: "amman",
      destGov: "irbid",
      departAt: Date.now() + 24 * HOUR_MS,
      seatsTotal: 4,
      seatsAvailable: 4,
      pricePerSeat: 3.5,
      bookingMode: "instant",
      status: "open",
      ...overrides,
    }),
  );
}

function requestArgs(
  desiredAt: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    originGov: "amman" as const,
    destGov: "irbid" as const,
    desiredAt,
    seats: 1,
    ...overrides,
  };
}

async function getNotifications(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => ctx.db.query("notifications").take(50));
}

async function expectConvexError(promise: Promise<unknown>, data: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ConvexError);
  expect((error as ConvexError<string>).data).toBe(data);
}

test("match window: exactly ±90 min is included, ±91 min is excluded", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const passengerId = await createUser(t, { phone: "+962787777777" });
  const desiredAt = Date.now() + 48 * HOUR_MS;

  const atMinus90 = await insertTrip(t, driverId, {
    departAt: desiredAt - 90 * MIN_MS,
  });
  const atPlus90 = await insertTrip(t, driverId, {
    departAt: desiredAt + 90 * MIN_MS,
  });
  await insertTrip(t, driverId, { departAt: desiredAt - 91 * MIN_MS });
  await insertTrip(t, driverId, { departAt: desiredAt + 91 * MIN_MS });
  // Same window, different route: never a match.
  await insertTrip(t, driverId, {
    originGov: "irbid",
    destGov: "amman",
    departAt: desiredAt,
  });

  const { matches } = await t
    .withIdentity({ subject: passengerId })
    .mutation(api.requests.createRequest, requestArgs(desiredAt));

  // Sorted by departAt ascending; drivers stripped to the public payload.
  expect(matches.map((m) => m._id)).toEqual([atMinus90, atPlus90]);
  expect(matches[0].driver).not.toHaveProperty("phone");
  expect(matches[0].driver.vehicle).not.toHaveProperty("plate");

  const notifications = await getNotifications(t);
  const potential = notifications.filter(
    (n) => n.type === "potential_passenger",
  );
  expect(potential).toHaveLength(2);
  expect(potential.map((n) => n.tripId).sort()).toEqual(
    [atMinus90, atPlus90].sort(),
  );
  expect(potential.every((n) => n.userId === driverId)).toBe(true);
});

test("seat fit: trips with fewer available seats than requested don't match", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const passengerId = await createUser(t, { phone: "+962787777777" });
  const desiredAt = Date.now() + 48 * HOUR_MS;

  await insertTrip(t, driverId, { departAt: desiredAt, seatsAvailable: 2 });

  const tooBig = await t
    .withIdentity({ subject: passengerId })
    .mutation(api.requests.createRequest, requestArgs(desiredAt, { seats: 3 }));
  expect(tooBig.matches).toEqual([]);
  expect(await getNotifications(t)).toEqual([]);

  const fits = await t
    .withIdentity({ subject: passengerId })
    .mutation(api.requests.createRequest, requestArgs(desiredAt, { seats: 2 }));
  expect(fits.matches).toHaveLength(1);
  expect(fits.matches[0].seatsAvailable).toBe(2);
});

test("the creator is never notified — not even for their own posts", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const passengerId = await createUser(t, { phone: "+962787777777" });
  const desiredAt = Date.now() + 48 * HOUR_MS;
  await insertTrip(t, driverId, { departAt: desiredAt });

  await t
    .withIdentity({ subject: passengerId })
    .mutation(api.requests.createRequest, requestArgs(desiredAt));

  const notifications = await getNotifications(t);
  expect(notifications).toHaveLength(1);
  expect(notifications[0].userId).toBe(driverId); // the pre-existing party
  expect(
    notifications.filter((n) => n.userId === passengerId),
  ).toEqual([]);

  // A user's own open trip neither matches nor notifies when they post a
  // request on the same route/time — others' trips still do.
  const soloId = await createUser(t, { phone: "+962788888888" });
  const ownTrip = await insertTrip(t, soloId, { departAt: desiredAt });
  const { matches } = await t
    .withIdentity({ subject: soloId })
    .mutation(api.requests.createRequest, requestArgs(desiredAt));
  expect(matches.map((m) => m._id)).not.toContain(ownTrip);
  expect(matches).toHaveLength(1); // driverId's trip only
  const after = await getNotifications(t);
  expect(after.filter((n) => n.userId === soloId)).toEqual([]);
});

test("each pair is evaluated once — at creation of the second side", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const passengerId = await createUser(t, { phone: "+962787777777" });
  const departAt = Date.now() + 48 * HOUR_MS;

  // First side: no counterpart yet → no matches, no notifications.
  const posted = await t.withIdentity({ subject: driverId }).mutation(
    api.trips.createTrip,
    {
      originGov: "amman",
      destGov: "irbid",
      departAt,
      seatsTotal: 4,
      pricePerSeat: 3.5,
      bookingMode: "instant",
    },
  );
  expect(posted.matches).toEqual([]);
  expect(await getNotifications(t)).toEqual([]);

  // Second side: the request evaluates the pair — the trip's driver is
  // notified exactly once, the request's creator not at all.
  await t
    .withIdentity({ subject: passengerId })
    .mutation(api.requests.createRequest, requestArgs(departAt + 30 * MIN_MS));
  const notifications = await getNotifications(t);
  expect(notifications).toMatchObject([
    { userId: driverId, type: "potential_passenger", tripId: posted.tripId },
  ]);

  // Symmetric direction: open request first, then a matching trip → the
  // passenger is notified once and the trip mutation returns the match.
  const t2 = setup();
  const driver2 = await createUser(t2);
  const passenger2 = await createUser(t2, { phone: "+962787777777" });
  const { requestId } = await t2
    .withIdentity({ subject: passenger2 })
    .mutation(api.requests.createRequest, requestArgs(departAt));
  expect(await getNotifications(t2)).toEqual([]);

  const second = await t2.withIdentity({ subject: driver2 }).mutation(
    api.trips.createTrip,
    {
      originGov: "amman",
      destGov: "irbid",
      departAt: departAt - 45 * MIN_MS,
      seatsTotal: 4,
      pricePerSeat: 3,
      bookingMode: "instant",
    },
  );
  expect(second.matches.map((m) => m._id)).toEqual([requestId]);
  expect(second.matches[0].passenger).not.toHaveProperty("phone");
  expect(await getNotifications(t2)).toMatchObject([
    {
      userId: passenger2,
      type: "potential_driver",
      tripId: second.tripId,
      requestId,
    },
  ]);
});

test("createRequest validates the boundary and rate limit", async () => {
  const t = setup();
  const passengerId = await createUser(t);
  const asPassenger = t.withIdentity({ subject: passengerId });
  const desiredAt = Date.now() + 48 * HOUR_MS;

  await expectConvexError(
    t.mutation(api.requests.createRequest, requestArgs(desiredAt)),
    "not_signed_in",
  );
  await expectConvexError(
    asPassenger.mutation(
      api.requests.createRequest,
      requestArgs(desiredAt, { destGov: "amman" }),
    ),
    "same_gov",
  );
  for (const seats of [0, 5, 1.5]) {
    await expectConvexError(
      asPassenger.mutation(
        api.requests.createRequest,
        requestArgs(desiredAt, { seats }),
      ),
      "invalid_request_seats",
    );
  }
  await expectConvexError(
    asPassenger.mutation(
      api.requests.createRequest,
      requestArgs(Date.now() - 1000),
    ),
    "depart_in_past",
  );
  await expectConvexError(
    asPassenger.mutation(
      api.requests.createRequest,
      requestArgs(desiredAt, { note: "م".repeat(201) }),
    ),
    "text_too_long",
  );

  const { requestId } = await asPassenger.mutation(
    api.requests.createRequest,
    requestArgs(desiredAt),
  );
  await asPassenger.mutation(api.requests.createRequest, requestArgs(desiredAt));
  await asPassenger.mutation(api.requests.createRequest, requestArgs(desiredAt));
  await expectConvexError(
    asPassenger.mutation(api.requests.createRequest, requestArgs(desiredAt)),
    "too_many_open",
  );

  // Cancelling frees a slot.
  await asPassenger.mutation(api.requests.cancelRequest, { id: requestId });
  await expect(
    asPassenger.mutation(api.requests.createRequest, requestArgs(desiredAt)),
  ).resolves.toBeDefined();
});

test("cancelRequest is owner-only and open-only", async () => {
  const t = setup();
  const passengerId = await createUser(t);
  const strangerId = await createUser(t, { phone: "+962787777777" });
  const { requestId } = await t
    .withIdentity({ subject: passengerId })
    .mutation(
      api.requests.createRequest,
      requestArgs(Date.now() + 48 * HOUR_MS),
    );

  await expectConvexError(
    t.mutation(api.requests.cancelRequest, { id: requestId }),
    "not_signed_in",
  );
  await expectConvexError(
    t
      .withIdentity({ subject: strangerId })
      .mutation(api.requests.cancelRequest, { id: requestId }),
    "not_your_request",
  );

  await t
    .withIdentity({ subject: passengerId })
    .mutation(api.requests.cancelRequest, { id: requestId });
  const request = await t.run(async (ctx) =>
    ctx.db.get("rideRequests", requestId),
  );
  expect(request?.status).toBe("cancelled");

  await expectConvexError(
    t
      .withIdentity({ subject: passengerId })
      .mutation(api.requests.cancelRequest, { id: requestId }),
    "cannot_cancel",
  );
});

test("accept creates a full trip + confirmed booking and reveals phones", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const passengerId = await createUser(t, { phone: "+962787777777" });
  const desiredAt = Date.now() + 48 * HOUR_MS;
  const { requestId } = await t
    .withIdentity({ subject: passengerId })
    .mutation(
      api.requests.createRequest,
      requestArgs(desiredAt, { seats: 3, originArea: "صويلح" }),
    );
  const asDriver = t.withIdentity({ subject: driverId });

  await expectConvexError(
    t.mutation(api.requests.accept, {
      requestId,
      pricePerSeat: 4,
      departAt: desiredAt,
    }),
    "not_signed_in",
  );
  await expectConvexError(
    t.withIdentity({ subject: passengerId }).mutation(api.requests.accept, {
      requestId,
      pricePerSeat: 4,
      departAt: desiredAt,
    }),
    "own_request",
  );
  await expectConvexError(
    asDriver.mutation(api.requests.accept, {
      requestId,
      pricePerSeat: 4.1,
      departAt: desiredAt,
    }),
    "invalid_price",
  );
  await expectConvexError(
    asDriver.mutation(api.requests.accept, {
      requestId,
      pricePerSeat: 4,
      departAt: Date.now() - 1000,
    }),
    "depart_in_past",
  );

  const tripId = await asDriver.mutation(api.requests.accept, {
    requestId,
    pricePerSeat: 4,
    departAt: desiredAt + 15 * MIN_MS,
  });

  const [trip, request, bookings] = await t.run(async (ctx) => [
    await ctx.db.get("trips", tripId),
    await ctx.db.get("rideRequests", requestId),
    await ctx.db
      .query("bookings")
      .withIndex("by_trip", (q) => q.eq("tripId", tripId))
      .take(10),
  ]);
  expect(trip).toMatchObject({
    driverId,
    originGov: "amman",
    destGov: "irbid",
    originArea: "صويلح",
    seatsTotal: 3,
    seatsAvailable: 0,
    pricePerSeat: 4,
    bookingMode: "instant",
    status: "full",
  });
  expect(request?.status).toBe("matched");
  expect(bookings).toMatchObject([
    { passengerId, requestId, seats: 3, status: "confirmed" },
  ]);

  // The passenger is notified of the confirmed booking.
  const notifications = await getNotifications(t);
  expect(
    notifications.filter((n) => n.type === "booking_confirmed"),
  ).toMatchObject([
    { userId: passengerId, tripId, requestId, bookingId: bookings[0]._id },
  ]);

  // Privacy: the accepting driver now sees the passenger's phone; the
  // passenger sees the driver's through requests.mine; strangers see neither.
  const asDriverView = await asDriver.query(api.requests.get, {
    id: requestId,
  });
  expect(asDriverView?.passenger).toMatchObject({ phone: "+962787777777" });
  const anonymousView = await t.query(api.requests.get, { id: requestId });
  expect(anonymousView?.passenger).not.toHaveProperty("phone");

  const mine = await t
    .withIdentity({ subject: passengerId })
    .query(api.requests.mine, {});
  expect(mine).toHaveLength(1);
  expect(mine[0].status).toBe("matched");
  expect(mine[0].trip?._id).toBe(tripId);
  expect(mine[0].driver).toMatchObject({ phone: "+962791111111" });

  // A matched request can't be accepted again nor cancelled.
  await expectConvexError(
    asDriver.mutation(api.requests.accept, {
      requestId,
      pricePerSeat: 4,
      departAt: desiredAt,
    }),
    "request_not_open",
  );
  await expectConvexError(
    t
      .withIdentity({ subject: passengerId })
      .mutation(api.requests.cancelRequest, { id: requestId }),
    "cannot_cancel",
  );
});

test("cancelling the accepted booking or trip re-opens the request; completion completes it", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const passengerId = await createUser(t, { phone: "+962787777777" });
  const desiredAt = Date.now() + 48 * HOUR_MS;
  const asDriver = t.withIdentity({ subject: driverId });
  const { requestId } = await t
    .withIdentity({ subject: passengerId })
    .mutation(api.requests.createRequest, requestArgs(desiredAt));
  const acceptArgs = { requestId, pricePerSeat: 4, departAt: desiredAt };
  const requestStatus = async () =>
    (await t.run(async (ctx) => ctx.db.get("rideRequests", requestId)))
      ?.status;

  // Either party backing out of the confirmed booking un-matches the request
  // (before, it was stranded at "matched": un-cancellable, un-matchable).
  const firstTrip = await asDriver.mutation(api.requests.accept, acceptArgs);
  const booking = await t.run(async (ctx) =>
    ctx.db
      .query("bookings")
      .withIndex("by_trip", (q) => q.eq("tripId", firstTrip))
      .unique(),
  );
  if (booking === null) throw new Error("accept created no booking");
  await asDriver.mutation(api.bookings.cancelBooking, {
    bookingId: booking._id,
  });
  expect(await requestStatus()).toBe("open");

  // …so it can be accepted again; cancelling the whole trip also re-opens.
  const secondTrip = await asDriver.mutation(api.requests.accept, acceptArgs);
  await asDriver.mutation(api.trips.cancelTrip, { id: secondTrip });
  expect(await requestStatus()).toBe("open");

  // Completing the accepted trip carries the request to completed.
  const thirdTrip = await asDriver.mutation(api.requests.accept, acceptArgs);
  await asDriver.mutation(api.bookings.completeTrip, { tripId: thirdTrip });
  expect(await requestStatus()).toBe("completed");
});

test("requests.byRoute honors the optional Amman-time day filter", async () => {
  const t = setup();
  const passengerId = await createUser(t);
  const asPassenger = t.withIdentity({ subject: passengerId });

  // A fixed Amman day comfortably in the future.
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Amman",
  }).format(Date.now() + 72 * HOUR_MS);
  const { requestId: onDay } = await asPassenger.mutation(
    api.requests.createRequest,
    requestArgs(Date.parse(`${day}T12:00:00+03:00`)),
  );
  const { requestId: beforeDay } = await asPassenger.mutation(
    api.requests.createRequest,
    requestArgs(Date.now() + 3 * HOUR_MS),
  );

  const all = await t.query(api.requests.byRoute, {
    from: "amman",
    to: "irbid",
  });
  expect(all.map((request) => request._id)).toEqual([beforeDay, onDay]);

  const filtered = await t.query(api.requests.byRoute, {
    from: "amman",
    to: "irbid",
    date: day,
  });
  expect(filtered.map((request) => request._id)).toEqual([onDay]);
});

test("notifications feed: enrichment, unread count, mark read", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const passengerId = await createUser(t, { phone: "+962787777777" });
  const desiredAt = Date.now() + 48 * HOUR_MS;
  await insertTrip(t, driverId, { departAt: desiredAt });
  const { requestId } = await t
    .withIdentity({ subject: passengerId })
    .mutation(api.requests.createRequest, requestArgs(desiredAt));
  const asDriver = t.withIdentity({ subject: driverId });

  expect(await t.query(api.notifications.unreadCount, {})).toBe(0); // anonymous
  expect(await asDriver.query(api.notifications.unreadCount, {})).toBe(1);
  expect(
    await t
      .withIdentity({ subject: passengerId })
      .query(api.notifications.unreadCount, {}),
  ).toBe(0);

  const feed = await asDriver.query(api.notifications.list, {});
  expect(feed).toMatchObject([
    {
      type: "potential_passenger",
      route: { from: "amman", to: "irbid" },
      when: desiredAt,
      href: `/requests/${requestId}`,
    },
  ]);
  expect(feed[0].readAt).toBeUndefined();

  // Only the owner may mark a notification read.
  await expectConvexError(
    t
      .withIdentity({ subject: passengerId })
      .mutation(api.notifications.markRead, { id: feed[0]._id }),
    "not_found",
  );
  await asDriver.mutation(api.notifications.markRead, { id: feed[0]._id });
  expect(await asDriver.query(api.notifications.unreadCount, {})).toBe(0);

  // markAllRead clears a backlog.
  await t
    .withIdentity({ subject: passengerId })
    .mutation(api.requests.createRequest, requestArgs(desiredAt + 10 * MIN_MS));
  await t
    .withIdentity({ subject: passengerId })
    .mutation(api.requests.createRequest, requestArgs(desiredAt - 10 * MIN_MS));
  expect(await asDriver.query(api.notifications.unreadCount, {})).toBe(2);
  await asDriver.mutation(api.notifications.markAllRead, {});
  expect(await asDriver.query(api.notifications.unreadCount, {})).toBe(0);
});
