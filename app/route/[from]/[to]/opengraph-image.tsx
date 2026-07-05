import { isGov } from "@/convex/lib/shared";
import { t } from "@/lib/i18n";
import { brandOgImage, OG_CONTENT_TYPE, OG_SIZE, routeOgImage } from "@/lib/og";

export const alt = `${t("app_name")} — ${t("app_tagline")}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Mirrors the page's freshness config (no data fetch here, but the font
// fetch must not run at build).
export const dynamic = "force-dynamic";

export default async function Image({
  params,
}: {
  params: Promise<{ from: string; to: string }>;
}) {
  const { from, to } = await params;
  if (!isGov(from) || !isGov(to) || from === to) return await brandOgImage();
  return await routeOgImage({ from, to, subtitle: t("app_tagline") });
}
