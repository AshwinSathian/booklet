import { NextResponse } from "next/server";

export const runtime = "edge";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
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
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="#000000"/>
  <rect width="1200" height="630" fill="url(#glow1)"/>
  <rect width="1200" height="630" fill="url(#glow2)"/>

  <!-- Logo mark -->
  <rect x="80" y="80" width="72" height="72" rx="16" fill="#7c5cfc"/>
  <text x="116" y="136" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="700" fill="white" text-anchor="middle">R</text>

  <!-- Wordmark -->
  <text x="172" y="130" font-family="system-ui, -apple-system, sans-serif" font-size="36" font-weight="600" fill="#f5f5f7" letter-spacing="-0.5">readable</text>

  <!-- Main headline -->
  <text x="80" y="310" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="700" fill="#f5f5f7" letter-spacing="-2">Write in Markdown.</text>
  <text x="80" y="400" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="700" fill="url(#heroGrad)" letter-spacing="-2">Get a page worth sharing.</text>

  <!-- Subtitle -->
  <text x="80" y="470" font-family="system-ui, -apple-system, sans-serif" font-size="28" fill="#86868b" letter-spacing="-0.3">Paste markdown. Publish instantly. Share a beautiful link.</text>

  <!-- Pill -->
  <rect x="80" y="512" width="200" height="44" rx="22" fill="#1d1d1f"/>
  <text x="180" y="540" font-family="system-ui, -apple-system, sans-serif" font-size="18" fill="#a1a1a6" text-anchor="middle">Free · No account</text>
</svg>`;

export async function GET() {
  return new NextResponse(SVG, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
