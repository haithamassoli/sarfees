# Serfees — Launch checklist

Covers the two non-executable M7 items in [tasks.md](./tasks.md): the production
checklist and launch ops. Everything here is run by a human with prod access.

## Production checklist

1. **Vercel**: production project + custom domain attached (e.g. `https://serfees.jo`).
2. **Convex prod deployment**: created next to the dev one (Convex dashboard or
   first `npx convex deploy`). Wire the Vercel build to it:
   `CONVEX_DEPLOY_KEY` (production key) in Vercel env, build command
   `npx convex deploy --cmd 'npm run build'`.
3. **Vercel production env vars**:
   - `NEXT_PUBLIC_SITE_URL=https://<domain>` — canonical origin for OG tags,
     sitemap, robots (`lib/site.ts` falls back to localhost without it).
   - `NEXT_PUBLIC_CONVEX_URL=https://<prod-deployment>.convex.cloud`
     (set automatically by `npx convex deploy` builds).
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY=<prod public key>` — must be the same key
     pushed to Convex below, or subscriptions won't match the sender.
4. **Prod VAPID keypair** (do NOT reuse the dev pair):
   ```sh
   npx web-push generate-vapid-keys
   npx convex env set VAPID_PUBLIC_KEY  "<public>"  --prod
   npx convex env set VAPID_PRIVATE_KEY "<private>" --prod
   npx convex env set SITE_URL "https://<domain>" --prod
   ```
5. **Convex Auth prod keys**: `npx @convex-dev/auth --prod` — generates
   `JWT_PRIVATE_KEY` + `JWKS` on the prod deployment (dev keys never leave dev).
6. **Smoke test on the prod URL** (real phone, fresh account):
   - Sign up with an `07…` number → log out → log back in with the `+9627…` form.
   - Post a trip; from a second account book a seat; confirm the push arrives
     with the site closed and taps through to `/trips/[id]`.
   - Phone/plate absent from the trip page network payload while logged out.
   - Paste a trip link into WhatsApp → Arabic OG card unfurls (route, day/time, price).
   - `https://<domain>/sitemap.xml` lists 133 URLs; `robots.txt` points at it.
   - Lighthouse (mobile, throttled 4G): installable PWA + fast public pages.

## Launch ops — corridor seeding (PRD "Launch")

All 12 governorates are enabled (it's an enum), but liquidity is seeded
corridor by corridor:

1. **Amman ↔ Irbid first** — universities, the classic serfees crowd. Then
   Amman ↔ Zarqa, then Amman ↔ Aqaba.
2. Recruit a handful of real drivers per corridor (the groups below are full
   of them) and have them post their actual scheduled trips so
   `/route/amman/irbid` and `/route/irbid/amman` are never empty.
3. **Mechanic**: share the route pages and fresh trip links into the existing
   serfees Facebook/WhatsApp groups where demand already sits. The share
   button on every trip/request/route page produces the link; the WhatsApp
   unfurl (Arabic OG card) is the ad. Repost fresh trip links daily until the
   corridor self-sustains.
4. Watch `/route/amman/irbid` for the first organic (non-seeded) posts before
   opening the next corridor.
