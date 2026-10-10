import { getD1 } from "@/lib/d1";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness for the external uptime monitor and scripts/health-check.sh.
 * Pings the database, because "the process answers" is not "the site
 * works": with MongoDB down the static home page still returns 200 while
 * every share page returns 500.
 */
export async function GET() {
  try {
    // The driver waits 30 s for a server by default — far longer than a
    // monitor's probe timeout. Fail in 3 s instead.
    await Promise.race([
      getD1().prepare("SELECT 1").first(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Database ping timed out after 3s")), 3000)),
    ]);
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    logError("health", "Database ping failed", e);
    return NextResponse.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
