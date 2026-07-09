import Link from "next/link";
import { RatingBadge } from "@/components/rating-badge";
import { RouteSign } from "@/components/route-sign";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Gov } from "@/convex/lib/shared";
import { seatsLabel } from "@/lib/i18n";
import { fmtDayTime } from "@/lib/time";

export type RequestCardRequest = {
  _id: string;
  originGov: Gov;
  destGov: Gov;
  desiredAt: number;
  seats: number;
  passenger: { name: string; ratingAvg: number; ratingCount: number };
};

/** Browse-list card; the whole card links to the request page. Server-safe. */
export function RequestCard({ request }: { request: RequestCardRequest }) {
  return (
    <Link
      href={`/requests/${request._id}`}
      className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card size="sm" className="transition-shadow hover:ring-primary/40">
        <CardContent className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <RouteSign from={request.originGov} to={request.destGov} size="sm" />
            <Badge variant="plate">{seatsLabel(request.seats)}</Badge>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              {fmtDayTime(request.desiredAt)}
            </span>
            <span className="flex items-center gap-2">
              <span className="font-medium">{request.passenger.name}</span>
              <RatingBadge
                avg={request.passenger.ratingAvg}
                count={request.passenger.ratingCount}
              />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
