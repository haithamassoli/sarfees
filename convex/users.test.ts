/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  return convexTest(schema, modules);
}

async function createUser(
  t: ReturnType<typeof convexTest>,
  overrides: Record<string, unknown> = {},
): Promise<Id<"users">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("users", {
      name: "أبو خالد",
      phone: "+962791111111",
      email: "+962791111111",
      ratingAvg: 0,
      ratingCount: 0,
      ...overrides,
    }),
  );
}

async function expectConvexError(promise: Promise<unknown>, data: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ConvexError);
  expect((error as ConvexError<string>).data).toBe(data);
}

test("viewer returns null when signed out", async () => {
  const t = setup();
  expect(await t.query(api.users.viewer, {})).toBeNull();
});

test("viewer returns own profile including phone, without auth fields", async () => {
  const t = setup();
  const userId = await createUser(t);
  const asUser = t.withIdentity({ subject: userId });

  const viewer = await asUser.query(api.users.viewer, {});
  expect(viewer).toEqual({
    _id: userId,
    name: "أبو خالد",
    phone: "+962791111111",
    vehicle: null,
    ratingAvg: 0,
    ratingCount: 0,
  });
  expect(viewer).not.toHaveProperty("email");
});

test("updateProfile requires auth", async () => {
  const t = setup();
  await expectConvexError(
    t.mutation(api.users.updateProfile, { name: "سارة" }),
    "not_signed_in",
  );
});

test("updateProfile updates name and vehicle (trimmed)", async () => {
  const t = setup();
  const userId = await createUser(t);
  const asUser = t.withIdentity({ subject: userId });

  await asUser.mutation(api.users.updateProfile, {
    name: "  سارة  ",
    vehicle: { make: " كيا سيراتو ", color: "أبيض", plate: "12-34567" },
  });

  const viewer = await asUser.query(api.users.viewer, {});
  expect(viewer).toMatchObject({
    name: "سارة",
    vehicle: { make: "كيا سيراتو", color: "أبيض", plate: "12-34567" },
  });
});

test("updateProfile without vehicle clears a stored vehicle", async () => {
  const t = setup();
  const userId = await createUser(t, {
    vehicle: { make: "كيا", color: "أبيض", plate: "12-34567" },
  });
  const asUser = t.withIdentity({ subject: userId });

  await asUser.mutation(api.users.updateProfile, { name: "أبو خالد" });

  const viewer = await asUser.query(api.users.viewer, {});
  expect(viewer?.vehicle).toBeNull();
  const doc = await t.run(async (ctx) => ctx.db.get("users", userId));
  expect(doc?.vehicle).toBeUndefined();
});

test("updateProfile rejects invalid names", async () => {
  const t = setup();
  const userId = await createUser(t);
  const asUser = t.withIdentity({ subject: userId });

  await expectConvexError(
    asUser.mutation(api.users.updateProfile, { name: " س " }),
    "invalid_name",
  );
  await expectConvexError(
    asUser.mutation(api.users.updateProfile, { name: "س".repeat(61) }),
    "invalid_name",
  );
});

test("updateProfile rejects a partially empty or oversized vehicle", async () => {
  const t = setup();
  const userId = await createUser(t);
  const asUser = t.withIdentity({ subject: userId });

  await expectConvexError(
    asUser.mutation(api.users.updateProfile, {
      name: "سارة",
      vehicle: { make: "كيا", color: " ", plate: "12-34567" },
    }),
    "invalid_vehicle",
  );
  await expectConvexError(
    asUser.mutation(api.users.updateProfile, {
      name: "سارة",
      vehicle: { make: "م".repeat(31), color: "أبيض", plate: "12-34567" },
    }),
    "invalid_vehicle",
  );
});
