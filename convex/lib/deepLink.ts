import type { Doc, Id } from "../_generated/dataModel";

/**
 * In-app destination for a notification — the single source for both the feed
 * row link (notifications.enrich) and the web-push tap target
 * (pushActions.send), so tapping either lands on the same page.
 */
export function notificationHref(
  type: Doc<"notifications">["type"],
  tripId?: Id<"trips">,
  requestId?: Id<"rideRequests">,
): string {
  switch (type) {
    case "potential_passenger":
      // To a driver: the interesting entity is the passenger's request.
      return requestId === undefined ? "/activity" : `/requests/${requestId}`;
    case "potential_driver":
    case "booking_confirmed":
    case "booking_rejected":
      return tripId === undefined ? "/activity" : `/trips/${tripId}`;
    case "booking_pending":
    case "trip_completed":
      // Both are handled from the activity page (approve queue / rating).
      return "/activity";
    case "rating_received":
      return "/profile";
  }
}
