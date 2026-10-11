function escXml(s: string): string {
  // Control characters are not allowed in XML at all, escaped or not.
  return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrapTitle(title: string): [string, string | null] {
  const t = title.length > 52 ? title.slice(0, 51).trimEnd() + "…" : title;
  if (t.length <= 32) return [t, null];
  const mid = Math.floor(t.length / 2);
  let split = t.lastIndexOf(" ", mid);
  if (split <= 0) split = t.indexOf(" ", mid);
  if (split <= 0) return [t.slice(0, 32) + "…", null];
  return [t.slice(0, split), t.slice(split + 1)];
}

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "system-ui, -apple-system, sans-serif";
const INK = "#16150f";
const PAPER = "#fbfaf7";
const MARKER = "#ffd84d";

/**
 * The link-preview image as SVG: paper, ink, a serif headline. It is drawn
 * to a PNG by src/app/og/[...key]/route.ts, because no chat app or social
 * network shows an SVG preview. The server that draws it has no web fonts,
 * so the headline names Georgia, which it has or replaces with a serif.
 */
export function buildOgSvg(title?: string, kicker?: string, footer = "Published with Booklet"): string {
  // Mark: an ink tile, a paper page with a folded corner, one highlighted line.
  const logo = `
  <rect x="80" y="72" width="64" height="64" rx="14" fill="${INK}"/>
  <path d="M97.3 89.3C97.3 87.1 99.1 85.3 101.3 85.3H120.5L126.7 91.5V118.7C126.7 120.9 124.9 122.7 122.7 122.7H101.3C99.1 122.7 97.3 120.9 97.3 118.7V89.3Z" fill="${PAPER}"/>
  <rect x="103.2" y="96.6" width="18.4" height="6" rx="1" fill="${MARKER}"/>
  <rect x="103.2" y="106.6" width="12.3" height="3" rx="1.5" fill="${INK}" fill-opacity="0.32"/>
  <text x="160" y="116" font-family="${SERIF}" font-size="34" font-weight="700" fill="${INK}">Booklet</text>`;

  let content: string;
  if (title) {
    // Cut to length first, escape after: cutting escaped text can split an entity, which is not XML.
    const [line1, line2] = wrapTitle(title.replace(/\s+/g, " ").trim()).map((line) => (line === null ? null : escXml(line)));
    const fontSize = line2 ? 64 : 72;
    const y1 = line2 ? 310 : 350;
    const y2 = y1 + fontSize + 14;
    content = `
  ${kicker ? `<text x="80" y="${y1 - fontSize - 22}" font-family="${SANS}" font-size="24" font-weight="600" fill="#66635a" letter-spacing="3">${escXml(kicker.toUpperCase())}</text>` : ""}
  <text x="80" y="${y1}" font-family="${SERIF}" font-size="${fontSize}" fill="${INK}" letter-spacing="-1">${line1}</text>
  ${line2 ? `<text x="80" y="${y2}" font-family="${SERIF}" font-size="${fontSize}" fill="${INK}" letter-spacing="-1">${line2}</text>` : ""}
  <text x="80" y="548" font-family="${SANS}" font-size="24" fill="#66635a">${escXml(footer)}</text>`;
  } else {
    content = `
  <text x="80" y="300" font-family="${SERIF}" font-size="84" fill="${INK}" letter-spacing="-2">Write it in Markdown.</text>
  <rect x="72" y="352" width="760" height="46" fill="${MARKER}"/>
  <text x="80" y="394" font-family="${SERIF}" font-size="84" fill="${INK}" letter-spacing="-2">Publish it as a page.</text>
  <text x="80" y="478" font-family="${SANS}" font-size="28" fill="#45433b">Incident reports, ADRs, RFCs and runbooks, with team spaces.</text>
  <text x="80" y="548" font-family="${SANS}" font-size="22" fill="#66635a">Free · Open source</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PAPER}"/>
  <rect x="0" y="0" width="1200" height="10" fill="${INK}"/>
  ${logo}
  ${content}
</svg>`;
}
