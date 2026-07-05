/**
 * Absolute origin for canonical URLs, OG tags, sitemap and robots.
 * Production sets NEXT_PUBLIC_SITE_URL (see docs/launch.md); the default
 * covers dev — nothing to add to .env.local.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
