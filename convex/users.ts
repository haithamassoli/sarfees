import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isValidName } from "./lib/text";

const vehicleValidator = v.object({
  make: v.string(),
  color: v.string(),
  plate: v.string(),
});

/**
 * The signed-in user's own profile. This is the only user query that may
 * include `phone` unconditionally — it never returns anyone else's doc.
 */
export const viewer = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      name: v.string(),
      phone: v.string(),
      vehicle: v.union(vehicleValidator, v.null()),
      ratingAvg: v.number(),
      ratingCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get("users", userId);
    if (user === null) return null;
    return {
      _id: user._id,
      name: user.name,
      phone: user.phone,
      vehicle: user.vehicle ?? null,
      ratingAvg: user.ratingAvg,
      ratingCount: user.ratingCount,
    };
  },
});

export const updateProfile = mutation({
  args: {
    name: v.string(),
    // Omit `vehicle` to clear it; when present all three fields are required.
    vehicle: v.optional(vehicleValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("not_signed_in");

    const name = args.name.trim();
    if (!isValidName(name)) {
      throw new ConvexError("invalid_name");
    }

    let vehicle: { make: string; color: string; plate: string } | undefined;
    if (args.vehicle !== undefined) {
      vehicle = {
        make: args.vehicle.make.trim(),
        color: args.vehicle.color.trim(),
        plate: args.vehicle.plate.trim(),
      };
      const fields = [vehicle.make, vehicle.color, vehicle.plate];
      if (fields.some((f) => f.length < 1 || f.length > 30)) {
        throw new ConvexError("invalid_vehicle");
      }
    }

    // `vehicle: undefined` removes the field (the clear-all path).
    await ctx.db.patch("users", userId, { name, vehicle });
    return null;
  },
});
