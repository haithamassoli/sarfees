// Domain constants shared by Convex functions and the Next.js app.
// Client-safe: no convex/server imports here.

export const GOVERNORATES = [
  "amman",
  "irbid",
  "zarqa",
  "balqa",
  "mafraq",
  "jerash",
  "ajloun",
  "madaba",
  "karak",
  "tafilah",
  "maan",
  "aqaba",
] as const;

export type Gov = (typeof GOVERNORATES)[number];

export const GOV_AR: Record<Gov, string> = {
  amman: "عمان",
  irbid: "إربد",
  zarqa: "الزرقاء",
  balqa: "البلقاء",
  mafraq: "المفرق",
  jerash: "جرش",
  ajloun: "عجلون",
  madaba: "مادبا",
  karak: "الكرك",
  tafilah: "الطفيلة",
  maan: "معان",
  aqaba: "العقبة",
};

export function isGov(value: string): value is Gov {
  return (GOVERNORATES as readonly string[]).includes(value);
}

/** Match window for trip ↔ request cross-matching (±90 min). */
export const MATCH_WINDOW_MS = 90 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * [start, end) ms window for an optional YYYY-MM-DD day filter, floored at
 * `now` so already-departed posts never list. Jordan is UTC+3 year-round (no
 * DST since 2022). A missing or malformed date means "everything upcoming".
 */
export function ammanDayWindow(
  date: string | undefined,
  now: number,
): { start: number; end: number } {
  if (date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const dayStart = Date.parse(`${date}T00:00:00+03:00`);
    if (!Number.isNaN(dayStart)) {
      return { start: Math.max(dayStart, now), end: dayStart + DAY_MS };
    }
  }
  return { start: now, end: Number.POSITIVE_INFINITY };
}

/** Anti-spam floor: max open trips/requests per user. */
export const MAX_OPEN_POSTS = 3;

/**
 * Anti-scrape floor on the phone-revealing mutations (bookings.book,
 * requests.accept): at most this many per user per sliding hour.
 */
export const MAX_REVEALS_PER_HOUR = 10;
export const REVEAL_WINDOW_MS = 60 * 60 * 1000;

/**
 * Sliding-hour anti-scrape guard. Pass the caller's newest-first rows from the
 * relevant index, capped at MAX_REVEALS_PER_HOUR: limited iff the batch is full
 * and its oldest row is still inside the window (so all MAX_REVEALS_PER_HOUR
 * landed within the last hour). Shared by bookings.book and requests.accept.
 */
export function isRevealRateLimited(
  recent: ReadonlyArray<{ _creationTime: number }>,
  now: number,
): boolean {
  return (
    recent.length >= MAX_REVEALS_PER_HOUR &&
    recent[recent.length - 1]._creationTime > now - REVEAL_WINDOW_MS
  );
}

/**
 * Normalize a Jordanian mobile number to E.164 (+9627XXXXXXXX).
 * Accepts 07XXXXXXXX, 7XXXXXXXX, 9627XXXXXXXX, +9627XXXXXXXX, 009627XXXXXXXX
 * (with spaces/dashes anywhere). Returns null if not a valid Jordanian mobile.
 */
export function normalizeJordanPhone(input: string): string | null {
  let d = input.replace(/[\s\-()]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);

  let rest: string; // 7XXXXXXXX (9 digits)
  if (/^07\d{8}$/.test(d)) rest = d.slice(1);
  else if (/^9627\d{8}$/.test(d)) rest = d.slice(3);
  else if (/^7\d{8}$/.test(d)) rest = d;
  else return null;

  // Jordanian mobile prefixes are 077 / 078 / 079.
  if (!/^7[789]\d{7}$/.test(rest)) return null;
  return `+962${rest}`;
}

/** +9627XXXXXXXX → wa.me link (wa.me wants digits only). */
export function waLink(phoneE164: string): string {
  return `https://wa.me/${phoneE164.replace(/^\+/, "")}`;
}
