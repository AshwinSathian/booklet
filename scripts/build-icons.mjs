// Rebuilds the static icons in public/ from the one mark the app serves at
// /icon (src/app/icon/route.ts), so the browser tab, the PWA manifest and
// the MCP host all show the same thing.
//
//   node scripts/build-icons.mjs
//
// Writes public/favicon.svg, public/favicon.ico (16, 32 and 48 pixels) and
// public/icons/icon-{192,512}.png. Run it after changing the mark.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const route = readFileSync(new URL("src/app/icon/route.ts", root), "utf8");
const svg = /const SVG = `([\s\S]*?)`;/.exec(route)?.[1];
if (!svg) throw new Error("No SVG found in src/app/icon/route.ts");

const browser = await chromium.launch();
async function png(size) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  const buffer = await page.screenshot({ omitBackground: true });
  await page.close();
  return buffer;
}

writeFileSync(new URL("public/favicon.svg", root), `${svg}\n`);
writeFileSync(new URL("public/icons/icon-192.png", root), await png(192));
writeFileSync(new URL("public/icons/icon-512.png", root), await png(512));

// An .ico file is a 6-byte header, one 16-byte entry per image, then the
// images, which may be PNG files as they are.
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(png));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, i) => {
  const entry = 6 + 16 * i;
  header.writeUInt8(size, entry); // width
  header.writeUInt8(size, entry + 1); // height
  header.writeUInt16LE(1, entry + 4); // colour planes
  header.writeUInt16LE(32, entry + 6); // bits per pixel
  header.writeUInt32LE(images[i].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += images[i].length;
});
writeFileSync(new URL("public/favicon.ico", root), Buffer.concat([header, ...images]));

await browser.close();
console.log("Wrote public/favicon.svg, public/favicon.ico and public/icons/icon-{192,512}.png");
