import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { t } from "@/lib/i18n";
import { brandOgImage, OG_CONTENT_TYPE, OG_SIZE, routeOgImage } from "@/lib/og";
import { tripOgSubtitle } from "@/lib/seo";

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
    // Public payload (no token): the card only needs route, time and price.
    const trip = await fetchQuery(api.trips.get, { id: id as Id<"trips"> });
    if (trip === null) return await brandOgImage();
    return await routeOgImage({
      from: trip.originGov,
      to: trip.destGov,
      subtitle: tripOgSubtitle(trip),
    });
  } catch {
    // Malformed id (arg validation) or a fetch hiccup — never throw over a card.
    return await brandOgImage();
  }
}
