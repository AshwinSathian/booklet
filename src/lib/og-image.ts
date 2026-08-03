function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

export function buildOgSvg(title?: string): string {
  const defs = `<defs>
    <radialGradient id="glow1" cx="30%" cy="40%" r="50%">
      <stop offset="0%" stop-color="#f5a623" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#f5a623" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="70%" cy="60%" r="50%">
      <stop offset="0%" stop-color="#f8c368" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#f8c368" stop-opacity="0"/>
    </radialGradient>
  </defs>`;

  const background = `
  <rect width="1200" height="630" fill="#000000"/>
  <rect width="1200" height="630" fill="url(#glow1)"/>
  <rect width="1200" height="630" fill="url(#glow2)"/>`;

  // Mark: a page with a folded corner — a page worth flagging and keeping.
  const logo = `
  <rect x="80" y="80" width="72" height="72" rx="16" fill="#f5a623"/>
  <path d="M99.50 99.50C99.50 97.01 101.51 95.00 104.00 95.00H125.60L132.50 101.90V132.50C132.50 134.99 130.49 137.00 128.00 137.00H104.00C101.51 137.00 99.50 134.99 99.50 132.50V99.50Z" fill="white"/>
  <path d="M125.60 95.00L132.50 101.90H128.00C126.67 101.90 125.60 100.83 125.60 99.50V95.00Z" fill="rgba(0, 0, 0, 0.18)"/>
  <rect x="106.10" y="108.80" width="20.70" height="4.50" rx="2.25" fill="#f5a623" fill-opacity="0.85"/>
  <rect x="106.10" y="117.80" width="13.80" height="4.50" rx="2.25" fill="#f5a623" fill-opacity="0.55"/>
  <text x="172" y="130" font-family="system-ui, -apple-system, sans-serif" font-size="36" font-weight="600" fill="#f5f5f7" letter-spacing="-0.5">booklet</text>`;

  let content: string;
  if (title) {
    const [line1, line2] = wrapTitle(escXml(title));
    const fontSize = line2 ? 60 : 68;
    const y1 = line2 ? 300 : 330;
    const y2 = y1 + fontSize + 12;
    content = `
  <text x="80" y="${y1}" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="700" fill="#f5f5f7" letter-spacing="-1.5">${line1}</text>
  ${line2 ? `<text x="80" y="${y2}" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="700" fill="#f5a623" letter-spacing="-1.5">${line2}</text>` : ""}
  <text x="80" y="490" font-family="system-ui, -apple-system, sans-serif" font-size="24" fill="#636366" letter-spacing="-0.2">Shared via Booklet</text>`;
  } else {
    content = `
  <text x="80" y="310" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="700" fill="#f5f5f7" letter-spacing="-2">Written in Markdown.</text>
  <text x="80" y="400" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="700" fill="#f5a623" letter-spacing="-2">Read by everyone else.</text>
  <text x="80" y="470" font-family="system-ui, -apple-system, sans-serif" font-size="28" fill="#86868b" letter-spacing="-0.3">Incident reports, ADRs, and runbooks — as a page anyone can read.</text>
  <rect x="80" y="512" width="200" height="44" rx="22" fill="#1d1d1f"/>
  <text x="180" y="540" font-family="system-ui, -apple-system, sans-serif" font-size="18" fill="#a1a1a6" text-anchor="middle">Free · No account</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  ${defs}
  ${background}
  ${logo}
  ${content}
</svg>`;
}
