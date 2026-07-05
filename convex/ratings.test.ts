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
      ratingAvg: 0,
      ratingCount: 0,
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
      status: "completed",
      ...overrides,
    }),
  );
}

async function insertBooking(
  t: ReturnType<typeof convexTest>,
  tripId: Id<"trips">,
  passengerId: Id<"users">,
  status: Doc<"bookings">["status"] = "completed",
): Promise<Id<"bookings">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("bookings", { tripId, passengerId, seats: 1, status }),
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

test("rate validates auth, stars, and comment length", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const passengerId = await createUser(t, { phone: "+962787777777" });
  const tripId = await insertTrip(t, driverId);
  const bookingId = await insertBooking(t, tripId, passengerId);
  const asPassenger = t.withIdentity({ subject: passengerId });

  await expectConvexError(
    t.mutation(api.ratings.rate, { bookingId, stars: 5 }),
    "not_signed_in",
  );
  for (const stars of [0, 6, 2.5, -1]) {
    await expectConvexError(
      asPassenger.mutation(api.ratings.rate, { bookingId, stars }),
      "invalid_stars",
    );
  }
  await expectConvexError(
    asPassenger.mutation(api.ratings.rate, {
      bookingId,
      stars: 5,
      comment: "م".repeat(301),
    }),
    "comment_too_long",
  );
});

test("only completed bookings are ratable", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const passengerId = await createUser(t, { phone: "+962787777777" });
  const tripId = await insertTrip(t, driverId, { status: "open" });
  const asPassenger = t.withIdentity({ subject: passengerId });

  for (const status of ["pending", "confirmed", "rejected", "cancelled"] as const) {
    const bookingId = await insertBooking(t, tripId, passengerId, status);
    await expectConvexError(
      asPassenger.mutation(api.ratings.rate, { bookingId, stars: 5 }),
      "cannot_rate",
    );
  }

  const completedId = await insertBooking(t, tripId, passengerId, "completed");
  await expect(
    asPassenger.mutation(api.ratings.rate, { bookingId: completedId, stars: 5 }),
  ).resolves.toBeNull();
});

test("only the booking's passenger or the trip's driver may rate", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const passengerId = await createUser(t, { phone: "+962787777777" });
  const stranger = await createUser(t, { phone: "+962788888888" });
  const tripId = await insertTrip(t, driverId);
  const bookingId = await insertBooking(t, tripId, passengerId);

  await expectConvexError(
    t
      .withIdentity({ subject: stranger })
      .mutation(api.ratings.rate, { bookingId, stars: 5 }),
    "not_your_booking",
  );

  // Both parties rate — each targets the other side.
  await t
    .withIdentity({ subject: passengerId })
    .mutation(api.ratings.rate, { bookingId, stars: 5, comment: "سائق ممتاز" });
  await t
    .withIdentity({ subject: driverId })
    .mutation(api.ratings.rate, { bookingId, stars: 4 });

  const ratings = await t.run(async (ctx) => ctx.db.query("ratings").take(10));
  expect(ratings).toMatchObject([
    {
      bookingId,
      raterId: passengerId,
      rateeId: driverId,
      stars: 5,
      comment: "سائق ممتاز",
    },
    { bookingId, raterId: driverId, rateeId: passengerId, stars: 4 },
  ]);
});

test("one rating per rater per booking — the second attempt throws", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const passengerId = await createUser(t, { phone: "+962787777777" });
  const tripId = await insertTrip(t, driverId);
  const bookingId = await insertBooking(t, tripId, passengerId);
  const asPassenger = t.withIdentity({ subject: passengerId });

  await asPassenger.mutation(api.ratings.rate, { bookingId, stars: 5 });
  await expectConvexError(
    asPassenger.mutation(api.ratings.rate, { bookingId, stars: 1 }),
    "already_rated",
  );

  // The other direction is still allowed once, then blocked too.
  const asDriver = t.withIdentity({ subject: driverId });
  await asDriver.mutation(api.ratings.rate, { bookingId, stars: 3 });
  await expectConvexError(
    asDriver.mutation(api.ratings.rate, { bookingId, stars: 3 }),
    "already_rated",
  );

  const ratee = await t.run(async (ctx) => ctx.db.get("users", driverId));
  expect(ratee).toMatchObject({ ratingAvg: 5, ratingCount: 1 }); // unchanged by rejects
});

test("aggregates recompute correctly across ratings (via the real completion flow)", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const p1 = await createUser(t, { phone: "+962787777777" });
  const p2 = await createUser(t, { phone: "+962788888888" });
  const p3 = await createUser(t, { phone: "+962789999999" });
  const tripId = await insertTrip(t, driverId, { status: "open" });

  const b1 = await t
    .withIdentity({ subject: p1 })
    .mutation(api.bookings.book, { tripId, seats: 1 });
  const b2 = await t
    .withIdentity({ subject: p2 })
    .mutation(api.bookings.book, { tripId, seats: 1 });
  const b3 = await t
    .withIdentity({ subject: p3 })
    .mutation(api.bookings.book, { tripId, seats: 1 });
  await t
    .withIdentity({ subject: driverId })
    .mutation(api.bookings.completeTrip, { tripId });

  await t
    .withIdentity({ subject: p1 })
    .mutation(api.ratings.rate, { bookingId: b1, stars: 5 });
  let driver = await t.run(async (ctx) => ctx.db.get("users", driverId));
  expect(driver).toMatchObject({ ratingAvg: 5, ratingCount: 1 });

  await t
    .withIdentity({ subject: p2 })
    .mutation(api.ratings.rate, { bookingId: b2, stars: 4 });
  driver = await t.run(async (ctx) => ctx.db.get("users", driverId));
  expect(driver).toMatchObject({ ratingAvg: 4.5, ratingCount: 2 });

  // (4.5*2 + 4) / 3 = 4.333… → rounded to 2 decimals.
  await t
    .withIdentity({ subject: p3 })
    .mutation(api.ratings.rate, { bookingId: b3, stars: 4 });
  driver = await t.run(async (ctx) => ctx.db.get("users", driverId));
  expect(driver).toMatchObject({ ratingAvg: 4.33, ratingCount: 3 });

  // The driver's rating updates the passenger's aggregate, not his own.
  await t
    .withIdentity({ subject: driverId })
    .mutation(api.ratings.rate, { bookingId: b1, stars: 4 });
  const [passenger, driverAfter] = await t.run(async (ctx) => [
    await ctx.db.get("users", p1),
    await ctx.db.get("users", driverId),
  ]);
  expect(passenger).toMatchObject({ ratingAvg: 4, ratingCount: 1 });
  expect(driverAfter).toMatchObject({ ratingAvg: 4.33, ratingCount: 3 });
});

test("the ratee gets a rating_received notification", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const passengerId = await createUser(t, { phone: "+962787777777" });
  const tripId = await insertTrip(t, driverId);
  const bookingId = await insertBooking(t, tripId, passengerId);

  await t
    .withIdentity({ subject: passengerId })
    .mutation(api.ratings.rate, { bookingId, stars: 5 });

  const notifications = await t.run(async (ctx) =>
    ctx.db.query("notifications").take(10),
  );
  expect(notifications).toMatchObject([
    { userId: driverId, type: "rating_received", bookingId },
  ]);
});

test("myRatingsForBookings maps only the viewer's own stars", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const passengerId = await createUser(t, { phone: "+962787777777" });
  const tripId = await insertTrip(t, driverId);
  const rated = await insertBooking(t, tripId, passengerId);
  const unrated = await insertBooking(t, tripId, passengerId);

  await t
    .withIdentity({ subject: passengerId })
    .mutation(api.ratings.rate, { bookingId: rated, stars: 4 });
  // The driver's counter-rating must not leak into the passenger's map.
  await t
    .withIdentity({ subject: driverId })
    .mutation(api.ratings.rate, { bookingId: rated, stars: 2 });

  expect(
    await t.query(api.ratings.myRatingsForBookings, {
      bookingIds: [rated, unrated],
    }),
  ).toEqual({}); // anonymous

  expect(
    await t
      .withIdentity({ subject: passengerId })
      .query(api.ratings.myRatingsForBookings, {
        bookingIds: [rated, unrated],
      }),
  ).toEqual({ [rated]: 4 });

  expect(
    await t
      .withIdentity({ subject: driverId })
      .query(api.ratings.myRatingsForBookings, { bookingIds: [rated] }),
  ).toEqual({ [rated]: 2 });
});

test("forUser lists received ratings newest first with the rater's first name", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const p1 = await createUser(t, { name: "سارة أحمد", phone: "+962787777777" });
  const p2 = await createUser(t, { name: "عمر", phone: "+962788888888" });
  const tripId = await insertTrip(t, driverId);
  const b1 = await insertBooking(t, tripId, p1);
  const b2 = await insertBooking(t, tripId, p2);

  await t
    .withIdentity({ subject: p1 })
    .mutation(api.ratings.rate, { bookingId: b1, stars: 5, comment: "ممتاز" });
  await t
    .withIdentity({ subject: p2 })
    .mutation(api.ratings.rate, { bookingId: b2, stars: 3 });

  const received = await t.query(api.ratings.forUser, { userId: driverId });
  expect(received).toMatchObject([
    { stars: 3, raterName: "عمر" },
    { stars: 5, comment: "ممتاز", raterName: "سارة" },
  ]);
  expect(received[0]).not.toHaveProperty("comment");

  // Nothing received yet → empty list.
  expect(await t.query(api.ratings.forUser, { userId: p1 })).toEqual([]);
});
