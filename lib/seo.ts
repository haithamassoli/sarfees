import { GOV_AR, type Gov } from "@/convex/lib/shared";
import { seatsLabel, t } from "@/lib/i18n";
import { fmtDay, fmtTime } from "@/lib/time";

// Share/OG copy for the public pages, composed from ar.json fragments in the
// PRD's title styles. Pure string builders — safe on server and client.

/** "اليوم 3:00 م" — share-title style (no separator dot, unlike fmtDayTime). */
function dayTime(ms: number): string {
  return `${fmtDay(ms)} ${fmtTime(ms)}`;
}

/** "عمان ← إربد" logical order; RTL rendering shows dest ← origin visually. */
export function routeLine(from: Gov, to: Gov): string {
  return `${GOV_AR[from]} ← ${GOV_AR[to]}`;
}

/** "سيرفيس من عمان إلى إربد" (PRD route-page title). */
export function routeTitle(from: Gov, to: Gov): string {
  return `${t("app_name")} ${t("from")} ${GOV_AR[from]} ${t("to")} ${GOV_AR[to]}`;
}

export function routeDescription(from: Gov, to: Gov): string {
  return `${t("og_route_desc_lead")} ${t("from")} ${GOV_AR[from]} ${t("to")} ${GOV_AR[to]} — ${t("og_route_desc_cta")}`;
}

type TripSeo = {
  originGov: Gov;
  destGov: Gov;
  departAt: number;
  pricePerSeat: number;
  seatsAvailable: number;
};

/** "عمان ← إربد · اليوم 3:00 م · 5 د.أ" (PRD trip title). */
export function tripTitle(trip: TripSeo): string {
  return `${routeLine(trip.originGov, trip.destGov)} · ${dayTime(trip.departAt)} · ${trip.pricePerSeat} ${t("jod")}`;
}

export function tripDescription(trip: TripSeo): string {
  return `${t("og_trip_desc_lead")} ${t("from")} ${GOV_AR[trip.originGov]} ${t("to")} ${GOV_AR[trip.destGov]} — ${dayTime(trip.departAt)} · ${seatsLabel(trip.seatsAvailable)} · ${trip.pricePerSeat} ${t("jod")} ${t("per_seat")} · ${t("og_trip_desc_cta")}`;
}

/** OG-card subtitle: "اليوم 3:00 م · 5 د.أ". */
export function tripOgSubtitle(trip: Omit<TripSeo, "seatsAvailable">): string {
  return `${dayTime(trip.departAt)} · ${trip.pricePerSeat} ${t("jod")}`;
}

type RequestSeo = {
  originGov: Gov;
  destGov: Gov;
  desiredAt: number;
  seats: number;
};

/** "طلب مشوار · عمان ← إربد · اليوم 3:00 م · 2 مقاعد". */
export function requestTitle(request: RequestSeo): string {
  return `${t("request_share_prefix")} · ${routeLine(request.originGov, request.destGov)} · ${dayTime(request.desiredAt)} · ${seatsLabel(request.seats)}`;
}

export function requestDescription(request: RequestSeo): string {
  return `${t("og_request_desc_lead")} ${t("from")} ${GOV_AR[request.originGov]} ${t("to")} ${GOV_AR[request.destGov]} — ${dayTime(request.desiredAt)} · ${seatsLabel(request.seats)} · ${t("og_request_desc_cta")}`;
}

/** OG-card subtitle: "اليوم 3:00 م · 2 مقاعد". */
export function requestOgSubtitle(request: RequestSeo): string {
  return `${dayTime(request.desiredAt)} · ${seatsLabel(request.seats)}`;
}
