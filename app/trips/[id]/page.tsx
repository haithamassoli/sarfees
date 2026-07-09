import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { CalendarClock, MapPin, StickyNote, Waypoints } from "lucide-react";
import { BookPanel } from "@/components/book-panel";
import { DetailRow } from "@/components/detail-row";
import { RatingBadge } from "@/components/rating-badge";
import { RouteSign } from "@/components/route-sign";
import { ShareButton } from "@/components/share-button";
import { TripStatusBadge } from "@/components/trip-status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { GOV_AR } from "@/convex/lib/shared";
import { seatsLabel, t } from "@/lib/i18n";
import { tripDescription, tripTitle } from "@/lib/seo";
import { fmtDayTime } from "@/lib/time";

// Fresh per request: live seat counts matter more than caching here.
export const dynamic = "force-dynamic";

// One Convex round-trip per request, shared by generateMetadata and the page.
// Token makes the query viewer-aware (driver/confirmed counterpart get
// phone + plate server-side; everyone else a stripped payload).
const getTrip = cache(async (id: string) => {
  const token = await convexAuthNextjsToken();
  try {
    return await fetchQuery(api.trips.get, { id: id as Id<"trips"> }, { token });
  } catch {
    return null; // malformed id fails arg validation
  }
});

export async function generateMetadata({
  params,
}: PageProps<"/trips/[id]">): Promise<Metadata> {
  const { id } = await params;
  const trip = await getTrip(id);
  if (trip === null) return { title: t("error_trip_not_found") };

  const title = tripTitle(trip);
  const description = tripDescription(trip);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/trips/${id}`,
      siteName: t("app_name"),
      locale: "ar_JO",
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function TripPage({ params }: PageProps<"/trips/[id]">) {
  const { id } = await params;
  const trip = await getTrip(id);
  if (trip === null) notFound();

  return (
    <article className="flex flex-col gap-4">
      <header className="flex flex-col items-start gap-3">
        <h1 className="sr-only">
          {`${t("app_name")} ${t("from")} ${GOV_AR[trip.originGov]} ${t("to")} ${GOV_AR[trip.destGov]}`}
        </h1>
        <div className="flex w-full items-center justify-between gap-2">
          <RouteSign from={trip.originGov} to={trip.destGov} size="lg" />
          <ShareButton title={tripTitle(trip)} />
        </div>
        {trip.status !== "open" && <TripStatusBadge status={trip.status} />}
      </header>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <CalendarClock size={18} aria-hidden className="text-primary" />
            <span className="text-base font-medium">
              {fmtDayTime(trip.departAt)}
            </span>
          </div>
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="font-heading text-2xl font-bold">
                {trip.pricePerSeat} {t("jod")}
              </span>
              <span className="text-sm text-muted-foreground">
                {t("per_seat")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {t("seats_available")}
              </span>
              <Badge variant="plate">{seatsLabel(trip.seatsAvailable)}</Badge>
            </div>
          </div>
          {/* Live island: seat stepper / booking status / driver contact. */}
          <BookPanel tripId={trip._id} />
        </CardContent>
      </Card>

      {(trip.originArea !== undefined ||
        trip.destArea !== undefined ||
        trip.stops !== undefined ||
        trip.note !== undefined) && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            {trip.originArea !== undefined && (
              <DetailRow
                icon={<MapPin size={16} aria-hidden className="text-primary" />}
                label={t("origin_area")}
                value={trip.originArea}
              />
            )}
            {trip.destArea !== undefined && (
              <DetailRow
                icon={<MapPin size={16} aria-hidden className="text-primary" />}
                label={t("dest_area")}
                value={trip.destArea}
              />
            )}
            {trip.stops !== undefined && trip.stops.length > 0 && (
              <DetailRow
                icon={
                  <Waypoints size={16} aria-hidden className="text-primary" />
                }
                label={t("stops_label")}
                value={trip.stops.join("، ")}
              />
            )}
            {trip.note !== undefined && (
              <DetailRow
                icon={
                  <StickyNote size={16} aria-hidden className="text-primary" />
                }
                label={t("note_label")}
                value={trip.note}
              />
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-1.5">
          <span className="text-sm text-muted-foreground">{t("driver")}</span>
          <div className="flex items-center gap-2">
            <span className="text-base font-medium">{trip.driver.name}</span>
            <RatingBadge
              avg={trip.driver.ratingAvg}
              count={trip.driver.ratingCount}
            />
          </div>
          {trip.driver.vehicle !== undefined && (
            <p className="text-sm text-muted-foreground">
              {t("vehicle_label")}: {trip.driver.vehicle.make} ·{" "}
              {trip.driver.vehicle.color}
            </p>
          )}
          {/* Phone / wa.me for confirmed counterparts renders in BookPanel. */}
        </CardContent>
      </Card>
    </article>
  );
}
