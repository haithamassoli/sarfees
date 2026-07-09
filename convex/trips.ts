import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  MAX_BOOKING_ATTEMPTS_PER_TRIP,
  MAX_BOOKINGS_PER_TRIP,
  settleLinkedRequest,
} from "./bookings";
import { matchRequestsForTrip, matchedRequestValidator } from "./matching";
import { ammanDayWindow, MAX_OPEN_POSTS } from "./lib/shared";
import { cleanText, isValidPrice } from "./lib/text";
import {
  counterpartUserValidator,
  isRevealingStatus,
  publicUser,
  publicUserValidator,
  revealUser,
} from "./lib/privacy";
import {
  bookingModeValidator,
  govValidator,
  tripStatusValidator,
} from "./lib/validators";
import { notify } from "./notifications";

const MAX_STOPS = 10;

// Allowlisted trip fields for query payloads (no driverId — the driver is
// always joined through a privacy helper instead).
const tripFieldsValidator = {
  _id: v.id("trips"),
  originGov: govValidator,
  destGov: govValidator,
  departAt: v.number(),
  originArea: v.optional(v.string()),
  destArea: v.optional(v.string()),
  stops: v.optional(v.array(v.string())),
  seatsTotal: v.number(),
  seatsAvailable: v.number(),
  pricePerSeat: v.number(),
  bookingMode: bookingModeValidator,
  status: tripStatusValidator,
  note: v.optional(v.string()),
};

const listedTripValidator = v.object({
  ...tripFieldsValidator,
  driver: publicUserValidator,
});

function tripFields(trip: Doc<"trips">) {
  return {
    _id: trip._id,
    originGov: trip.originGov,
    destGov: trip.destGov,
    departAt: trip.departAt,
    originArea: trip.originArea,
    destArea: trip.destArea,
    stops: trip.stops,
    seatsTotal: trip.seatsTotal,
    seatsAvailable: trip.seatsAvailable,
    pricePerSeat: trip.pricePerSeat,
    bookingMode: trip.bookingMode,
    status: trip.status,
    note: trip.note,
  };
}

async function joinDrivers(ctx: QueryCtx, trips: Array<Doc<"trips">>) {
  const joined = await Promise.all(
    trips.map(async (trip) => {
      const driver = await ctx.db.get("users", trip.driverId);
      if (driver === null) return null; // users are never deleted in MVP
      return { ...tripFields(trip), driver: publicUser(driver) };
    }),
  );
  return joined.filter((trip) => trip !== null);
}

export const createTrip = mutation({
  args: {
    originGov: govValidator,
    destGov: govValidator,
    departAt: v.number(),
    seatsTotal: v.number(),
    pricePerSeat: v.number(),
    bookingMode: bookingModeValidator,
    originArea: v.optional(v.string()),
    destArea: v.optional(v.string()),
    stops: v.optional(v.array(v.string())),
    note: v.optional(v.string()),
  },
  // Matches come back inline so the success screen renders them without a
  // second round-trip; their passengers were notified, the creator never is.
  returns: v.object({
    tripId: v.id("trips"),
    matches: v.array(matchedRequestValidator),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("not_signed_in");

    // govValidator already guarantees both are valid governorates.
    if (args.originGov === args.destGov) throw new ConvexError("same_gov");
    if (
      !Number.isInteger(args.seatsTotal) ||
      args.seatsTotal < 1 ||
      args.seatsTotal > 7
    ) {
      throw new ConvexError("invalid_seats");
    }
    if (!isValidPrice(args.pricePerSeat)) {
      throw new ConvexError("invalid_price");
    }
    if (args.departAt <= Date.now()) throw new ConvexError("depart_in_past");

    const originArea = cleanText(args.originArea);
    const destArea = cleanText(args.destArea);
    const note = cleanText(args.note);
    const stops = (args.stops ?? [])
      .map((stop) => cleanText(stop))
      .filter((stop) => stop !== undefined);
    if (stops.length > MAX_STOPS) throw new ConvexError("text_too_long");

    // Anti-spam floor: max MAX_OPEN_POSTS open trips per driver.
    // ponytail: counts open trips among the driver's 100 newest; an open trip
    // older than 100 posts escapes the count. Add a by_driver_and_status index
    // if drivers ever get that prolific.
    const recent = await ctx.db
      .query("trips")
      .withIndex("by_driver", (q) => q.eq("driverId", userId))
      .order("desc")
      .take(100);
    const openCount = recent.filter((trip) => trip.status === "open").length;
    if (openCount >= MAX_OPEN_POSTS) throw new ConvexError("too_many_open");

    const tripId = await ctx.db.insert("trips", {
      driverId: userId,
      originGov: args.originGov,
      destGov: args.destGov,
      departAt: args.departAt,
      originArea,
      destArea,
      stops: stops.length > 0 ? stops : undefined,
      seatsTotal: args.seatsTotal,
      seatsAvailable: args.seatsTotal,
      pricePerSeat: args.pricePerSeat,
      bookingMode: args.bookingMode,
      status: "open",
      note,
    });

    // Match-on-insert: this trip is the second side for every open request
    // already on the route — notify their passengers exactly once, here.
    const trip = await ctx.db.get("trips", tripId);
    const matches = trip === null ? [] : await matchRequestsForTrip(ctx, trip);
    for (const match of matches) {
      await notify(ctx, {
        userId: match.passengerId,
        type: "potential_driver",
        tripId,
        requestId: match.summary._id,
      });
    }
    return { tripId, matches: matches.map((match) => match.summary) };
  },
});

/** Home page: the next departures across all routes. */
export const latest = query({
  args: {},
  returns: v.array(listedTripValidator),
  handler: async (ctx) => {
    const now = Date.now();
    const trips = await ctx.db
      .query("trips")
      .withIndex("by_status_and_departAt", (q) =>
        q.eq("status", "open").gte("departAt", now),
      )
      .order("asc")
      .take(12);
    return await joinDrivers(ctx, trips);
  },
});

/** Route page: upcoming open trips for a governorate pair, optional day filter. */
export const byRoute = query({
  args: {
    from: govValidator,
    to: govValidator,
    date: v.optional(v.string()), // YYYY-MM-DD, interpreted in Amman time
  },
  returns: v.array(listedTripValidator),
  handler: async (ctx, args) => {
    const { start, end } = ammanDayWindow(args.date, Date.now());

    // by_route_status can't range on departAt, so scan the 50 newest open
    // posts for the pair and window in JS.
    // ponytail: fine at MVP volume; add departAt to the index if a single
    // route ever holds >50 open trips.
    const trips = await ctx.db
      .query("trips")
      .withIndex("by_route_status", (q) =>
        q.eq("originGov", args.from).eq("destGov", args.to).eq("status", "open"),
      )
      .order("desc")
      .take(50);
    const upcoming = trips
      .filter((trip) => trip.departAt >= start && trip.departAt < end)
      .sort((a, b) => a.departAt - b.departAt);
    return await joinDrivers(ctx, upcoming);
  },
});

/**
 * Trip detail. Viewer-aware: the driver's phone + plate are included ONLY when
 * the viewer is the driver or holds a confirmed/completed booking on the trip.
 * `isMine` tells the booking panel to hide on the driver's own trip.
 */
export const get = query({
  args: { id: v.id("trips") },
  returns: v.union(
    v.null(),
    v.object({
      ...tripFieldsValidator,
      isMine: v.boolean(),
      driver: v.union(counterpartUserValidator, publicUserValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const trip = await ctx.db.get("trips", args.id);
    if (trip === null) return null;
    const driver = await ctx.db.get("users", trip.driverId);
    if (driver === null) return null;

    const viewerId = await getAuthUserId(ctx);
    const isMine = viewerId !== null && viewerId === trip.driverId;
    const entitled =
      viewerId !== null &&
      (isMine || (await hasConfirmedBooking(ctx, trip._id, viewerId)));

    return {
      ...tripFields(trip),
      isMine,
      driver: revealUser(driver, entitled),
    };
  },
});

async function hasConfirmedBooking(
  ctx: QueryCtx,
  tripId: Id<"trips">,
  userId: Id<"users">,
): Promise<boolean> {
  // Exact pair lookup; rows per (trip, passenger) are capped at booking time.
  const bookings = await ctx.db
    .query("bookings")
    .withIndex("by_trip_and_passenger", (q) =>
      q.eq("tripId", tripId).eq("passengerId", userId),
    )
    .take(MAX_BOOKING_ATTEMPTS_PER_TRIP);
  return bookings.some((booking) => isRevealingStatus(booking.status));
}

/** The signed-in driver's own trips, newest first (activity page). */
export const mine = query({
  args: {},
  returns: v.array(v.object(tripFieldsValidator)),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const trips = await ctx.db
      .query("trips")
      .withIndex("by_driver", (q) => q.eq("driverId", userId))
      .order("desc")
      .take(50);
    return trips.map(tripFields);
  },
});

export const cancelTrip = mutation({
  args: { id: v.id("trips") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("not_signed_in");
    const trip = await ctx.db.get("trips", args.id);
    if (trip === null) throw new ConvexError("trip_not_found");
    if (trip.driverId !== userId) throw new ConvexError("not_your_trip");
    if (trip.status !== "open" && trip.status !== "full") {
      throw new ConvexError("cannot_cancel");
    }

    // Cascade: confirmed → cancelled (seats released so the invariant
    // seatsAvailable + confirmed seats == seatsTotal holds, and any
    // accept()-linked request re-opens instead of staying matched). Every
    // confirmed booking holds ≥1 of seatsTotal seats, so seatsTotal bounds
    // the scan exactly.
    const confirmed = await ctx.db
      .query("bookings")
      .withIndex("by_trip_and_status", (q) =>
        q.eq("tripId", trip._id).eq("status", "confirmed"),
      )
      .take(trip.seatsTotal);
    let releasedSeats = 0;
    for (const booking of confirmed) {
      await ctx.db.patch("bookings", booking._id, { status: "cancelled" });
      await settleLinkedRequest(ctx, booking, "open");
      releasedSeats += booking.seats;
    }
    // Pending → rejected. Bounded like the driver's booking list: pending
    // rows are capped per passenger, so 200 needs ≥20 hostile accounts.
    const pending = await ctx.db
      .query("bookings")
      .withIndex("by_trip_and_status", (q) =>
        q.eq("tripId", trip._id).eq("status", "pending"),
      )
      .take(MAX_BOOKINGS_PER_TRIP);
    for (const booking of pending) {
      await ctx.db.patch("bookings", booking._id, { status: "rejected" });
    }
    await ctx.db.patch("trips", trip._id, {
      status: "cancelled",
      seatsAvailable: trip.seatsAvailable + releasedSeats,
    });
    return null;
  },
});
