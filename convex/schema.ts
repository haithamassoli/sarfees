import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import {
  bookingModeValidator,
  bookingStatusValidator,
  govValidator,
  notificationTypeValidator,
  requestStatusValidator,
  tripStatusValidator,
} from "./lib/validators";

// Index names follow docs/PRD.md; queries always go through these indexes.
export default defineSchema({
  ...authTables,

  // Extends Convex Auth's users table. `email` holds the E.164 phone — it is
  // the Password provider's account key. `phone` is the canonical field.
  users: defineTable({
    name: v.string(),
    phone: v.string(), // E.164, +9627XXXXXXXX
    vehicle: v.optional(
      v.object({ make: v.string(), color: v.string(), plate: v.string() }),
    ),
    ratingAvg: v.number(), // 0 if none
    ratingCount: v.number(),
    // Fields Convex Auth may read/write:
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phoneVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  pushSubscriptions: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_endpoint", ["endpoint"]), // dedupe on re-subscribe, delete on 404/410

  notifications: defineTable({
    userId: v.id("users"),
    type: notificationTypeValidator,
    tripId: v.optional(v.id("trips")),
    requestId: v.optional(v.id("rideRequests")),
    bookingId: v.optional(v.id("bookings")),
    readAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_readAt", ["userId", "readAt"]), // unread = readAt undefined

  trips: defineTable({
    driverId: v.id("users"),
    originGov: govValidator,
    destGov: govValidator,
    departAt: v.number(),
    originArea: v.optional(v.string()),
    destArea: v.optional(v.string()),
    stops: v.optional(v.array(v.string())),
    seatsTotal: v.number(),
    seatsAvailable: v.number(),
    pricePerSeat: v.number(), // JOD
    bookingMode: bookingModeValidator,
    status: tripStatusValidator,
    note: v.optional(v.string()),
  })
    .index("by_route_status", ["originGov", "destGov", "status"])
    .index("by_status_and_departAt", ["status", "departAt"]) // home: upcoming open trips
    .index("by_driver", ["driverId"]),

  rideRequests: defineTable({
    passengerId: v.id("users"),
    originGov: govValidator,
    destGov: govValidator,
    desiredAt: v.number(),
    originArea: v.optional(v.string()),
    destArea: v.optional(v.string()),
    seats: v.number(),
    status: requestStatusValidator,
    note: v.optional(v.string()),
  })
    .index("by_route_status", ["originGov", "destGov", "status"])
    .index("by_passenger", ["passengerId"]),

  bookings: defineTable({
    tripId: v.id("trips"),
    passengerId: v.id("users"),
    requestId: v.optional(v.id("rideRequests")),
    seats: v.number(),
    status: bookingStatusValidator,
  })
    .index("by_trip", ["tripId"])
    .index("by_trip_and_passenger", ["tripId", "passengerId"]) // dedupe + attempt cap
    .index("by_trip_and_status", ["tripId", "status"]) // complete/cancel cascades
    .index("by_passenger", ["passengerId"]),

  ratings: defineTable({
    bookingId: v.id("bookings"),
    raterId: v.id("users"),
    rateeId: v.id("users"),
    stars: v.number(), // 1..5
    comment: v.optional(v.string()),
  })
    .index("by_ratee", ["rateeId"])
    .index("by_booking", ["bookingId"]),
});
