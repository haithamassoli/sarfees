"use node";

import { v } from "convex/values";
import ar from "../messages/ar.json";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { notificationHref } from "./lib/deepLink";
import { GOV_AR } from "./lib/shared";
import { notificationTypeValidator } from "./lib/validators";

type NotificationType = Doc<"notifications">["type"];

// Arabic titles come from ar.json so every user-visible string lives there.
const TITLES: Record<NotificationType, string> = {
  potential_passenger: ar.notif_potential_passenger,
  potential_driver: ar.notif_potential_driver,
  booking_pending: ar.notif_booking_pending,
  booking_confirmed: ar.notif_booking_confirmed,
  booking_rejected: ar.notif_booking_rejected,
  trip_completed: ar.notif_trip_completed,
  rating_received: ar.notif_rating_received,
};

/**
 * Web Push fan-out, scheduled by notify() for match/booking types. Sends
 * {title, body, url} to every browser subscription of the user; dead
 * subscriptions (404/410 from the push service) are deleted. No-ops
 * gracefully when VAPID keys or subscriptions are missing — the in-app
 * notifications feed is the fallback channel (docs/PRD.md).
 */
export const send = internalAction({
  args: {
    userId: v.id("users"),
    type: notificationTypeValidator,
    tripId: v.optional(v.id("trips")),
    requestId: v.optional(v.id("rideRequests")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (publicKey === undefined || privateKey === undefined) {
      console.warn("pushActions.send: VAPID env keys missing, skipping push");
      return null;
    }

    const subs = await ctx.runQuery(internal.push.listForUser, {
      userId: args.userId,
    });
    if (subs.length === 0) return null;

    const route = await ctx.runQuery(internal.push.routeFor, {
      tripId: args.tripId,
      requestId: args.requestId,
    });
    const payload = JSON.stringify({
      title: TITLES[args.type],
      // "عمان ← إربد" — same reading direction as <RouteSign>.
      body:
        route === null
          ? ar.app_tagline
          : `${GOV_AR[route.from]} ← ${GOV_AR[route.to]}`,
      url: notificationHref(args.type, args.tripId, args.requestId),
    });

    // Imported lazily so this module stays loadable outside node (convex-test
    // runs it in the edge runtime, where web-push's http/crypto imports fail);
    // the early returns above keep tests from ever reaching this line. CJS
    // interop: esbuild parks module.exports on .default of the namespace.
    const webpushModule = await import("web-push");
    const webpush = webpushModule.default ?? webpushModule;
    webpush.setVapidDetails(
      "mailto:noreply@goldentik.com",
      publicKey,
      privateKey,
    );

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
      } catch (error) {
        const statusCode =
          typeof error === "object" && error !== null && "statusCode" in error
            ? (error as { statusCode: unknown }).statusCode
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription expired or was revoked — drop it.
          await ctx.runMutation(internal.push.removeByEndpoint, {
            endpoint: sub.endpoint,
          });
        } else {
          // Best-effort delivery: one dead browser must not fail the fan-out.
          console.error("pushActions.send: sendNotification failed", error);
        }
      }
    }
    return null;
  },
});
