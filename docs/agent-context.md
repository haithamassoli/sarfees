# Serfees — Agent Context Pack

You are building milestones of the Serfees app (Arabic-first RTL PWA marketplace for shared inter-city taxis in Jordan). Spec: `docs/PRD.md`. Plan: `docs/tasks.md`. M0 is DONE (shell, schema, auth config, theme, proxy guard). Read this whole file before touching code.

## Required reading (in order, before coding)

1. `docs/PRD.md` — the spec. Your milestone section in `docs/tasks.md`.
2. `convex/_generated/ai/guidelines.md` — Convex rules. **These override your training data** (new-style `ctx.db.get("table", id)` signatures, no `.filter()`, bounded queries, validators everywhere, `"use node"` rules, convex-test setup).
3. If you touch React/Next UI: `.agents/skills/vercel-react-best-practices/SKILL.md` (consult `rules/` files it indexes when relevant).
4. If you verify in a browser: `.agents/skills/next-dev-loop/SKILL.md` and run `agent-browser skills get core` first.

## Stack facts (do not re-derive, do not "fix")

- **Next.js 16.3.0-preview.5 (App Router, Turbopack).** Breaking changes vs your training data. If unsure about an API, read `node_modules/next/dist/docs/01-app/**`. Known deltas:
  - `middleware.ts` is now **`proxy.ts`** (exists already, guards authed routes — verified working).
  - `params` and `searchParams` are **Promises** — `await` them. Typed helpers exist: `PageProps<'/route/[from]/[to]'>`, `LayoutProps<'/'>` (globally available, no import).
  - `cacheComponents` is **OFF**. Old caching model applies. Public pages that read Convex data must export `const dynamic = "force-dynamic"` (fresh per-request; the PRD's revalidate:60 was superseded — freshness is correct for seat counts and dev/bots still get full HTML SSR).
  - Metadata file conventions: `app/manifest.ts`, `app/sitemap.ts`, `app/robots.ts`, `app/**/opengraph-image.tsx` (ImageResponse from `next/og`).
  - No webpack plugins (Turbopack). The service worker (M5) is a hand-written `public/sw.js` — do NOT use `@serwist/next` (installed but deliberately unused; PRD deviation accepted).
- **Convex 1.42** — dev deployment `amiable-dragon-408` (cloud, already wired in `.env.local`). `npx convex dev` **is already running** and auto-pushes `convex/` changes + regenerates `convex/_generated/*`. Push errors appear in that process's log — after editing convex files, verify push succeeded via `npx convex function-spec 2>/dev/null | head -5` or by checking types compile.
- **Convex Auth** (`@convex-dev/auth`) — Password provider configured in `convex/auth.ts`; **phone-as-account-key**: the client submits the phone in the `email` param, `normalizeJordanPhone` maps it to E.164. In Convex functions get the current user with `getAuthUserId(ctx)` from `@convex-dev/auth/server`. On the client: `useAuthActions()` from `@convex-dev/auth/react` (`signIn("password", { email: phone, password, name?, flow: "signUp" | "signIn" })`), `useQuery(api.users.viewer)` pattern for the profile.
- **UI**: Tailwind v4 (CSS tokens in `app/globals.css`), shadcn v4 on Base UI — primitives already in `components/ui/` (button, input, label, select, textarea, card, badge, separator, dialog, sonner, skeleton, switch). Icons: `lucide-react`. Forms: **TanStack Form** (`@tanstack/react-form`, installed — use it for signup/login/post/request forms; keep it simple: `useForm` + field validators + `onSubmit`).
- **Do NOT**: run `npm install` (everything needed is installed), edit `package.json`, restart the dev servers, create git commits, or touch `.env.local`.

## Dev environment (already running)

- `next dev` → http://localhost:3000 (Turbopack). `/_next/mcp` endpoint live (SSE — parse with `sed -n 's/^data: //p'`).
- `npx convex dev` → watching + auto-pushing.
- Commands: `npm run typecheck` (tsc), `npm run test` (vitest, edge-runtime env, convex-test), `npm run lint` (eslint).
- Test accounts for browser flows (create via the UI if missing, password `serfees123`):
  - Driver: phone `0791111111`, name `أبو خالد`
  - Passenger: phone `0787777777`, name `سارة`

## Conventions (match M0 code — read it)

- **Arabic-only UI.** Every user-visible string lives in `messages/ar.json`, accessed via `t("key")` from `@/lib/i18n` (typed keys — add keys to the JSON as you need them). No hardcoded UI strings, no English UI.
- **RTL**: `<html dir="rtl">` is set. Use logical Tailwind utilities only (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`). Never `ml/mr/pl/pr/left/right`.
- **Time**: helpers in `lib/time.ts` (`fmtDayTime`, `fmtDay`, `fmtTime`, `ammanWallClockToMs`, `ammanToday`) — Asia/Amman always, Western digits. Native `<input type="date">`/`<input type="time">` only.
- **Domain**: `convex/lib/shared.ts` (GOVERNORATES, GOV_AR, isGov, MATCH_WINDOW_MS, MAX_OPEN_POSTS, normalizeJordanPhone, waLink) — client-safe, import from both sides. Validators for schema/args: `convex/lib/validators.ts`.
- **Design tokens** (semantic classes only — never raw colors): `bg-background/card/secondary/muted`, `text-foreground/muted-foreground/primary`, `border-border`, `bg-primary text-primary-foreground` for CTAs, `bg-plate text-plate-foreground` for seat/amber badges, `.route-sign` + `<RouteSign from to size>` (`components/route-sign.tsx`) for route headers — the signature element, use it on trip/request cards and detail pages. Headings get `font-heading` automatically (h1–h4).
- **Currency**: JOD as `{price} {t("jod")}` (د.أ), western digits.
- **Money/prices**: integers or .25/.5 steps are fine; validate `price >= 0`, `seats > 0` at the mutation boundary (PRD Non-functional).
- **Privacy rule (server-enforced)**: phone + vehicle plate appear ONLY to a counterpart of a `confirmed` (or `completed`) booking — build/reuse the helper in `convex/lib/privacy.ts` (M2 creates it). Public payloads carry name, ratingAvg, ratingCount, vehicle make/color only. Never return raw `Doc<"users">` from public queries.
- **Convex functions**: files per domain (`convex/trips.ts`, `convex/bookings.ts`, `convex/requests.ts`, `convex/notifications.ts`, `convex/ratings.ts`, `convex/users.ts`, `convex/push.ts`, `convex/matching.ts`). Public API minimal; everything internal is `internal*`. Args validated with `v.*` always. Throw `new ConvexError("<ar_json_error_key>")` for user-facing failures; the client maps that key via `t()` (pattern: `error_*` keys in `messages/ar.json`).
- **Notifications**: `notify()` helper (M4, `convex/matching.ts` or `convex/notifications.ts`) = insert `notifications` row + (match/booking types only) `ctx.scheduler.runAfter(0, internal.push.send, …)`.
- Comments: only for constraints code can't express. Deliberate shortcuts get a `// ponytail:` comment naming ceiling + upgrade path.

## Verification recipe (verifier agents)

1. Compile state: `curl -s -X POST http://localhost:3000/_next/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_compilation_issues","arguments":{}}}' | sed -n 's/^data: //p'` (also `get_errors`, `get_routes` same shape).
2. Browser: `agent-browser skills get core` once, then use a session: `SESSION=$(agent-browser session id --scope worktree --prefix serfees-<role>)`, `agent-browser --session "$SESSION" --restore open <url>`, snapshot/click/fill/screenshot per the core guide. Two-account flows: two distinct session prefixes (`serfees-driver`, `serfees-passenger`).
3. Gates: `npm run typecheck && npm run test` must pass.
4. Visual: screenshot at 390×844 (mobile) and 1280×800 (desktop); check RTL (content flows right→left), Arabic strings render, tokens (limestone bg, green primary) applied, no horizontal scroll.

## Definition of done (every milestone)

- `npm run typecheck` + `npm run test` + `get_compilation_issues` clean.
- Demo gate from `docs/tasks.md` for the milestone demonstrated in a real browser.
- All strings via `t()`; RTL-safe utilities; privacy rule respected in every new query.
- No new packages; no commits; leave dev servers running.
