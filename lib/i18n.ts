import ar from "@/messages/ar.json";

export type MessageKey = keyof typeof ar;

// ponytail: one language, one JSON file, one function. Add next-intl with an
// /en prefix when English demand is real, not before (docs/PRD.md).
export function t(key: MessageKey): string {
  return ar[key];
}

/** "1 مقعد" / "3 مقاعد" — the seat pluralization used across the app. */
export function seatsLabel(seats: number): string {
  return `${seats} ${seats === 1 ? t("seat_one") : t("seats_count")}`;
}
