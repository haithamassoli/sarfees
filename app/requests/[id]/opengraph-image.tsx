import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { t } from "@/lib/i18n";
import { brandOgImage, OG_CONTENT_TYPE, OG_SIZE, routeOgImage } from "@/lib/og";
import { requestOgSubtitle } from "@/lib/seo";

export const alt = `${t("app_name")} — ${t("app_tagline")}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Fresh per request, like the page: "اليوم/غدًا" shifts with the clock.
export const dynamic = "force-dynamic";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    // Public payload (no token): the card only needs route, time and seats.
    const request = await fetchQuery(api.requests.get, {
      id: id as Id<"rideRequests">,
    });
    if (request === null) return await brandOgImage();
    return await routeOgImage({
      from: request.originGov,
      to: request.destGov,
      subtitle: requestOgSubtitle(request),
    });
  } catch {
    // Malformed id (arg validation) or a fetch hiccup — never throw over a card.
    return await brandOgImage();
  }
}
