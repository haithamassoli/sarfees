import { v } from "convex/values";
import { GOVERNORATES } from "./shared";

// Derived from GOVERNORATES so the schema can't drift from the domain enum.
export const govValidator = v.union(
  ...GOVERNORATES.map((gov) => v.literal(gov)),
);

export const bookingModeValidator = v.union(
  v.literal("instant"),
  v.literal("approve"),
);

export const tripStatusValidator = v.union(
  v.literal("open"),
  v.literal("full"),
  v.literal("completed"),
  v.literal("cancelled"),
);

export const requestStatusValidator = v.union(
  v.literal("open"),
  v.literal("matched"),
  v.literal("completed"),
  v.literal("cancelled"),
);

export const bookingStatusValidator = v.union(
  v.literal("pending"),
  v.literal("confirmed"),
  v.literal("rejected"),
  v.literal("cancelled"),
  v.literal("completed"),
);

export const notificationTypeValidator = v.union(
  v.literal("potential_passenger"),
  v.literal("potential_driver"),
  v.literal("booking_pending"),
  v.literal("booking_confirmed"),
  v.literal("booking_rejected"),
  v.literal("trip_completed"),
  v.literal("rating_received"),
);
