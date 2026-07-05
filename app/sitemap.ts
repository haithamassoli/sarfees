import type { MetadataRoute } from "next";
import { GOVERNORATES } from "@/convex/lib/shared";
import { SITE_URL } from "@/lib/site";

// "/" + all 132 ordered governorate pairs. Individual trips/requests expire
// too fast to sitemap (docs/PRD.md — Public pages, sharing & SEO).
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "hourly", priority: 1 },
  ];
  for (const from of GOVERNORATES) {
    for (const to of GOVERNORATES) {
      if (from === to) continue;
      entries.push({
        url: `${SITE_URL}/route/${from}/${to}`,
        changeFrequency: "hourly",
        priority: 0.8,
      });
    }
  }
  return entries;
}
