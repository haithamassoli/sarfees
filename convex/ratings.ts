import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { publicUser } from "./lib/privacy";
import { notify } from "./notifications";

const MAX_COMMENT_CHARS = 300;
// Activity shows at most 50 bookings per role; cap the batch lookup there.
const MAX_BATCH_BOOKINGS = 100;

/**
 * Rate the counterpart of a completed booking (docs/PRD.md — Completion &
 * rating): 1–5 stars + optional comment, one rating per rater per booking.
 * Updates the ratee's aggregate and drops an in-app-only notification
 * (rating_received is not a push type).
 */
export const rate = mutation({
  args: {
    bookingId: v.id("bookings"),
    stars: v.number(),
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("not_signed_in");

    if (!Number.isInteger(args.stars) || args.stars < 1 || args.stars > 5) {
      throw new ConvexError("invalid_stars");
    }
    const trimmed = args.comment?.trim() ?? "";
    if (trimmed.length > MAX_COMMENT_CHARS) {
      throw new ConvexError("comment_too_long");
    }

    const booking = await ctx.db.get("bookings", args.bookingId);
    if (booking === null) throw new ConvexError("booking_not_found");
    if (booking.status !== "completed") throw new ConvexError("cannot_rate");
    const trip = await ctx.db.get("trips", booking.tripId);
    if (trip === null) throw new ConvexError("trip_not_found");

    // The rater must be a party of the booking; the ratee is the other side.
    let rateeId: Id<"users">;
    if (userId === booking.passengerId) {
      rateeId = trip.driverId;
    } else if (userId === trip.driverId) {
      rateeId = booking.passengerId;
    } else {
      throw new ConvexError("not_your_booking");
    }

    // by_booking holds at most 2 rows (one per direction), so collect is bounded.
    const existing = await ctx.db
      .query("ratings")
      .withIndex("by_booking", (q) => q.eq("bookingId", booking._id))
      .collect();
    if (existing.some((rating) => rating.raterId === userId)) {
      throw new ConvexError("already_rated");
    }

    await ctx.db.insert("ratings", {
      bookingId: booking._id,
      raterId: userId,
      rateeId,
      stars: args.stars,
      ...(trimmed.length === 0 ? {} : { comment: trimmed }),
    });

    const ratee = await ctx.db.get("users", rateeId);
    if (ratee === null) throw new ConvexError("not_found");
    const ratingCount = ratee.ratingCount + 1;
    const ratingAvg =
      Math.round(
        ((ratee.ratingAvg * ratee.ratingCount + args.stars) / ratingCount) *
          100,
      ) / 100;
    await ctx.db.patch("users", rateeId, { ratingAvg, ratingCount });

    await notify(ctx, {
      userId: rateeId,
      type: "rating_received",
      bookingId: booking._id,
    });
    return null;
  },
});

/**
 * The signed-in user's own ratings for a batch of bookings, keyed by booking:
 * drives the "قيّم" button vs read-only stars on the activity page.
 */
export const myRatingsForBookings = query({
  args: { bookingIds: v.array(v.id("bookings")) },
  returns: v.record(v.id("bookings"), v.number()),
  handler: async (ctx, args) => {
    const stars: Record<Id<"bookings">, number> = {};
    const userId = await getAuthUserId(ctx);
    if (userId === null) return stars;
    for (const bookingId of args.bookingIds.slice(0, MAX_BATCH_BOOKINGS)) {
      const rows = await ctx.db
        .query("ratings")
        .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
        .collect(); // max 2 rows per booking
      const mine = rows.find((rating) => rating.raterId === userId);
      if (mine !== undefined) stars[bookingId] = mine.stars;
    }
    return stars;
  },
});

/**
 * Last 10 ratings a user received, newest first, for the profile's comment
 * list. Public trust data: stars, comment, and the rater's first name only.
 */
export const forUser = query({
  args: { userId: v.id("users") },
  returns: v.array(
    v.object({
      _id: v.id("ratings"),
      _creationTime: v.number(),
      stars: v.number(),
      comment: v.optional(v.string()),
      raterName: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("ratings")
      .withIndex("by_ratee", (q) => q.eq("rateeId", args.userId))
      .order("desc")
      .take(10);
    return await Promise.all(
      rows.map(async (rating) => {
        const rater = await ctx.db.get("users", rating.raterId);
        // First-name-only subset of PublicUser — every user join goes
        // through the privacy helper (convex/lib/privacy.ts).
        const raterName =
          rater === null
            ? ""
            : (publicUser(rater).name.trim().split(/\s+/)[0] ?? "");
        return {
          _id: rating._id,
          _creationTime: rating._creationTime,
          stars: rating.stars,
          ...(rating.comment === undefined ? {} : { comment: rating.comment }),
          raterName,
        };
      }),
    );
  },
});
