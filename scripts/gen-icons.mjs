// PWA icon generator — run once: node scripts/gen-icons.mjs
// Renders the route-sign mark (signage-green square, white inner edging like
// .route-sign, Kufi "س") to public/icon-192.png, icon-512.png and
// apple-touch-icon.png. Full-bleed square so the same file works as a
// maskable icon and as the iOS touch icon (both mask it themselves).
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// sharp ships as a transitive dependency — resolve it with require semantics.
const require = createRequire(import.meta.url);
const sharp = require("sharp");

const SIGN_GREEN = "#1d6b47"; // light-token --sign, hex-equivalent
const SIGN_WHITE = "#fbfcfa"; // light-token --sign-foreground

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${SIGN_GREEN}"/>
  <rect x="44" y="44" width="424" height="424" rx="64" fill="none" stroke="${SIGN_WHITE}" stroke-width="14" opacity="0.9"/>
  <text x="264" y="300" text-anchor="middle" font-size="240" font-weight="700"
    font-family="Noto Kufi Arabic, Geeza Pro, Al Bayan, Arial" fill="${SIGN_WHITE}">س</text>
</svg>`;

const out = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));

const base = sharp(Buffer.from(svg), { density: 144 });
for (const [name, size] of [
  ["icon-512.png", 512],
  ["icon-192.png", 192],
  ["apple-touch-icon.png", 180],
]) {
  const png = await base.clone().resize(size, size).png().toBuffer();
  await writeFile(out(name), png);
  console.log(`wrote public/${name} (${size}x${size}, ${png.length} bytes)`);
}
