import type { MetadataRoute } from "next";
import { t } from "@/lib/i18n";

// Colors mirror the light tokens in app/globals.css / the layout's themeColor
// (--background as hex) — the manifest wants literal colors, not CSS vars.
const LIGHT_BACKGROUND = "#f5f2ea";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: t("app_name"),
    short_name: t("app_name"),
    description: t("app_description"),
    start_url: "/",
    display: "standalone",
    dir: "rtl",
    lang: "ar",
    background_color: LIGHT_BACKGROUND,
    theme_color: LIGHT_BACKGROUND,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
