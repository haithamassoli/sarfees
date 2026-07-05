import { t } from "@/lib/i18n";

// Everything renders in Jordan time regardless of the viewer's clock
// (docs/PRD.md). Western digits (nu-latn) per the design system.
const TZ = "Asia/Amman";
const LOCALE = "ar-JO-u-nu-latn";

const timeFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  hour: "numeric",
  minute: "2-digit",
});

const dayFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const ammanDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const ammanHM = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "3:30 م" */
export function fmtTime(ms: number): string {
  return timeFmt.format(ms);
}

/** "اليوم" / "غدًا" / "الجمعة، 10 تموز" */
export function fmtDay(ms: number, now: number = Date.now()): string {
  const day = ammanDay.format(ms);
  if (day === ammanDay.format(now)) return t("today");
  if (day === ammanDay.format(now + 24 * 60 * 60 * 1000)) return t("tomorrow");
  return dayFmt.format(ms);
}

/** "اليوم · 3:30 م" */
export function fmtDayTime(ms: number, now: number = Date.now()): string {
  return `${fmtDay(ms, now)} · ${fmtTime(ms)}`;
}

/** Combine native <input type="date"> + <input type="time"> values into a UTC
 * timestamp, interpreting them as Jordan wall-clock time (UTC+3, no DST since 2022). */
export function ammanWallClockToMs(date: string, time: string): number {
  return Date.parse(`${date}T${time}:00+03:00`);
}

/** ms → "YYYY-MM-DD" Amman wall-clock; no arg = today (<input type="date">). */
export function ammanToday(now: number = Date.now()): string {
  return ammanDay.format(now);
}

/** ms → "HH:mm" Amman wall-clock (prefill <input type="time">). */
export function ammanTimeInput(ms: number): string {
  return ammanHM.format(ms);
}
