import Link from "next/link";
import { RatingBadge } from "@/components/rating-badge";
import { RouteSign } from "@/components/route-sign";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Gov } from "@/convex/lib/shared";
import { seatsLabel, t } from "@/lib/i18n";
import { fmtDayTime } from "@/lib/time";

export type TripCardTrip = {
  _id: string;
  originGov: Gov;
  destGov: Gov;
  departAt: number;
  seatsAvailable: number;
  pricePerSeat: number;
  driver: { name: string; ratingAvg: number; ratingCount: number };
};

/** Browse-list card; the whole card links to the trip page. Server-safe. */
export function TripCard({ trip }: { trip: TripCardTrip }) {
  return (
    <Link
      href={`/trips/${trip._id}`}
      className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card size="sm" className="transition-shadow hover:ring-primary/40">
        <CardContent className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <RouteSign from={trip.originGov} to={trip.destGov} size="sm" />
            <span className="whitespace-nowrap font-heading text-base font-semibold">
              {trip.pricePerSeat} {t("jod")}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              {fmtDayTime(trip.departAt)}
            </span>
            <Badge className="bg-plate text-plate-foreground">
              {seatsLabel(trip.seatsAvailable)}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{trip.driver.name}</span>
            <RatingBadge
              avg={trip.driver.ratingAvg}
              count={trip.driver.ratingCount}
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
