import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

/**
 * Privacy rule (docs/PRD.md, server-enforced): phone and vehicle plate appear
 * ONLY to the user themselves or to a counterpart of a confirmed/completed
 * booking. Every query that joins users MUST shape them through one of these
 * helpers — never return a raw Doc<"users">.
 */

export type PublicUser = {
  name: string;
  ratingAvg: number;
  ratingCount: number;
  vehicle?: { make: string; color: string };
};

export type CounterpartUser = {
  name: string;
  ratingAvg: number;
  ratingCount: number;
  phone: string;
  vehicle?: { make: string; color: string; plate: string };
};

export const publicUserValidator = v.object({
  name: v.string(),
  ratingAvg: v.number(),
  ratingCount: v.number(),
  vehicle: v.optional(v.object({ make: v.string(), color: v.string() })),
});

export const counterpartUserValidator = v.object({
  name: v.string(),
  ratingAvg: v.number(),
  ratingCount: v.number(),
  phone: v.string(),
  vehicle: v.optional(
    v.object({ make: v.string(), color: v.string(), plate: v.string() }),
  ),
});

/** Public payload: no phone, vehicle without plate. */
export function publicUser(user: Doc<"users">): PublicUser {
  return {
    name: user.name,
    ratingAvg: user.ratingAvg,
    ratingCount: user.ratingCount,
    ...(user.vehicle === undefined
      ? {}
      : { vehicle: { make: user.vehicle.make, color: user.vehicle.color } }),
  };
}

/**
 * Client-side narrowing for the `counterpartUser | publicUser` union a query
 * returns: the phone when the payload is a counterpart's, else null.
 */
export function counterpartPhone(
  user: PublicUser | CounterpartUser,
): string | null {
  return "phone" in user && typeof user.phone === "string" ? user.phone : null;
}

/** Counterpart payload: adds phone and the full vehicle including plate. */
export function counterpartUser(user: Doc<"users">): CounterpartUser {
  return {
    name: user.name,
    ratingAvg: user.ratingAvg,
    ratingCount: user.ratingCount,
    phone: user.phone,
    ...(user.vehicle === undefined
      ? {}
      : {
          vehicle: {
            make: user.vehicle.make,
            color: user.vehicle.color,
            plate: user.vehicle.plate,
          },
        }),
  };
}

/**
 * The privacy rule's single predicate: a booking reveals phone + plate to its
 * counterpart only once it is confirmed or completed. Every reveal decision
 * routes through here so the rule can never drift between call sites.
 */
export function isRevealingStatus(
  status: Doc<"bookings">["status"],
): boolean {
  return status === "confirmed" || status === "completed";
}

/** Shape a joined user for a viewer: full contact when entitled, else public. */
export function revealUser(
  user: Doc<"users">,
  entitled: boolean,
): CounterpartUser | PublicUser {
  return entitled ? counterpartUser(user) : publicUser(user);
}
