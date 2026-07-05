import { ImageResponse } from "next/og";
import { GOV_AR, type Gov } from "@/convex/lib/shared";
import { t } from "@/lib/i18n";

// Shared OG-card renderer for /trips/[id], /requests/[id] and /route/[from]/[to].
// Satori can't read CSS custom properties or oklch(), so the globals.css
// tokens (--sign, --sign-foreground, --plate) are mirrored here as sRGB hex.
const SIGN = "#17502c";
const SIGN_FG = "#fafdfa";
const PLATE = "#f0bf61";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

// Cairo, not the app's Noto Kufi Arabic: satori's Arabic shaper rejects Noto
// Kufi (and Reem Kufi) with "lookupType: 5 … not yet supported" — a GSUB
// table in the family itself, in every format Google serves. Cairo is the
// closest Kufic-influenced face that satori shapes correctly (verified).
const ARABIC_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Cairo:wght@700&display=swap";
// A pre-woff2 UA makes Google Fonts answer with a WOFF url — a format satori
// parses (it can't read woff2).
const LEGACY_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/23.0.1271.95 Safari/537.11";

let fontCache: Promise<ArrayBuffer | null> | null = null;

async function fetchArabicBold(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(ARABIC_CSS_URL, {
      headers: { "User-Agent": LEGACY_UA },
    });
    if (!css.ok) return null;
    const url = (await css.text()).match(/src:\s*url\((https:[^)]+)\)/)?.[1];
    if (url === undefined) return null;
    const font = await fetch(url);
    if (!font.ok) return null;
    return await font.arrayBuffer();
  } catch {
    return null;
  }
}

/** OG images render per request — cache the font in a module variable; a
 * failed fetch yields the latin fallback card and retries next request. */
async function loadArabicBold(): Promise<ArrayBuffer | null> {
  if (fontCache === null) fontCache = fetchArabicBold();
  const data = await fontCache;
  if (data === null) fontCache = null;
  return data;
}

/**
 * Satori's bidi handling is unreliable, so ordering is done by layout, not by
 * the text engine: whitespace tokens laid out with row-reverse. Each token is
 * single-direction ("اليوم", "3:00", "د.أ"), so no intra-token reordering can
 * occur and the line reads correctly right-to-left.
 */
function RtlLine({
  text,
  fontSize,
  color,
}: {
  text: string;
  fontSize: number;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row-reverse",
        alignItems: "center",
        gap: Math.round(fontSize * 0.3),
        fontSize,
        color,
      }}
    >
      {text.split(/\s+/).map((word, i) => (
        <span key={i}>{word}</span>
      ))}
    </div>
  );
}

/** The highway-gantry arrow (lucide MoveLeft), pointing at the destination. */
function Arrow({ size, left }: { size: number; left: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={SIGN_FG}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={left ? "M6 8L2 12L6 16" : "M18 8L22 12L18 16"} />
      <path d="M2 12H22" />
    </svg>
  );
}

/** Signage-green plate with the white inner border real gantry signs carry. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundColor: SIGN,
        padding: 26,
        fontFamily: "Cairo",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 30,
          border: `5px solid ${SIGN_FG}`,
          borderRadius: 28,
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Wordmark({ text }: { text: string }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        right: 40,
        display: "flex",
        fontSize: 34,
        color: SIGN_FG,
        opacity: 0.92,
      }}
    >
      {text}
    </div>
  );
}

function latinName(gov: Gov): string {
  return gov.charAt(0).toUpperCase() + gov.slice(1);
}

/** No Arabic font → latin card (satori's default font has no Arabic glyphs). */
function latinCard(pair?: { from: Gov; to: Gov }) {
  return (
    <Frame>
      {pair === undefined ? (
        <div style={{ display: "flex", fontSize: 120, color: SIGN_FG }}>
          {t("app_name_latin")}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 36,
            fontSize: 88,
            color: SIGN_FG,
          }}
        >
          <span>{latinName(pair.from)}</span>
          <Arrow size={80} left={false} />
          <span>{latinName(pair.to)}</span>
        </div>
      )}
      <Wordmark text={t("app_name_latin")} />
    </Frame>
  );
}

/** Fully materializes the PNG: ImageResponse only surfaces satori/resvg
 * errors when its stream is consumed (in dev that drops the connection —
 * "failed to pipe response"), so buffer it here where the caller can catch. */
async function render(
  card: React.ReactElement,
  font: ArrayBuffer | null,
): Promise<Response> {
  const image = new ImageResponse(card, {
    ...OG_SIZE,
    fonts:
      font === null
        ? undefined
        : [{ name: "Cairo", data: font, style: "normal", weight: 700 }],
  });
  return new Response(await image.arrayBuffer(), { headers: image.headers });
}

/** Arabic card when the font loaded and shapes; latin card on any failure. */
async function renderWithFallback(
  arabicCard: () => React.ReactElement,
  fallback: React.ReactElement,
): Promise<Response> {
  const font = await loadArabicBold();
  if (font !== null) {
    try {
      return await render(arabicCard(), font);
    } catch {
      // Shaping/raster failure — a card must come back, never a 500.
    }
  }
  return render(fallback, null);
}

/** Route card: big Kufi-style "إربد ← عمان" (visual order) + subtitle line. */
export async function routeOgImage({
  from,
  to,
  subtitle,
}: {
  from: Gov;
  to: Gov;
  subtitle: string;
}): Promise<Response> {
  return renderWithFallback(
    () => (
      <Frame>
        {/* Logical [from, arrow, to] + row-reverse = origin on the right, the
            arrow pointing left at the destination — same as <RouteSign>. */}
        <div
          style={{
            display: "flex",
            flexDirection: "row-reverse",
            alignItems: "center",
            gap: 36,
            fontSize: 96,
            color: SIGN_FG,
          }}
        >
          <span>{GOV_AR[from]}</span>
          <Arrow size={88} left={true} />
          <span>{GOV_AR[to]}</span>
        </div>
        <RtlLine text={subtitle} fontSize={44} color={PLATE} />
        <Wordmark text={t("app_name")} />
      </Frame>
    ),
    latinCard({ from, to }),
  );
}

/** Generic brand card — used when the trip/request no longer exists. */
export async function brandOgImage(): Promise<Response> {
  return renderWithFallback(
    () => (
      <Frame>
        <div style={{ display: "flex", fontSize: 120, color: SIGN_FG }}>
          {t("app_name")}
        </div>
        <RtlLine text={t("app_tagline")} fontSize={44} color={PLATE} />
      </Frame>
    ),
    latinCard(),
  );
}
