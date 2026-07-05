import { ConvexError } from "convex/values";
import ar from "@/messages/ar.json";
import { t, type MessageKey } from "@/lib/i18n";

/**
 * Convex functions throw `ConvexError("<key>")` where `<key>` is an ar.json
 * error key without the "error_" prefix (e.g. "invalid_phone"). Map it to the
 * Arabic message; anything unrecognized falls back to `fallback`.
 */
export function errorMessage(
  error: unknown,
  fallback: MessageKey = "error_generic",
): string {
  if (error instanceof ConvexError && typeof error.data === "string") {
    const key = error.data.startsWith("error_")
      ? error.data
      : `error_${error.data}`;
    if (key in ar) return t(key as MessageKey);
  }
  return t(fallback);
}
