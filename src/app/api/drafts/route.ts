import { getDraftsByUser } from "@/lib/db/drafts";
import { getSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * List the signed-in user's cloud drafts — metadata only (id/title/
 * timestamps), never full content. Consumed by src/lib/drafts/cloud-sync.ts's
 * pullCloudDrafts() reconciliation on app load.
 */
export async function GET() {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const drafts = await getDraftsByUser(userId);
  return NextResponse.json({ drafts });
}
