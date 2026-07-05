import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { govValidator } from "./lib/validators";

/**
 * Web Push subscriptions (docs/PRD.md): a user has N browsers, deduped by
 * endpoint. The send fan-out lives in pushActions.ts ("use node").
 */

// Browsers fanned out to per user. A person has a handful of browsers, not
// dozens; anything beyond this is stale rows waiting for a 404/410 cleanup.
const MAX_SUBSCRIPTIONS_PER_USER = 20;

// Real push-service subscription fields are small; anything larger is junk.
const MAX_ENDPOINT_CHARS = 1024;
const MAX_KEY_CHARS = 256;
const MAX_AUTH_CHARS = 128;

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export const subscribe = mutation({
  args: { endpoint: v.string(), p256dh: v.string(), auth: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("not_signed_in");
    // The Node send action POSTs signed web-push requests to this URL —
    // accept only plausible https push-service endpoints (no SSRF relays,
    // no megabyte blobs).
    if (
      args.endpoint.length > MAX_ENDPOINT_CHARS ||
      !isHttpsUrl(args.endpoint) ||
      args.p256dh.length === 0 ||
      args.p256dh.length > MAX_KEY_CHARS ||
      args.auth.length === 0 ||
      args.auth.length > MAX_AUTH_CHARS
    ) {
      throw new ConvexError("invalid_subscription");
    }
    // Dedupe by endpoint: a re-subscribe (or another account on the same
    // browser) takes the row over instead of duplicating it.
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();
    if (existing !== null) {
      await ctx.db.patch("pushSubscriptions", existing._id, {
        userId,
        p256dh: args.p256dh,
        auth: args.auth,
      });
    } else {
      // Enforce the per-user cap at write time: evict the oldest row so one
      // account can't grow the table (and the newest browsers keep push).
      const mine = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(MAX_SUBSCRIPTIONS_PER_USER);
      if (mine.length >= MAX_SUBSCRIPTIONS_PER_USER) {
        await ctx.db.delete("pushSubscriptions", mine[0]._id); // oldest first
      }
      await ctx.db.insert("pushSubscriptions", {
        userId,
        endpoint: args.endpoint,
        p256dh: args.p256dh,
        auth: args.auth,
      });
    }
    return null;
  },
});

export const unsubscribe = mutation({
  args: { endpoint: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("not_signed_in");
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();
    // Only the owner may drop a row; a stale row owned by another account
    // gets replaced on that browser's next subscribe instead.
    if (existing !== null && existing.userId === userId) {
      await ctx.db.delete("pushSubscriptions", existing._id);
    }
    return null;
  },
});

/** All of a user's browser subscriptions, for the send action's fan-out. */
export const listForUser = internalQuery({
  args: { userId: v.id("users") },
  returns: v.array(
    v.object({ endpoint: v.string(), p256dh: v.string(), auth: v.string() }),
  ),
  handler: async (ctx, args) => {
    const subs = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc") // newest browsers win at the cap
      .take(MAX_SUBSCRIPTIONS_PER_USER);
    return subs.map((sub) => ({
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
    }));
  },
});

/** Drop a dead subscription (push service answered 404/410). */
export const removeByEndpoint = internalMutation({
  args: { endpoint: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();
    if (existing !== null) {
      await ctx.db.delete("pushSubscriptions", existing._id);
    }
    return null;
  },
});

/**
 * Route pair for the push body. Matches notifications.enrich(): for a
 * potential_passenger the request carries the route the driver cares about;
 * every other type reads the trip. Both share the pair on a match anyway.
 */
export const routeFor = internalQuery({
  args: {
    tripId: v.optional(v.id("trips")),
    requestId: v.optional(v.id("rideRequests")),
  },
  returns: v.union(v.null(), v.object({ from: govValidator, to: govValidator })),
  handler: async (ctx, args) => {
    if (args.tripId !== undefined) {
      const trip = await ctx.db.get("trips", args.tripId);
      if (trip !== null) return { from: trip.originGov, to: trip.destGov };
    }
    if (args.requestId !== undefined) {
      const request = await ctx.db.get("rideRequests", args.requestId);
      if (request !== null) {
        return { from: request.originGov, to: request.destGov };
      }
    }
    return null;
  },
});
