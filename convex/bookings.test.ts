/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const HOUR_MS = 60 * 60 * 1000;

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
      departAt: Date.now() + 3 * HOUR_MS,
      seatsTotal: 4,
      seatsAvailable: 4,
      pricePerSeat: 3.5,
      bookingMode: "instant",
      status: "open",
      ...overrides,
    }),
  );
}

async function getNotifications(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) =>
    ctx.db.query("notifications").take(50),
  );
}

async function expectConvexError(promise: Promise<unknown>, data: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ConvexError);
  expect((error as ConvexError<string>).data).toBe(data);
}

test("book requires auth and validates the boundary", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const passengerId = await createUser(t, { phone: "+962787777777" });
  const tripId = await insertTrip(t, driverId);
  const asPassenger = t.withIdentity({ subject: passengerId });

  await expectConvexError(
    t.mutation(api.bookings.book, { tripId, seats: 1 }),
    "not_signed_in",
  );
  for (const seats of [0, 5, 1.5, -1]) {
    await expectConvexError(
      asPassenger.mutation(api.bookings.book, { tripId, seats }),
      "not_enough_seats",
    );
  }

  const cancelledTrip = await insertTrip(t, driverId, { status: "cancelled" });
  await expectConvexError(
    asPassenger.mutation(api.bookings.book, { tripId: cancelledTrip, seats: 1 }),
    "trip_not_open",
  );
});

test("instant book confirms, decrements seats, and flips to full at 0", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const p1 = await createUser(t, { phone: "+962787777777" });
  const p2 = await createUser(t, { phone: "+962788888888" });
  const tripId = await insertTrip(t, driverId, {
    seatsTotal: 4,
    seatsAvailable: 4,
  });

  const bookingId = await t
    .withIdentity({ subject: p1 })
    .mutation(api.bookings.book, { tripId, seats: 3 });
  const [booking, trip] = await t.run(async (ctx) => [
    await ctx.db.get("bookings", bookingId),
    await ctx.db.get("trips", tripId),
  ]);
  expect(booking?.status).toBe("confirmed");
  expect(trip).toMatchObject({ seatsAvailable: 1, status: "open" });

  // The driver is notified about the instant confirmation.
  const notifications = await getNotifications(t);
  expect(notifications).toMatchObject([
    { userId: driverId, type: "booking_confirmed", tripId, bookingId },
  ]);

  // Last seat → trip full.
  await t
    .withIdentity({ subject: p2 })
    .mutation(api.bookings.book, { tripId, seats: 1 });
  const tripFull = await t.run(async (ctx) => ctx.db.get("trips", tripId));
  expect(tripFull).toMatchObject({ seatsAvailable: 0, status: "full" });

  // A full trip is no longer bookable (also guards the last-seat race:
  // Convex serializes these mutations, so the loser re-reads 0 seats).
  const p3 = await createUser(t, { phone: "+962789999999" });
  await expectConvexError(
    t
      .withIdentity({ subject: p3 })
      .mutation(api.bookings.book, { tripId, seats: 1 }),
    "trip_not_open",
  );
});

test("can't book own trip", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const tripId = await insertTrip(t, driverId);
  await expectConvexError(
    t
      .withIdentity({ subject: driverId })
      .mutation(api.bookings.book, { tripId, seats: 1 }),
    "own_trip",
  );
});

test("can't double-book while a pending or confirmed booking exists", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const passengerId = await createUser(t, { phone: "+962787777777" });
  const tripId = await insertTrip(t, driverId, { bookingMode: "approve" });
  const asPassenger = t.withIdentity({ subject: passengerId });

  const bookingId = await asPassenger.mutation(api.bookings.book, {
    tripId,
    seats: 1,
  });
  await expectConvexError(
    asPassenger.mutation(api.bookings.book, { tripId, seats: 1 }),
    "already_booked",
  );

  // After cancelling, booking again is allowed.
  await asPassenger.mutation(api.bookings.cancelBooking, { bookingId });
  await expect(
    asPassenger.mutation(api.bookings.book, { tripId, seats: 2 }),
  ).resolves.toBeDefined();
});

test("a book→cancel loop is capped, so booking rows can't flood a trip", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const passengerId = await createUser(t, { phone: "+962787777777" });
  const tripId = await insertTrip(t, driverId);
  const asPassenger = t.withIdentity({ subject: passengerId });

  for (let i = 0; i < 10; i++) {
    const bookingId = await asPassenger.mutation(api.bookings.book, {
      tripId,
      seats: 1,
    });
    await asPassenger.mutation(api.bookings.cancelBooking, { bookingId });
  }
  await expectConvexError(
    asPassenger.mutation(api.bookings.book, { tripId, seats: 1 }),
    "too_many_attempts",
  );
});

test("approve-mode holds no seats until the driver approves", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const passengerId = await createUser(t, { phone: "+962787777777" });
  const tripId = await insertTrip(t, driverId, {
    bookingMode: "approve",
    seatsTotal: 4,
    seatsAvailable: 4,
  });

  const bookingId = await t
    .withIdentity({ subject: passengerId })
    .mutation(api.bookings.book, { tripId, seats: 2 });
  let [booking, trip] = await t.run(async (ctx) => [
    await ctx.db.get("bookings", bookingId),
    await ctx.db.get("trips", tripId),
  ]);
  expect(booking?.status).toBe("pending");
  expect(trip).toMatchObject({ seatsAvailable: 4, status: "open" }); // no hold

  let notifications = await getNotifications(t);
  expect(notifications).toMatchObject([
    { userId: driverId, type: "booking_pending", tripId, bookingId },
  ]);

  // Only the trip's driver may approve.
  await expectConvexError(
    t
      .withIdentity({ subject: passengerId })
      .mutation(api.bookings.approve, { bookingId }),
    "not_your_trip",
  );

  await t
    .withIdentity({ subject: driverId })
    .mutation(api.bookings.approve, { bookingId });
  [booking, trip] = await t.run(async (ctx) => [
    await ctx.db.get("bookings", bookingId),
    await ctx.db.get("trips", tripId),
  ]);
  expect(booking?.status).toBe("confirmed");
  expect(trip).toMatchObject({ seatsAvailable: 2, status: "open" });

  notifications = await getNotifications(t);
  expect(notifications).toMatchObject([
    { userId: driverId, type: "booking_pending" },
    { userId: passengerId, type: "booking_confirmed", tripId, bookingId },
  ]);

  // Approving twice is blocked.
  await expectConvexError(
    t
      .withIdentity({ subject: driverId })
      .mutation(api.bookings.approve, { bookingId }),
    "booking_not_pending",
  );
});

test("approve beyond capacity is blocked at approval time", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const p1 = await createUser(t, { phone: "+962787777777" });
  const p2 = await createUser(t, { phone: "+962788888888" });
  const tripId = await insertTrip(t, driverId, {
    bookingMode: "approve",
    seatsTotal: 2,
    seatsAvailable: 2,
  });

  // Pending never holds seats, so both requests are accepted…
  const b1 = await t
    .withIdentity({ subject: p1 })
    .mutation(api.bookings.book, { tripId, seats: 2 });
  const b2 = await t
    .withIdentity({ subject: p2 })
    .mutation(api.bookings.book, { tripId, seats: 2 });

  const asDriver = t.withIdentity({ subject: driverId });
  await asDriver.mutation(api.bookings.approve, { bookingId: b1 });
  let trip = await t.run(async (ctx) => ctx.db.get("trips", tripId));
  expect(trip).toMatchObject({ seatsAvailable: 0, status: "full" });

  // …but the second approval re-checks capacity and is blocked.
  await expectConvexError(
    asDriver.mutation(api.bookings.approve, { bookingId: b2 }),
    "not_enough_seats",
  );
  const [second, tripAfter] = await t.run(async (ctx) => [
    await ctx.db.get("bookings", b2),
    await ctx.db.get("trips", tripId),
  ]);
  expect(second?.status).toBe("pending"); // untouched
  expect(tripAfter).toMatchObject({ seatsAvailable: 0, status: "full" });

  // The driver can still reject it.
  await asDriver.mutation(api.bookings.reject, { bookingId: b2 });
  const rejected = await t.run(async (ctx) => ctx.db.get("bookings", b2));
  expect(rejected?.status).toBe("rejected");
  trip = await t.run(async (ctx) => ctx.db.get("trips", tripId));
  expect(trip).toMatchObject({ seatsAvailable: 0, status: "full" }); // no seat change
  const notifications = await getNotifications(t);
  expect(
    notifications.filter((n) => n.type === "booking_rejected"),
  ).toMatchObject([{ userId: p2, tripId, bookingId: b2 }]);
});

test("cancel of a confirmed booking restores seats and full → open", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const passengerId = await createUser(t, { phone: "+962787777777" });
  const stranger = await createUser(t, { phone: "+962788888888" });
  const tripId = await insertTrip(t, driverId, {
    seatsTotal: 2,
    seatsAvailable: 2,
  });

  const bookingId = await t
    .withIdentity({ subject: passengerId })
    .mutation(api.bookings.book, { tripId, seats: 2 });
  const trip = await t.run(async (ctx) => ctx.db.get("trips", tripId));
  expect(trip).toMatchObject({ seatsAvailable: 0, status: "full" });

  // Only a party of the booking may cancel it.
  await expectConvexError(
    t
      .withIdentity({ subject: stranger })
      .mutation(api.bookings.cancelBooking, { bookingId }),
    "not_your_booking",
  );

  await t
    .withIdentity({ subject: passengerId })
    .mutation(api.bookings.cancelBooking, { bookingId });
  const [booking, tripAfter] = await t.run(async (ctx) => [
    await ctx.db.get("bookings", bookingId),
    await ctx.db.get("trips", tripId),
  ]);
  expect(booking?.status).toBe("cancelled");
  expect(tripAfter).toMatchObject({ seatsAvailable: 2, status: "open" });

  // Cancelling an already-cancelled booking is blocked.
  await expectConvexError(
    t
      .withIdentity({ subject: passengerId })
      .mutation(api.bookings.cancelBooking, { bookingId }),
    "cannot_cancel",
  );
});

test("the driver can cancel a confirmed booking too; pending cancel frees nothing", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const p1 = await createUser(t, { phone: "+962787777777" });
  const p2 = await createUser(t, { phone: "+962788888888" });
  const tripId = await insertTrip(t, driverId, {
    bookingMode: "approve",
    seatsTotal: 3,
    seatsAvailable: 3,
  });

  const confirmedId = await t
    .withIdentity({ subject: p1 })
    .mutation(api.bookings.book, { tripId, seats: 2 });
  const pendingId = await t
    .withIdentity({ subject: p2 })
    .mutation(api.bookings.book, { tripId, seats: 1 });
  const asDriver = t.withIdentity({ subject: driverId });
  await asDriver.mutation(api.bookings.approve, { bookingId: confirmedId });

  await asDriver.mutation(api.bookings.cancelBooking, {
    bookingId: confirmedId,
  });
  const trip = await t.run(async (ctx) => ctx.db.get("trips", tripId));
  expect(trip).toMatchObject({ seatsAvailable: 3, status: "open" });

  // Cancelling a pending booking never held seats, so nothing changes.
  await asDriver.mutation(api.bookings.cancelBooking, { bookingId: pendingId });
  const [pending, tripAfter] = await t.run(async (ctx) => [
    await ctx.db.get("bookings", pendingId),
    await ctx.db.get("trips", tripId),
  ]);
  expect(pending?.status).toBe("cancelled");
  expect(tripAfter).toMatchObject({ seatsAvailable: 3, status: "open" });
});

test("completeTrip is driver-only and cascades confirmed bookings", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const p1 = await createUser(t, { phone: "+962787777777" });
  const p2 = await createUser(t, { phone: "+962788888888" });
  const tripId = await insertTrip(t, driverId, {
    bookingMode: "approve",
    seatsTotal: 3,
    seatsAvailable: 3,
  });

  const confirmedId = await t
    .withIdentity({ subject: p1 })
    .mutation(api.bookings.book, { tripId, seats: 2 });
  const pendingId = await t
    .withIdentity({ subject: p2 })
    .mutation(api.bookings.book, { tripId, seats: 1 });
  const asDriver = t.withIdentity({ subject: driverId });
  await asDriver.mutation(api.bookings.approve, { bookingId: confirmedId });

  await expectConvexError(
    t.mutation(api.bookings.completeTrip, { tripId }),
    "not_signed_in",
  );
  await expectConvexError(
    t
      .withIdentity({ subject: p1 })
      .mutation(api.bookings.completeTrip, { tripId }),
    "not_your_trip",
  );

  await asDriver.mutation(api.bookings.completeTrip, { tripId });
  const [trip, confirmed, pending] = await t.run(async (ctx) => [
    await ctx.db.get("trips", tripId),
    await ctx.db.get("bookings", confirmedId),
    await ctx.db.get("bookings", pendingId),
  ]);
  expect(trip?.status).toBe("completed");
  expect(confirmed?.status).toBe("completed");
  expect(pending?.status).toBe("pending"); // only confirmed cascade

  const notifications = await getNotifications(t);
  expect(
    notifications.filter((n) => n.type === "trip_completed"),
  ).toMatchObject([{ userId: p1, tripId, bookingId: confirmedId }]);

  // Completed trips can't be completed again nor booked.
  await expectConvexError(
    asDriver.mutation(api.bookings.completeTrip, { tripId }),
    "cannot_complete",
  );
  await expectConvexError(
    t
      .withIdentity({ subject: p2 })
      .mutation(api.bookings.book, { tripId, seats: 1 }),
    "trip_not_open",
  );
});

test("myBookings joins trips and reveals the driver phone only when confirmed", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const passengerId = await createUser(t, { phone: "+962787777777" });
  const instantTrip = await insertTrip(t, driverId);
  const approveTrip = await insertTrip(t, driverId, {
    bookingMode: "approve",
  });
  const asPassenger = t.withIdentity({ subject: passengerId });

  await asPassenger.mutation(api.bookings.book, {
    tripId: instantTrip,
    seats: 1,
  });
  await asPassenger.mutation(api.bookings.book, {
    tripId: approveTrip,
    seats: 1,
  });

  expect(await t.query(api.bookings.myBookings, {})).toEqual([]); // anonymous

  const bookings = await asPassenger.query(api.bookings.myBookings, {});
  expect(bookings).toHaveLength(2);
  const pending = bookings.find((b) => b.status === "pending");
  const confirmed = bookings.find((b) => b.status === "confirmed");
  expect(pending?.driver).not.toHaveProperty("phone");
  expect(confirmed?.driver).toMatchObject({ phone: "+962791111111" });
  expect(confirmed?.trip._id).toBe(instantTrip);
});

test("forMyTrip is driver-only and reveals passenger phones only when confirmed", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const p1 = await createUser(t, { phone: "+962787777777" });
  const p2 = await createUser(t, { phone: "+962788888888" });
  const tripId = await insertTrip(t, driverId, {
    bookingMode: "approve",
    seatsTotal: 3,
    seatsAvailable: 3,
  });
  const b1 = await t
    .withIdentity({ subject: p1 })
    .mutation(api.bookings.book, { tripId, seats: 1 });
  await t
    .withIdentity({ subject: p2 })
    .mutation(api.bookings.book, { tripId, seats: 1 });
  await t
    .withIdentity({ subject: driverId })
    .mutation(api.bookings.approve, { bookingId: b1 });

  // Anonymous and non-driver viewers get nothing.
  expect(await t.query(api.bookings.forMyTrip, { tripId })).toEqual([]);
  expect(
    await t
      .withIdentity({ subject: p1 })
      .query(api.bookings.forMyTrip, { tripId }),
  ).toEqual([]);

  const bookings = await t
    .withIdentity({ subject: driverId })
    .query(api.bookings.forMyTrip, { tripId });
  expect(bookings).toHaveLength(2);
  const confirmed = bookings.find((b) => b.status === "confirmed");
  const pending = bookings.find((b) => b.status === "pending");
  expect(confirmed?.passenger).toMatchObject({ phone: "+962787777777" });
  expect(pending?.passenger).not.toHaveProperty("phone");
});

test("myBookingForTrip returns the viewer's active booking, skipping cancelled", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const passengerId = await createUser(t, { phone: "+962787777777" });
  const tripId = await insertTrip(t, driverId);
  const asPassenger = t.withIdentity({ subject: passengerId });

  expect(
    await asPassenger.query(api.bookings.myBookingForTrip, { tripId }),
  ).toBeNull();

  const bookingId = await asPassenger.mutation(api.bookings.book, {
    tripId,
    seats: 2,
  });
  expect(
    await asPassenger.query(api.bookings.myBookingForTrip, { tripId }),
  ).toMatchObject({ _id: bookingId, seats: 2, status: "confirmed" });

  await asPassenger.mutation(api.bookings.cancelBooking, { bookingId });
  expect(
    await asPassenger.query(api.bookings.myBookingForTrip, { tripId }),
  ).toBeNull(); // cancelled → can book again
});
