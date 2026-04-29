import { NextResponse } from "next/server";

export const runtime = "edge";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <!-- Background -->
  <rect width="512" height="512" rx="112" fill="#0b1020"/>

  <!-- Purple border -->
  <rect x="4" y="4" width="504" height="504" rx="110" fill="none" stroke="#7c5cfc" stroke-width="8"/>

  <!-- R letter -->
  <text x="256" y="340" font-family="system-ui, -apple-system, sans-serif" font-size="280" font-weight="700" fill="#e9ecf2" text-anchor="middle">R</text>

  <!-- Purple accent dot -->
  <circle cx="380" cy="380" r="36" fill="#7c5cfc"/>
</svg>`;

export async function GET() {
  return new NextResponse(SVG, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
