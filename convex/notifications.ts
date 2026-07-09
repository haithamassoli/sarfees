import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { notificationHref } from "./lib/deepLink";
import { govValidator, notificationTypeValidator } from "./lib/validators";

/**
 * Types that also fan out as web push (docs/PRD.md notifications table);
 * trip_completed and rating_received stay in-app only.
 */
const PUSH_TYPES: ReadonlySet<Doc<"notifications">["type"]> = new Set([
  "potential_passenger",
  "potential_driver",
  "booking_pending",
  "booking_confirmed",
  "booking_rejected",
]);

/**
 * Insert an in-app notification row and, for match/booking types, schedule the
 * web-push send. Call from mutations only.
 */
export async function notify(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    type: Doc<"notifications">["type"];
    tripId?: Id<"trips">;
    requestId?: Id<"rideRequests">;
    bookingId?: Id<"bookings">;
  },
): Promise<void> {
  await ctx.db.insert("notifications", args);
  if (PUSH_TYPES.has(args.type)) {
    await ctx.scheduler.runAfter(0, internal.pushActions.send, {
      userId: args.userId,
      type: args.type,
      tripId: args.tripId,
      requestId: args.requestId,
    });
  }
}

const listedNotificationValidator = v.object({
  _id: v.id("notifications"),
  _creationTime: v.number(),
  type: notificationTypeValidator,
  readAt: v.optional(v.number()),
  // Display data from the linked trip/request (route + its day/time).
  route: v.optional(v.object({ from: govValidator, to: govValidator })),
  when: v.optional(v.number()),
  // Deep-link target (docs/PRD.md: click deep-links to the trip/request).
  href: v.string(),
});

/**
 * Per-type enrichment: which linked doc carries the route/time the reader
 * cares about. The tap target comes from the shared deep-link helper, so
 * feed rows and web-push taps always land on the same page.
 */
async function enrich(
  ctx: QueryCtx,
  row: Doc<"notifications">,
): Promise<Infer<typeof listedNotificationValidator>> {
  const base = {
    _id: row._id,
    _creationTime: row._creationTime,
    type: row.type,
    readAt: row.readAt,
    href: notificationHref(row.type, row.tripId, row.requestId),
  };
  switch (row.type) {
    case "potential_passenger": {
      // To a driver: the interesting entity is the passenger's request.
      const request =
        row.requestId === undefined
          ? null
          : await ctx.db.get("rideRequests", row.requestId);
      return {
        ...base,
        ...(request === null
          ? {}
          : {
              route: { from: request.originGov, to: request.destGov },
              when: request.desiredAt,
            }),
      };
    }
    case "potential_driver":
    case "booking_confirmed":
    case "booking_rejected":
    case "booking_pending":
    case "trip_completed": {
      const trip =
        row.tripId === undefined ? null : await ctx.db.get("trips", row.tripId);
      return {
        ...base,
        ...(trip === null
          ? {}
          : {
              route: { from: trip.originGov, to: trip.destGov },
              when: trip.departAt,
            }),
      };
    }
    case "rating_received":
      return base;
  }
}

/** The signed-in user's feed, newest first, enriched for display. */
export const list = query({
  args: {},
  returns: v.array(listedNotificationValidator),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    return await Promise.all(rows.map((row) => enrich(ctx, row)));
  },
});

/** Unread badge count (capped at 100 — plenty for a badge). */
export const unreadCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return 0;
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_readAt", (q) =>
        q.eq("userId", userId).eq("readAt", undefined),
      )
      .take(100);
    return unread.length;
  },
});

export const markRead = mutation({
  args: { id: v.id("notifications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("not_signed_in");
    const row = await ctx.db.get("notifications", args.id);
    if (row === null || row.userId !== userId) {
      throw new ConvexError("not_found");
    }
    if (row.readAt === undefined) {
      await ctx.db.patch("notifications", args.id, { readAt: Date.now() });
    }
    return null;
  },
});

export const markAllRead = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("not_signed_in");
    const now = Date.now();
    // Bounded single pass: the badge caps at 100, so 200 covers any backlog
    // a user can meaningfully see.
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_readAt", (q) =>
        q.eq("userId", userId).eq("readAt", undefined),
      )
      .take(200);
    for (const row of unread) {
      await ctx.db.patch("notifications", row._id, { readAt: now });
    }
    return null;
  },
});
