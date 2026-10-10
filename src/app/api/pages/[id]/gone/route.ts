import { getGoneReason } from "@/server/page-gone";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Whether a page must answer 410: `{ gone: "taken_down" | "expired" | null }`.
 *
 * Exists for src/middleware.ts. A Server Component cannot set a 410 status
 * (only 404 via notFound()), and the middleware runs on the Edge runtime
 * where the MongoDB driver is unavailable — so the middleware asks this
 * route. It reveals nothing the share page's own status code doesn't.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json({ gone: await getGoneReason(id) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    logError("pages/gone", "Gone check failed", e);
    return NextResponse.json({ gone: null }, { status: 500 });
  }
}
