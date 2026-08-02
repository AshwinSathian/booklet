import { NextResponse } from "next/server";

export const runtime = "edge";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#000000"/>
  <rect x="4" y="4" width="504" height="504" rx="108" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="2"/>
  <path d="M138.7 138.7C138.7 121.0 153.0 106.7 170.7 106.7H324.3L373.3 155.7V373.3C373.3 390.9 359.0 405.3 341.3 405.3H170.7C153.0 405.3 138.7 390.9 138.7 373.3V138.7Z" fill="#f5f5f7"/>
  <path d="M324.3 106.7L373.3 155.7H341.3C332.0 155.7 324.3 148.1 324.3 138.7V106.7Z" fill="#f5a623"/>
  <rect x="185.6" y="204.8" width="147.2" height="32" rx="16" fill="#f5a623" fill-opacity="0.85"/>
  <rect x="185.6" y="268.8" width="98.1" height="32" rx="16" fill="#f5a623" fill-opacity="0.55"/>
</svg>`;

export async function GET() {
  return new NextResponse(SVG, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
