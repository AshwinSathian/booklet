import { NextResponse } from "next/server";
import { buildOgSvg } from "@/lib/og-image";

export const runtime = "edge";

export async function GET(req: Request) {
  const title = new URL(req.url).searchParams.get("title") ?? undefined;
  const cacheControl = title
    ? "public, max-age=3600, s-maxage=86400"
    : "public, max-age=86400, immutable";

  return new NextResponse(buildOgSvg(title), {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": cacheControl,
    },
  });
}
