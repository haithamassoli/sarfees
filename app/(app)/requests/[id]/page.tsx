import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { CalendarClock, MapPin, StickyNote } from "lucide-react";
import { DetailRow } from "@/components/detail-row";
import { RatingBadge } from "@/components/rating-badge";
import { RequestPanel } from "@/components/request-panel";
import { RequestStatusBadge } from "@/components/request-status-badge";
import { RouteSign } from "@/components/route-sign";
import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { GOV_AR } from "@/convex/lib/shared";
import { seatsLabel, t } from "@/lib/i18n";
import { requestDescription, requestTitle } from "@/lib/seo";
import { fmtDayTime } from "@/lib/time";

// Fresh per request: the open/matched state matters more than caching here.
export const dynamic = "force-dynamic";

// One Convex round-trip per request, shared by generateMetadata and the page.
// Token makes the query viewer-aware (owner/accepting driver get the phone
// server-side; everyone else a stripped payload).
const getRequest = cache(async (id: string) => {
  const token = await convexAuthNextjsToken();
  try {
    return await fetchQuery(
      api.requests.get,
      { id: id as Id<"rideRequests"> },
      { token },
    );
  } catch {
    return null; // malformed id fails arg validation
  }
});

export async function generateMetadata({
  params,
}: PageProps<"/requests/[id]">): Promise<Metadata> {
  const { id } = await params;
  const request = await getRequest(id);
  if (request === null) return { title: t("error_request_not_found") };

  const title = requestTitle(request);
  const description = requestDescription(request);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/requests/${id}`,
      siteName: t("app_name"),
      locale: "ar_JO",
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function RequestPage({
  params,
}: PageProps<"/requests/[id]">) {
  const { id } = await params;
  const request = await getRequest(id);
  if (request === null) notFound();

  return (
    <article className="flex flex-col gap-4">
      <header className="flex flex-col items-start gap-3">
        <h1 className="sr-only">
          {`${t("post_request")} ${t("from")} ${GOV_AR[request.originGov]} ${t("to")} ${GOV_AR[request.destGov]}`}
        </h1>
        <div className="flex w-full items-center justify-between gap-2">
          <RouteSign from={request.originGov} to={request.destGov} size="lg" />
          <ShareButton title={requestTitle(request)} />
        </div>
        {request.status !== "open" && (
          <RequestStatusBadge status={request.status} />
        )}
      </header>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <CalendarClock size={18} aria-hidden className="text-primary" />
            <span className="text-base font-medium">
              {fmtDayTime(request.desiredAt)}
            </span>
          </div>
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {t("seats_requested")}
            </span>
            <Badge className="bg-plate text-plate-foreground">
              {seatsLabel(request.seats)}
            </Badge>
          </div>
          {/* Live island: accept dialog / owner controls / passenger contact. */}
          <RequestPanel requestId={request._id} />
        </CardContent>
      </Card>

      {(request.originArea !== undefined ||
        request.destArea !== undefined ||
        request.note !== undefined) && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            {request.originArea !== undefined && (
              <DetailRow
                icon={<MapPin size={16} aria-hidden className="text-primary" />}
                label={t("origin_area")}
                value={request.originArea}
              />
            )}
            {request.destArea !== undefined && (
              <DetailRow
                icon={<MapPin size={16} aria-hidden className="text-primary" />}
                label={t("dest_area")}
                value={request.destArea}
              />
            )}
            {request.note !== undefined && (
              <DetailRow
                icon={
                  <StickyNote size={16} aria-hidden className="text-primary" />
                }
                label={t("note_label")}
                value={request.note}
              />
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-1.5">
          <span className="text-sm text-muted-foreground">
            {t("passenger")}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-base font-medium">
              {request.passenger.name}
            </span>
            <RatingBadge
              avg={request.passenger.ratingAvg}
              count={request.passenger.ratingCount}
            />
          </div>
          {/* Phone / wa.me for the accepting driver renders in RequestPanel. */}
        </CardContent>
      </Card>
    </article>
  );
}
