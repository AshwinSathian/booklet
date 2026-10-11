// Rebuilds the static icons in public/ from the one mark, public/favicon.svg,
// so the browser tab, the home screen, the PWA manifest and the MCP host all
// show the same thing.
//
//   node scripts/build-icons.mjs
//
// Writes public/favicon.ico (16, 32 and 48 pixels), public/icons/icon-{192,512}.png
// and public/icons/apple-touch-icon.png (180 pixels, no transparency: iOS
// paints a transparent corner black). Run it after changing the mark.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
// public/favicon.svg is the mark. Everything else is drawn from it.
const svg = readFileSync(new URL("public/favicon.svg", root), "utf8").trim();

const browser = await chromium.launch();
async function png(size) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  const buffer = await page.screenshot({ omitBackground: true });
  await page.close();
  return buffer;
}

writeFileSync(new URL("public/icons/icon-192.png", root), await png(192));
writeFileSync(new URL("public/icons/icon-512.png", root), await png(512));
// The tile's own ink behind it, so the rounded corners are not transparent.
{
  const page = await browser.newPage({ viewport: { width: 180, height: 180 } });
  await page.setContent(`<style>html,body{margin:0;background:#16150f}svg{display:block;width:180px;height:180px}</style>${svg}`);
  writeFileSync(new URL("public/icons/apple-touch-icon.png", root), await page.screenshot());
  await page.close();
}

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
