import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  counterpartUserValidator,
  isRevealingStatus,
  publicUserValidator,
  revealUser,
} from "./lib/privacy";
import { isRevealRateLimited, MAX_REVEALS_PER_HOUR } from "./lib/shared";
import {
  bookingStatusValidator,
  govValidator,
  tripStatusValidator,
} from "./lib/validators";
import { notify } from "./notifications";

/**
 * Lifetime cap on booking rows per (trip, passenger): a book→cancel loop
 * can't flood a trip's booking rows, so every by_trip_and_passenger lookup
 * is exact and every by_trip scan stays honest.
 */
export const MAX_BOOKING_ATTEMPTS_PER_TRIP = 10;

/**
 * Driver-view display bound. Rows per passenger are capped at
 * MAX_BOOKING_ATTEMPTS_PER_TRIP, so exceeding 200 takes ≥20 hostile accounts
 * on one trip — an accepted MVP floor.
 */
export const MAX_BOOKINGS_PER_TRIP = 200;

/**
 * Seat accounting (docs/PRD.md — the law):
 * - seats are reserved only on `confirmed`; `pending` holds nothing
 * - on confirm: decrement, and 0 left → trip `full`
 * - on cancel of a confirmed booking: increment, and `full` → `open`
 */
async function reserveSeats(
  ctx: MutationCtx,
  trip: Doc<"trips">,
  seats: number,
): Promise<void> {
  const seatsAvailable = trip.seatsAvailable - seats;
  await ctx.db.patch("trips", trip._id, {
    seatsAvailable,
    ...(seatsAvailable === 0 ? { status: "full" as const } : {}),
  });
}

async function releaseSeats(
  ctx: MutationCtx,
  trip: Doc<"trips">,
  seats: number,
): Promise<void> {
  await ctx.db.patch("trips", trip._id, {
    seatsAvailable: trip.seatsAvailable + seats,
    ...(trip.status === "full" ? { status: "open" as const } : {}),
  });
}

/**
 * A request follows its accept()-created confirmed booking: cancelling the
 * booking re-opens the request (it can re-match and be cancelled again),
 * completing the trip completes it. Shared with trips.cancelTrip's cascade.
 */
export async function settleLinkedRequest(
  ctx: MutationCtx,
  booking: Doc<"bookings">,
  status: "open" | "completed",
): Promise<void> {
  if (booking.requestId === undefined) return;
  // ponytail: the re-open is silent — the PRD has no booking_cancelled
  // notification type. Add one if passengers miss the un-match.
  const request = await ctx.db.get("rideRequests", booking.requestId);
  if (request !== null && request.status === "matched") {
    await ctx.db.patch("rideRequests", request._id, { status });
  }
}

export const book = mutation({
  args: { tripId: v.id("trips"), seats: v.number() },
  returns: v.id("bookings"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("not_signed_in");

    const trip = await ctx.db.get("trips", args.tripId);
    if (trip === null) throw new ConvexError("trip_not_found");
    if (trip.status !== "open") throw new ConvexError("trip_not_open");
    if (trip.driverId === userId) throw new ConvexError("own_trip");
    if (
      !Number.isInteger(args.seats) ||
      args.seats < 1 ||
      args.seats > trip.seatsAvailable
    ) {
      throw new ConvexError("not_enough_seats");
    }

    const mine = await ctx.db
      .query("bookings")
      .withIndex("by_trip_and_passenger", (q) =>
        q.eq("tripId", trip._id).eq("passengerId", userId),
      )
      .take(MAX_BOOKING_ATTEMPTS_PER_TRIP);
    const alreadyBooked = mine.some(
      (booking) =>
        booking.status === "pending" || booking.status === "confirmed",
    );
    if (alreadyBooked) throw new ConvexError("already_booked");
    if (mine.length >= MAX_BOOKING_ATTEMPTS_PER_TRIP) {
      throw new ConvexError("too_many_attempts");
    }

    // Anti-scrape floor (docs/PRD.md risks): an instant booking reveals the
    // driver's phone, so cap bookings created per passenger per hour.
    const recent = await ctx.db
      .query("bookings")
      .withIndex("by_passenger", (q) => q.eq("passengerId", userId))
      .order("desc")
      .take(MAX_REVEALS_PER_HOUR);
    if (isRevealRateLimited(recent, Date.now())) {
      throw new ConvexError("too_many_attempts");
    }

    if (trip.bookingMode === "instant") {
      const bookingId = await ctx.db.insert("bookings", {
        tripId: trip._id,
        passengerId: userId,
        seats: args.seats,
        status: "confirmed",
      });
      await reserveSeats(ctx, trip, args.seats);
      await notify(ctx, {
        userId: trip.driverId,
        type: "booking_confirmed",
        tripId: trip._id,
        bookingId,
      });
      return bookingId;
    }

    // approve mode: pending, no seat hold — the driver confirms explicitly.
    const bookingId = await ctx.db.insert("bookings", {
      tripId: trip._id,
      passengerId: userId,
      seats: args.seats,
      status: "pending",
    });
    await notify(ctx, {
      userId: trip.driverId,
      type: "booking_pending",
      tripId: trip._id,
      bookingId,
    });
    return bookingId;
  },
});

export const approve = mutation({
  args: { bookingId: v.id("bookings") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("not_signed_in");

    const booking = await ctx.db.get("bookings", args.bookingId);
    if (booking === null) throw new ConvexError("booking_not_found");
    const trip = await ctx.db.get("trips", booking.tripId);
    if (trip === null) throw new ConvexError("trip_not_found");
    if (trip.driverId !== userId) throw new ConvexError("not_your_trip");
    if (booking.status !== "pending") {
      throw new ConvexError("booking_not_pending");
    }
    if (trip.status !== "open" && trip.status !== "full") {
      throw new ConvexError("trip_not_open");
    }
    // Pending never held seats — re-check capacity at the moment of approval.
    if (trip.seatsAvailable < booking.seats) {
      throw new ConvexError("not_enough_seats");
    }

    await ctx.db.patch("bookings", booking._id, { status: "confirmed" });
    await reserveSeats(ctx, trip, booking.seats);
    await notify(ctx, {
      userId: booking.passengerId,
      type: "booking_confirmed",
      tripId: trip._id,
      bookingId: booking._id,
    });
    return null;
  },
});

export const reject = mutation({
  args: { bookingId: v.id("bookings") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("not_signed_in");

    const booking = await ctx.db.get("bookings", args.bookingId);
    if (booking === null) throw new ConvexError("booking_not_found");
    const trip = await ctx.db.get("trips", booking.tripId);
    if (trip === null) throw new ConvexError("trip_not_found");
    if (trip.driverId !== userId) throw new ConvexError("not_your_trip");
    if (booking.status !== "pending") {
      throw new ConvexError("booking_not_pending");
    }

    await ctx.db.patch("bookings", booking._id, { status: "rejected" });
    await notify(ctx, {
      userId: booking.passengerId,
      type: "booking_rejected",
      tripId: trip._id,
      bookingId: booking._id,
    });
    return null;
  },
});

export const cancelBooking = mutation({
  args: { bookingId: v.id("bookings") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("not_signed_in");

    const booking = await ctx.db.get("bookings", args.bookingId);
    if (booking === null) throw new ConvexError("booking_not_found");
    const trip = await ctx.db.get("trips", booking.tripId);
    if (trip === null) throw new ConvexError("trip_not_found");
    if (booking.passengerId !== userId && trip.driverId !== userId) {
      throw new ConvexError("not_your_booking");
    }
    if (booking.status !== "pending" && booking.status !== "confirmed") {
      throw new ConvexError("cannot_cancel");
    }

    await ctx.db.patch("bookings", booking._id, { status: "cancelled" });
    if (booking.status === "confirmed") {
      await releaseSeats(ctx, trip, booking.seats);
      await settleLinkedRequest(ctx, booking, "open");
    }
    return null;
  },
});

export const completeTrip = mutation({
  args: { tripId: v.id("trips") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("not_signed_in");

    const trip = await ctx.db.get("trips", args.tripId);
    if (trip === null) throw new ConvexError("trip_not_found");
    if (trip.driverId !== userId) throw new ConvexError("not_your_trip");
    if (trip.status !== "open" && trip.status !== "full") {
      throw new ConvexError("cannot_complete");
    }

    await ctx.db.patch("trips", trip._id, { status: "completed" });
    // Every confirmed booking holds ≥1 of seatsTotal seats, so seatsTotal
    // bounds the scan exactly — no flood can hide a confirmed booking.
    const confirmed = await ctx.db
      .query("bookings")
      .withIndex("by_trip_and_status", (q) =>
        q.eq("tripId", trip._id).eq("status", "confirmed"),
      )
      .take(trip.seatsTotal);
    // ponytail: pending bookings stay pending per the PRD (only confirmed
    // cascade); the driver can still reject them for cleanliness.
    for (const booking of confirmed) {
      await ctx.db.patch("bookings", booking._id, { status: "completed" });
      await settleLinkedRequest(ctx, booking, "completed");
      await notify(ctx, {
        userId: booking.passengerId,
        type: "trip_completed",
        tripId: trip._id,
        bookingId: booking._id,
      });
    }
    return null;
  },
});

// Trip fields a passenger needs on their booking card.
const bookedTripValidator = v.object({
  _id: v.id("trips"),
  originGov: govValidator,
  destGov: govValidator,
  departAt: v.number(),
  pricePerSeat: v.number(),
  status: tripStatusValidator,
});

/**
 * The signed-in passenger's bookings, newest first. The driver's phone + plate
 * are included ONLY on confirmed/completed bookings (privacy rule).
 */
export const myBookings = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("bookings"),
      seats: v.number(),
      status: bookingStatusValidator,
      trip: bookedTripValidator,
      driver: v.union(counterpartUserValidator, publicUserValidator),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_passenger", (q) => q.eq("passengerId", userId))
      .order("desc")
      .take(50);
    const joined = await Promise.all(
      bookings.map(async (booking) => {
        const trip = await ctx.db.get("trips", booking.tripId);
        if (trip === null) return null; // trips are never deleted in MVP
        const driver = await ctx.db.get("users", trip.driverId);
        if (driver === null) return null;
        return {
          _id: booking._id,
          seats: booking.seats,
          status: booking.status,
          trip: {
            _id: trip._id,
            originGov: trip.originGov,
            destGov: trip.destGov,
            departAt: trip.departAt,
            pricePerSeat: trip.pricePerSeat,
            status: trip.status,
          },
          driver: revealUser(driver, isRevealingStatus(booking.status)),
        };
      }),
    );
    return joined.filter((booking) => booking !== null);
  },
});

/**
 * Bookings on one of the signed-in driver's trips. Passenger phone + plate
 * only on confirmed/completed bookings; anyone else gets an empty list.
 */
export const forMyTrip = query({
  args: { tripId: v.id("trips") },
  returns: v.array(
    v.object({
      _id: v.id("bookings"),
      seats: v.number(),
      status: bookingStatusValidator,
      passenger: v.union(counterpartUserValidator, publicUserValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const trip = await ctx.db.get("trips", args.tripId);
    if (trip === null || trip.driverId !== userId) return [];

    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_trip", (q) => q.eq("tripId", args.tripId))
      .order("desc") // newest rows win if the display bound is ever hit
      .take(MAX_BOOKINGS_PER_TRIP);
    const joined = await Promise.all(
      bookings.map(async (booking) => {
        const passenger = await ctx.db.get("users", booking.passengerId);
        if (passenger === null) return null;
        return {
          _id: booking._id,
          seats: booking.seats,
          status: booking.status,
          passenger: revealUser(passenger, isRevealingStatus(booking.status)),
        };
      }),
    );
    return joined.filter((booking) => booking !== null);
  },
});

/**
 * The viewer's booking on a trip, for the trip page's booking panel.
 * Rejected/cancelled bookings are skipped so the passenger can book again.
 */
export const myBookingForTrip = query({
  args: { tripId: v.id("trips") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("bookings"),
      seats: v.number(),
      status: bookingStatusValidator,
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_trip_and_passenger", (q) =>
        q.eq("tripId", args.tripId).eq("passengerId", userId),
      )
      .take(MAX_BOOKING_ATTEMPTS_PER_TRIP);
    const active = bookings.find(
      (booking) =>
        booking.status === "pending" ||
        booking.status === "confirmed" ||
        booking.status === "completed",
    );
    if (active === undefined) return null;
    return { _id: active._id, seats: active.seats, status: active.status };
  },
});
