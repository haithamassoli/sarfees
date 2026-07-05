import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Public surface is crawlable; the authed, per-user pages are not worth a
// crawler's time (they only render a login redirect anyway).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/activity", "/notifications", "/profile", "/post"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
