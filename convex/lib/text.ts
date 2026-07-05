import { ConvexError } from "convex/values";

export const MAX_TEXT = 200;

/** Trim optional free text; empty → undefined; > MAX_TEXT chars → error. */
export function cleanText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > MAX_TEXT) throw new ConvexError("text_too_long");
  return trimmed;
}

/** JOD in quarter-dinar steps, 0..999 (docs/PRD.md non-functional). */
export function isValidPrice(price: number): boolean {
  return (
    Number.isFinite(price) &&
    price >= 0 &&
    price <= 999 &&
    Number.isInteger(price * 4)
  );
}
