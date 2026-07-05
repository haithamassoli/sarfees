import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";

const HOUR_MS = 60 * 60 * 1000;

type SeedTrip = Omit<
  Doc<"trips">,
  "_id" | "_creationTime" | "seatsAvailable" | "status"
>;

/**
 * Dev-only seed: 3 fake drivers + 6 future open trips on the launch corridors
 * (amman↔irbid, amman→zarqa, amman→aqaba). Run once:
 *
 *   npx convex run dev:seed
 *
 * Idempotent-ish: skips if the first seed user already exists. Seed users have
 * no auth accounts (browse-only data); plates/phones exist so the privacy rule
 * can be verified against real payloads.
 */
export const seed = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("phone", (q) => q.eq("phone", "+962790000001"))
      .unique();
    if (existing !== null) return "already seeded";

    const abuSaleh = await ctx.db.insert("users", {
      name: "أبو صالح",
      phone: "+962790000001",
      ratingAvg: 4.8,
      ratingCount: 34,
      vehicle: { make: "كيا سيراتو", color: "أبيض", plate: "22-11223" },
    });
    const mohammad = await ctx.db.insert("users", {
      name: "محمد الزعبي",
      phone: "+962790000002",
      ratingAvg: 4.4,
      ratingCount: 12,
      vehicle: { make: "هيونداي سوناتا", color: "فضّي", plate: "10-98765" },
    });
    const laith = await ctx.db.insert("users", {
      name: "ليث العمري",
      phone: "+962790000003",
      ratingAvg: 0,
      ratingCount: 0,
    });

    const now = Date.now();
    const trips: SeedTrip[] = [
      {
        driverId: abuSaleh,
        originGov: "amman",
        destGov: "irbid",
        departAt: now + 3 * HOUR_MS,
        originArea: "دوار المدينة الرياضية",
        destArea: "مجمع عمان الجديد",
        stops: ["جرش"],
        seatsTotal: 4,
        pricePerSeat: 3.5,
        bookingMode: "instant",
      },
      {
        driverId: mohammad,
        originGov: "amman",
        destGov: "irbid",
        departAt: now + 26 * HOUR_MS,
        originArea: "صويلح — دوار المنارة",
        seatsTotal: 3,
        pricePerSeat: 4,
        bookingMode: "approve",
        note: "التحرك بعد صلاة الفجر مباشرة",
      },
      {
        driverId: mohammad,
        originGov: "irbid",
        destGov: "amman",
        departAt: now + 5 * HOUR_MS,
        originArea: "دوار القبة",
        destArea: "صويلح",
        seatsTotal: 4,
        pricePerSeat: 3.5,
        bookingMode: "instant",
      },
      {
        driverId: laith,
        originGov: "irbid",
        destGov: "amman",
        departAt: now + 30 * HOUR_MS,
        seatsTotal: 2,
        pricePerSeat: 4,
        bookingMode: "approve",
      },
      {
        driverId: abuSaleh,
        originGov: "amman",
        destGov: "zarqa",
        departAt: now + 2 * HOUR_MS,
        originArea: "المحطة",
        seatsTotal: 4,
        pricePerSeat: 1,
        bookingMode: "instant",
      },
      {
        driverId: laith,
        originGov: "amman",
        destGov: "aqaba",
        departAt: now + 8 * HOUR_MS,
        originArea: "إشارة الدوريات الخارجية",
        stops: ["القطرانة", "معان"],
        seatsTotal: 3,
        pricePerSeat: 7.5,
        bookingMode: "approve",
        note: "توقف استراحة في القطرانة",
      },
    ];

    for (const trip of trips) {
      await ctx.db.insert("trips", {
        ...trip,
        seatsAvailable: trip.seatsTotal,
        status: "open",
      });
    }
    return "seeded";
  },
});
