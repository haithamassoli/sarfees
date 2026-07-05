import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { matchTripsForRequest, matchedTripValidator } from "./matching";
import {
  counterpartUser,
  counterpartUserValidator,
  publicUser,
  publicUserValidator,
} from "./lib/privacy";
import {
  ammanDayWindow,
  MAX_OPEN_POSTS,
  MAX_REVEALS_PER_HOUR,
  REVEAL_WINDOW_MS,
} from "./lib/shared";
import { cleanText, isValidPrice } from "./lib/text";
import {
  govValidator,
  requestStatusValidator,
  tripStatusValidator,
} from "./lib/validators";
import { notify } from "./notifications";

// A passenger requests at most a regular serfees back row.
const MAX_REQUEST_SEATS = 4;

// Allowlisted request fields for query payloads (no passengerId — the
// passenger is always joined through a privacy helper instead).
const requestFieldsValidator = {
  _id: v.id("rideRequests"),
  originGov: govValidator,
  destGov: govValidator,
  desiredAt: v.number(),
  originArea: v.optional(v.string()),
  destArea: v.optional(v.string()),
  seats: v.number(),
  status: requestStatusValidator,
  note: v.optional(v.string()),
};

const listedRequestValidator = v.object({
  ...requestFieldsValidator,
  passenger: publicUserValidator,
});

function requestFields(request: Doc<"rideRequests">) {
  return {
    _id: request._id,
    originGov: request.originGov,
    destGov: request.destGov,
    desiredAt: request.desiredAt,
    originArea: request.originArea,
    destArea: request.destArea,
    seats: request.seats,
    status: request.status,
    note: request.note,
  };
}

export const createRequest = mutation({
  args: {
    originGov: govValidator,
    destGov: govValidator,
    desiredAt: v.number(),
    seats: v.number(),
    originArea: v.optional(v.string()),
    destArea: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  // Matches come back inline so the success screen renders them without a
  // second round-trip; their drivers were notified, the creator never is.
  returns: v.object({
    requestId: v.id("rideRequests"),
    matches: v.array(matchedTripValidator),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("not_signed_in");

    if (args.originGov === args.destGov) throw new ConvexError("same_gov");
    if (
      !Number.isInteger(args.seats) ||
      args.seats < 1 ||
      args.seats > MAX_REQUEST_SEATS
    ) {
      throw new ConvexError("invalid_request_seats");
    }
    if (args.desiredAt <= Date.now()) throw new ConvexError("depart_in_past");

    const originArea = cleanText(args.originArea);
    const destArea = cleanText(args.destArea);
    const note = cleanText(args.note);

    // Anti-spam floor: max MAX_OPEN_POSTS open requests per passenger.
    // ponytail: counts open requests among the passenger's 100 newest; same
    // ceiling/upgrade path as trips.createTrip.
    const recent = await ctx.db
      .query("rideRequests")
      .withIndex("by_passenger", (q) => q.eq("passengerId", userId))
      .order("desc")
      .take(100);
    const openCount = recent.filter((r) => r.status === "open").length;
    if (openCount >= MAX_OPEN_POSTS) throw new ConvexError("too_many_open");

    const requestId = await ctx.db.insert("rideRequests", {
      passengerId: userId,
      originGov: args.originGov,
      destGov: args.destGov,
      desiredAt: args.desiredAt,
      originArea,
      destArea,
      seats: args.seats,
      status: "open",
      note,
    });

    // Match-on-insert: this request is the second side for every open trip
    // already on the route — notify their drivers exactly once, here.
    const request = await ctx.db.get("rideRequests", requestId);
    const matches =
      request === null ? [] : await matchTripsForRequest(ctx, request);
    for (const match of matches) {
      await notify(ctx, {
        userId: match.driverId,
        type: "potential_passenger",
        tripId: match.summary._id,
        requestId,
      });
    }
    return { requestId, matches: matches.map((match) => match.summary) };
  },
});

/** Route page: upcoming open requests for a governorate pair, optional day filter. */
export const byRoute = query({
  args: {
    from: govValidator,
    to: govValidator,
    date: v.optional(v.string()), // YYYY-MM-DD, interpreted in Amman time
  },
  returns: v.array(listedRequestValidator),
  handler: async (ctx, args) => {
    const { start, end } = ammanDayWindow(args.date, Date.now());
    const requests = await ctx.db
      .query("rideRequests")
      .withIndex("by_route_status", (q) =>
        q.eq("originGov", args.from).eq("destGov", args.to).eq("status", "open"),
      )
      .order("desc")
      .take(50);
    const upcoming = requests
      .filter(
        (request) => request.desiredAt >= start && request.desiredAt < end,
      )
      .sort((a, b) => a.desiredAt - b.desiredAt);
    const joined = await Promise.all(
      upcoming.map(async (request) => {
        const passenger = await ctx.db.get("users", request.passengerId);
        if (passenger === null) return null; // users are never deleted in MVP
        return { ...requestFields(request), passenger: publicUser(passenger) };
      }),
    );
    return joined.filter((request) => request !== null);
  },
});

/**
 * Request detail. Viewer-aware: the passenger's phone is included ONLY for the
 * owner or for the driver of the accepted trip (i.e. after accept created the
 * confirmed booking linking them). Everyone else gets the stripped payload.
 */
export const get = query({
  args: { id: v.id("rideRequests") },
  returns: v.union(
    v.null(),
    v.object({
      ...requestFieldsValidator,
      isMine: v.boolean(),
      passenger: v.union(counterpartUserValidator, publicUserValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const request = await ctx.db.get("rideRequests", args.id);
    if (request === null) return null;
    const passenger = await ctx.db.get("users", request.passengerId);
    if (passenger === null) return null;

    const viewerId = await getAuthUserId(ctx);
    const isMine = viewerId !== null && viewerId === request.passengerId;
    const entitled =
      viewerId !== null &&
      (isMine || (await isAcceptingDriver(ctx, request, viewerId)));

    return {
      ...requestFields(request),
      isMine,
      passenger: entitled ? counterpartUser(passenger) : publicUser(passenger),
    };
  },
});

/**
 * True when the viewer drives the trip created by accepting this request —
 * i.e. a confirmed/completed booking links the request to a trip they own.
 */
async function isAcceptingDriver(
  ctx: QueryCtx,
  request: Doc<"rideRequests">,
  viewerId: Id<"users">,
): Promise<boolean> {
  if (request.status !== "matched" && request.status !== "completed") {
    return false;
  }
  const booking = await linkedBooking(ctx, request);
  if (booking === null) return false;
  const trip = await ctx.db.get("trips", booking.tripId);
  return trip !== null && trip.driverId === viewerId;
}

/** The confirmed/completed booking accept() created for this request. */
async function linkedBooking(
  ctx: QueryCtx,
  request: Doc<"rideRequests">,
): Promise<Doc<"bookings"> | null> {
  // ponytail: found by scanning the passenger's 200 newest bookings (no
  // by_request index — the PRD schema is the law). Add the index if a
  // passenger ever outgrows this bound.
  const bookings = await ctx.db
    .query("bookings")
    .withIndex("by_passenger", (q) => q.eq("passengerId", request.passengerId))
    .order("desc")
    .take(200);
  return (
    bookings.find(
      (booking) =>
        booking.requestId === request._id &&
        (booking.status === "confirmed" || booking.status === "completed"),
    ) ?? null
  );
}

const acceptedTripValidator = v.object({
  _id: v.id("trips"),
  departAt: v.number(),
  pricePerSeat: v.number(),
  status: tripStatusValidator,
});

/**
 * The signed-in passenger's own requests, newest first (activity page).
 * When matched, joins the accepted trip + the driver's contact — the viewer
 * holds the confirmed booking, so they are entitled to the phone.
 */
export const mine = query({
  args: {},
  returns: v.array(
    v.object({
      ...requestFieldsValidator,
      trip: v.optional(acceptedTripValidator),
      driver: v.optional(counterpartUserValidator),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const requests = await ctx.db
      .query("rideRequests")
      .withIndex("by_passenger", (q) => q.eq("passengerId", userId))
      .order("desc")
      .take(50);
    // One bounded scan of my bookings links requestId → accepted booking.
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_passenger", (q) => q.eq("passengerId", userId))
      .order("desc")
      .take(200);
    const byRequest = new Map<Id<"rideRequests">, Doc<"bookings">>();
    for (const booking of bookings) {
      if (
        booking.requestId !== undefined &&
        (booking.status === "confirmed" || booking.status === "completed") &&
        !byRequest.has(booking.requestId)
      ) {
        byRequest.set(booking.requestId, booking);
      }
    }
    return await Promise.all(
      requests.map(async (request) => {
        const base = requestFields(request);
        const booking = byRequest.get(request._id);
        if (booking !== undefined) {
          const trip = await ctx.db.get("trips", booking.tripId);
          const driver =
            trip === null ? null : await ctx.db.get("users", trip.driverId);
          if (trip !== null && driver !== null) {
            return {
              ...base,
              trip: {
                _id: trip._id,
                departAt: trip.departAt,
                pricePerSeat: trip.pricePerSeat,
                status: trip.status,
              },
              driver: counterpartUser(driver),
            };
          }
        }
        // undefined-valued keys are dropped in serialization; keeping them
        // here keeps the handler's return type a single shape.
        return { ...base, trip: undefined, driver: undefined };
      }),
    );
  },
});

export const cancelRequest = mutation({
  args: { id: v.id("rideRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("not_signed_in");
    const request = await ctx.db.get("rideRequests", args.id);
    if (request === null) throw new ConvexError("request_not_found");
    if (request.passengerId !== userId) {
      throw new ConvexError("not_your_request");
    }
    if (request.status !== "open") throw new ConvexError("cannot_cancel");
    await ctx.db.patch("rideRequests", request._id, { status: "cancelled" });
    return null;
  },
});

/**
 * Driver accepts a ride request (docs/PRD.md flow): creates a trip sized
 * exactly to the request (already full) + a confirmed booking linked to the
 * request, flips the request to matched, and notifies the passenger. Phones
 * are revealed to both sides through the confirmed booking.
 */
export const accept = mutation({
  args: {
    requestId: v.id("rideRequests"),
    pricePerSeat: v.number(),
    departAt: v.number(),
  },
  returns: v.id("trips"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("not_signed_in");

    const request = await ctx.db.get("rideRequests", args.requestId);
    if (request === null) throw new ConvexError("request_not_found");
    if (request.status !== "open") throw new ConvexError("request_not_open");
    if (request.passengerId === userId) throw new ConvexError("own_request");
    if (!isValidPrice(args.pricePerSeat)) {
      throw new ConvexError("invalid_price");
    }
    if (args.departAt <= Date.now()) throw new ConvexError("depart_in_past");

    // Anti-scrape floor (docs/PRD.md risks): accepting reveals the
    // passenger's phone, so cap trips created per driver per hour (accepted
    // trips are "full", so the MAX_OPEN_POSTS floor never fires here).
    const recentTrips = await ctx.db
      .query("trips")
      .withIndex("by_driver", (q) => q.eq("driverId", userId))
      .order("desc")
      .take(MAX_REVEALS_PER_HOUR);
    if (
      recentTrips.length >= MAX_REVEALS_PER_HOUR &&
      recentTrips[recentTrips.length - 1]._creationTime >
        Date.now() - REVEAL_WINDOW_MS
    ) {
      throw new ConvexError("too_many_attempts");
    }

    const tripId = await ctx.db.insert("trips", {
      driverId: userId,
      originGov: request.originGov,
      destGov: request.destGov,
      departAt: args.departAt,
      originArea: request.originArea,
      destArea: request.destArea,
      seatsTotal: request.seats,
      seatsAvailable: 0,
      pricePerSeat: args.pricePerSeat,
      bookingMode: "instant",
      status: "full",
    });
    const bookingId = await ctx.db.insert("bookings", {
      tripId,
      passengerId: request.passengerId,
      requestId: request._id,
      seats: request.seats,
      status: "confirmed",
    });
    await ctx.db.patch("rideRequests", request._id, { status: "matched" });
    await notify(ctx, {
      userId: request.passengerId,
      type: "booking_confirmed",
      tripId,
      requestId: request._id,
      bookingId,
    });
    return tripId;
  },
});
