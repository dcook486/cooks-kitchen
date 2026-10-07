// One-off generator for PWA / Apple touch icons from the vector brand mark.
// Usage: node scripts/generate-pwa-icons.mjs
// Uses `sharp`, which ships with Next.js (no extra dependency is added to package.json).
import sharp from "sharp";
import { readFile } from "node:fs/promises";

const BG = "#f8f7f4"; // --bg in app-brand.css
const markSvg = await readFile(new URL("../public/cooks-kitchen-mark.svg", import.meta.url));

async function renderMark(size) {
  return sharp(markSvg, { density: Math.ceil((size / 180) * 72 * 2) }).resize(size, size).png().toBuffer();
}

async function iconOnBackground(canvas, markScale, out) {
  const markSize = Math.round(canvas * markScale);
  const offset = Math.round((canvas - markSize) / 2);
  await sharp({ create: { width: canvas, height: canvas, channels: 4, background: BG } })
    .composite([{ input: await renderMark(markSize), left: offset, top: offset }])
    .flatten({ background: BG })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log("wrote", out);
}

async function transparentIcon(canvas, markScale, out) {
  const markSize = Math.round(canvas * markScale);
  const offset = Math.round((canvas - markSize) / 2);
  await sharp({ create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await renderMark(markSize), left: offset, top: offset }])
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log("wrote", out);
}

// "any" icons: the round badge on a transparent canvas, small margin.
await transparentIcon(192, 0.96, "public/icons/icon-192.png");
await transparentIcon(512, 0.96, "public/icons/icon-512.png");
// Maskable: opaque brand background, badge kept inside the 80% safe zone.
await iconOnBackground(512, 0.78, "public/icons/icon-maskable-512.png");
// Apple touch icon must be opaque (iOS fills transparency with black).
await iconOnBackground(180, 0.86, "public/icons/apple-touch-icon.png");
