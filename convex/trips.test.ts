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

function validArgs(overrides: Record<string, unknown> = {}) {
  return {
    originGov: "amman" as const,
    destGov: "irbid" as const,
    departAt: Date.now() + 3 * HOUR_MS,
    seatsTotal: 4,
    pricePerSeat: 3.5,
    bookingMode: "instant" as const,
    ...overrides,
  };
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

async function expectConvexError(promise: Promise<unknown>, data: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ConvexError);
  expect((error as ConvexError<string>).data).toBe(data);
}

test("createTrip requires auth", async () => {
  const t = setup();
  await expectConvexError(
    t.mutation(api.trips.createTrip, validArgs()),
    "not_signed_in",
  );
});

test("createTrip validates the boundary", async () => {
  const t = setup();
  const userId = await createUser(t);
  const asUser = t.withIdentity({ subject: userId });

  await expectConvexError(
    asUser.mutation(api.trips.createTrip, validArgs({ destGov: "amman" })),
    "same_gov",
  );
  for (const seatsTotal of [0, 8, 2.5]) {
    await expectConvexError(
      asUser.mutation(api.trips.createTrip, validArgs({ seatsTotal })),
      "invalid_seats",
    );
  }
  for (const pricePerSeat of [-1, 1000, 3.1]) {
    await expectConvexError(
      asUser.mutation(api.trips.createTrip, validArgs({ pricePerSeat })),
      "invalid_price",
    );
  }
  await expectConvexError(
    asUser.mutation(
      api.trips.createTrip,
      validArgs({ departAt: Date.now() - 1000 }),
    ),
    "depart_in_past",
  );
  await expectConvexError(
    asUser.mutation(api.trips.createTrip, validArgs({ note: "م".repeat(201) })),
    "text_too_long",
  );
});

test("createTrip inserts an open trip with all seats available", async () => {
  const t = setup();
  const userId = await createUser(t);
  const asUser = t.withIdentity({ subject: userId });

  const { tripId } = await asUser.mutation(
    api.trips.createTrip,
    validArgs({
      originArea: "  صويلح  ",
      stops: ["جرش", "  ", "سوف"],
      note: "",
    }),
  );
  const trip = await t.run(async (ctx) => ctx.db.get("trips", tripId));
  expect(trip).toMatchObject({
    driverId: userId,
    status: "open",
    seatsTotal: 4,
    seatsAvailable: 4,
    originArea: "صويلح",
    stops: ["جرش", "سوف"],
  });
  expect(trip?.note).toBeUndefined();
});

test("createTrip blocks a 4th open trip and unblocks after cancel", async () => {
  const t = setup();
  const userId = await createUser(t);
  const asUser = t.withIdentity({ subject: userId });

  const { tripId: first } = await asUser.mutation(
    api.trips.createTrip,
    validArgs(),
  );
  await asUser.mutation(api.trips.createTrip, validArgs());
  await asUser.mutation(api.trips.createTrip, validArgs());
  await expectConvexError(
    asUser.mutation(api.trips.createTrip, validArgs()),
    "too_many_open",
  );

  await asUser.mutation(api.trips.cancelTrip, { id: first });
  await expect(
    asUser.mutation(api.trips.createTrip, validArgs()),
  ).resolves.toBeDefined();
});

test("latest lists only open future trips, ascending, with a stripped driver", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const future = await insertTrip(t, driverId, {
    departAt: Date.now() + 5 * HOUR_MS,
  });
  const sooner = await insertTrip(t, driverId, {
    departAt: Date.now() + 2 * HOUR_MS,
  });
  await insertTrip(t, driverId, { departAt: Date.now() - HOUR_MS }); // past
  await insertTrip(t, driverId, { status: "cancelled" }); // not open

  const trips = await t.query(api.trips.latest, {});
  expect(trips.map((trip) => trip._id)).toEqual([sooner, future]);
  const driver = trips[0].driver;
  expect(driver).toEqual({
    name: "أبو خالد",
    ratingAvg: 4.5,
    ratingCount: 10,
    vehicle: { make: "كيا سيراتو", color: "أبيض" },
  });
  expect(driver).not.toHaveProperty("phone");
  expect(driver.vehicle).not.toHaveProperty("plate");
});

test("byRoute filters by pair and optional Amman-time day window", async () => {
  const t = setup();
  const driverId = await createUser(t);

  // A fixed Amman day comfortably in the future.
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Amman",
  }).format(Date.now() + 72 * HOUR_MS);
  const onDay = await insertTrip(t, driverId, {
    departAt: Date.parse(`${day}T12:00:00+03:00`),
  });
  const beforeDay = await insertTrip(t, driverId, {
    departAt: Date.now() + 3 * HOUR_MS,
  });
  await insertTrip(t, driverId, { originGov: "irbid", destGov: "amman" });

  const all = await t.query(api.trips.byRoute, { from: "amman", to: "irbid" });
  expect(all.map((trip) => trip._id)).toEqual([beforeDay, onDay]);

  const filtered = await t.query(api.trips.byRoute, {
    from: "amman",
    to: "irbid",
    date: day,
  });
  expect(filtered.map((trip) => trip._id)).toEqual([onDay]);

  const garbage = await t.query(api.trips.byRoute, {
    from: "amman",
    to: "irbid",
    date: "not-a-date",
  });
  expect(garbage.map((trip) => trip._id)).toEqual([beforeDay, onDay]);
});

test("get reveals phone + plate only to the driver or a confirmed passenger", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const tripId = await insertTrip(t, driverId);
  const confirmedId = await createUser(t, { phone: "+962787777777" });
  const pendingId = await createUser(t, { phone: "+962788888888" });
  await t.run(async (ctx) => {
    await ctx.db.insert("bookings", {
      tripId,
      passengerId: confirmedId,
      seats: 1,
      status: "confirmed",
    });
    await ctx.db.insert("bookings", {
      tripId,
      passengerId: pendingId,
      seats: 1,
      status: "pending",
    });
  });

  const anonymous = await t.query(api.trips.get, { id: tripId });
  expect(anonymous?.driver).not.toHaveProperty("phone");
  expect(anonymous?.driver.vehicle).not.toHaveProperty("plate");

  const asPending = await t
    .withIdentity({ subject: pendingId })
    .query(api.trips.get, { id: tripId });
  expect(asPending?.driver).not.toHaveProperty("phone");

  const asDriver = await t
    .withIdentity({ subject: driverId })
    .query(api.trips.get, { id: tripId });
  expect(asDriver?.driver).toMatchObject({
    phone: "+962791111111",
    vehicle: { make: "كيا سيراتو", color: "أبيض", plate: "12-34567" },
  });

  const asConfirmed = await t
    .withIdentity({ subject: confirmedId })
    .query(api.trips.get, { id: tripId });
  expect(asConfirmed?.driver).toMatchObject({ phone: "+962791111111" });
});

test("cancelTrip is driver-only, open|full-only, and cascades bookings", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const otherId = await createUser(t, { phone: "+962787777777" });
  const tripId = await insertTrip(t, driverId, {
    status: "full",
    seatsAvailable: 1,
  });
  const [confirmedBooking, pendingBooking] = await t.run(async (ctx) => [
    await ctx.db.insert("bookings", {
      tripId,
      passengerId: otherId,
      seats: 2,
      status: "confirmed",
    }),
    await ctx.db.insert("bookings", {
      tripId,
      passengerId: otherId,
      seats: 1,
      status: "pending",
    }),
  ]);

  await expectConvexError(
    t.mutation(api.trips.cancelTrip, { id: tripId }),
    "not_signed_in",
  );
  await expectConvexError(
    t
      .withIdentity({ subject: otherId })
      .mutation(api.trips.cancelTrip, { id: tripId }),
    "not_your_trip",
  );

  await t
    .withIdentity({ subject: driverId })
    .mutation(api.trips.cancelTrip, { id: tripId });

  const [trip, confirmed, pending] = await t.run(async (ctx) => [
    await ctx.db.get("trips", tripId),
    await ctx.db.get("bookings", confirmedBooking),
    await ctx.db.get("bookings", pendingBooking),
  ]);
  expect(trip).toMatchObject({ status: "cancelled", seatsAvailable: 3 });
  expect(confirmed?.status).toBe("cancelled");
  expect(pending?.status).toBe("rejected");

  // Already cancelled → cannot cancel again.
  await expectConvexError(
    t
      .withIdentity({ subject: driverId })
      .mutation(api.trips.cancelTrip, { id: tripId }),
    "cannot_cancel",
  );
});

test("mine returns only the caller's trips, newest first", async () => {
  const t = setup();
  const driverId = await createUser(t);
  const otherId = await createUser(t, { phone: "+962787777777" });
  const first = await insertTrip(t, driverId);
  const second = await insertTrip(t, driverId, { status: "cancelled" });
  await insertTrip(t, otherId);

  expect(await t.query(api.trips.mine, {})).toEqual([]);

  const mine = await t
    .withIdentity({ subject: driverId })
    .query(api.trips.mine, {});
  expect(mine.map((trip) => trip._id)).toEqual([second, first]);
});
