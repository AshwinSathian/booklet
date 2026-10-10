import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSiteOrigin } from "@/lib/site-url";
import { exportPagesZip } from "@/server/account";

export const runtime = "nodejs";

/** Downloads every page the signed-in user owns as a ZIP of Markdown files. */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const limited = await checkRateLimit(`export__${session.userId}`, 3);
  if (limited) return limited;

  const zip = await exportPagesZip(session.userId, getSiteOrigin(req));
  return new Response(new Uint8Array(zip), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="booklet-pages-${new Date().toISOString().slice(0, 10)}.zip"`,
      "cache-control": "no-store",
    },
  });
}
