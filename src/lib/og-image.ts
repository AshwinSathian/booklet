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
    <linearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#7c5cfc"/>
      <stop offset="50%" stop-color="#a78bfa"/>
      <stop offset="100%" stop-color="#7c5cfc"/>
    </linearGradient>
    <radialGradient id="glow1" cx="30%" cy="40%" r="50%">
      <stop offset="0%" stop-color="#7c5cfc" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#7c5cfc" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="70%" cy="60%" r="50%">
      <stop offset="0%" stop-color="#a78bfa" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#a78bfa" stop-opacity="0"/>
    </radialGradient>
  </defs>`;

  const background = `
  <rect width="1200" height="630" fill="#000000"/>
  <rect width="1200" height="630" fill="url(#glow1)"/>
  <rect width="1200" height="630" fill="url(#glow2)"/>`;

  // Mark: the "#" glyph — Markdown's own syntax, rendered as the brand mark.
  const logo = `
  <rect x="80" y="80" width="72" height="72" rx="16" fill="#7c5cfc"/>
  <rect x="106.55" y="99.05" width="5.7" height="33.9" rx="2.85" fill="white"/>
  <rect x="119.75" y="99.05" width="5.7" height="33.9" rx="2.85" fill="white"/>
  <rect x="99.05" y="106.55" width="33.9" height="5.7" rx="2.85" fill="white"/>
  <rect x="99.05" y="119.75" width="33.9" height="5.7" rx="2.85" fill="white"/>
  <rect x="126.65" y="100.1" width="5.25" height="5.1" rx="1.5" fill="white" fill-opacity="0.55"/>
  <text x="172" y="130" font-family="system-ui, -apple-system, sans-serif" font-size="36" font-weight="600" fill="#f5f5f7" letter-spacing="-0.5">readable</text>`;

  let content: string;
  if (title) {
    const [line1, line2] = wrapTitle(escXml(title));
    const fontSize = line2 ? 60 : 68;
    const y1 = line2 ? 300 : 330;
    const y2 = y1 + fontSize + 12;
    content = `
  <text x="80" y="${y1}" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="700" fill="#f5f5f7" letter-spacing="-1.5">${line1}</text>
  ${line2 ? `<text x="80" y="${y2}" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="700" fill="url(#heroGrad)" letter-spacing="-1.5">${line2}</text>` : ""}
  <text x="80" y="490" font-family="system-ui, -apple-system, sans-serif" font-size="24" fill="#636366" letter-spacing="-0.2">Shared via Readable</text>`;
  } else {
    content = `
  <text x="80" y="310" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="700" fill="#f5f5f7" letter-spacing="-2">Write in Markdown.</text>
  <text x="80" y="400" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="700" fill="url(#heroGrad)" letter-spacing="-2">Get a page worth sharing.</text>
  <text x="80" y="470" font-family="system-ui, -apple-system, sans-serif" font-size="28" fill="#86868b" letter-spacing="-0.3">Paste markdown. Publish instantly. Share a beautiful link.</text>
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
