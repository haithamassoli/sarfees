import { v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { publicUser, publicUserValidator } from "./lib/privacy";
import { MATCH_WINDOW_MS } from "./lib/shared";
import { govValidator } from "./lib/validators";

/**
 * Cross-matching (docs/PRD.md — the law): a trip and a request match when the
 * governorate pair is equal, |departAt - desiredAt| <= MATCH_WINDOW_MS, and
 * the trip has enough seats. Matches are computed, never stored: each (trip,
 * request) pair is evaluated exactly once — at creation of whichever came
 * second — and the creator is never notified (their matches render inline on
 * the post-success screen instead).
 */

// Newest open posts scanned per route pair when cross-matching.
// ponytail: fine at MVP volume; add a time column to by_route_status if a
// single route ever holds >100 open posts.
const MATCH_SCAN = 100;

export const matchedTripValidator = v.object({
  _id: v.id("trips"),
  originGov: govValidator,
  destGov: govValidator,
  departAt: v.number(),
  seatsAvailable: v.number(),
  pricePerSeat: v.number(),
  driver: publicUserValidator,
});

export const matchedRequestValidator = v.object({
  _id: v.id("rideRequests"),
  originGov: govValidator,
  destGov: govValidator,
  desiredAt: v.number(),
  seats: v.number(),
  passenger: publicUserValidator,
});

/**
 * Open trips matching a just-created request. Returns public summaries plus
 * the driverId so the caller can notify (the summary itself stays stripped).
 */
export async function matchTripsForRequest(
  ctx: QueryCtx,
  request: Doc<"rideRequests">,
): Promise<
  Array<{ driverId: Id<"users">; summary: Infer<typeof matchedTripValidator> }>
> {
  const trips = await ctx.db
    .query("trips")
    .withIndex("by_route_status", (q) =>
      q
        .eq("originGov", request.originGov)
        .eq("destGov", request.destGov)
        .eq("status", "open"),
    )
    .order("desc")
    .take(MATCH_SCAN);
  const hits = trips
    .filter(
      (trip) =>
        Math.abs(trip.departAt - request.desiredAt) <= MATCH_WINDOW_MS &&
        trip.seatsAvailable >= request.seats &&
        // Never match (or notify) the creator's own posts.
        trip.driverId !== request.passengerId,
    )
    .sort((a, b) => a.departAt - b.departAt);
  const joined = await Promise.all(
    hits.map(async (trip) => {
      const driver = await ctx.db.get("users", trip.driverId);
      if (driver === null) return null; // users are never deleted in MVP
      return {
        driverId: trip.driverId,
        summary: {
          _id: trip._id,
          originGov: trip.originGov,
          destGov: trip.destGov,
          departAt: trip.departAt,
          seatsAvailable: trip.seatsAvailable,
          pricePerSeat: trip.pricePerSeat,
          driver: publicUser(driver),
        },
      };
    }),
  );
  return joined.filter((match) => match !== null);
}

/**
 * Open requests matching a just-created trip. Returns public summaries plus
 * the passengerId so the caller can notify.
 */
export async function matchRequestsForTrip(
  ctx: QueryCtx,
  trip: Doc<"trips">,
): Promise<
  Array<{
    passengerId: Id<"users">;
    summary: Infer<typeof matchedRequestValidator>;
  }>
> {
  const requests = await ctx.db
    .query("rideRequests")
    .withIndex("by_route_status", (q) =>
      q
        .eq("originGov", trip.originGov)
        .eq("destGov", trip.destGov)
        .eq("status", "open"),
    )
    .order("desc")
    .take(MATCH_SCAN);
  const hits = requests
    .filter(
      (request) =>
        Math.abs(trip.departAt - request.desiredAt) <= MATCH_WINDOW_MS &&
        trip.seatsAvailable >= request.seats &&
        request.passengerId !== trip.driverId,
    )
    .sort((a, b) => a.desiredAt - b.desiredAt);
  const joined = await Promise.all(
    hits.map(async (request) => {
      const passenger = await ctx.db.get("users", request.passengerId);
      if (passenger === null) return null;
      return {
        passengerId: request.passengerId,
        summary: {
          _id: request._id,
          originGov: request.originGov,
          destGov: request.destGov,
          desiredAt: request.desiredAt,
          seats: request.seats,
          passenger: publicUser(passenger),
        },
      };
    }),
  );
  return joined.filter((match) => match !== null);
}
