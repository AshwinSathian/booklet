import { getDraftsByUser } from "@/lib/db/drafts";
import { getSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";
import { problem } from "@/server/errors";

export const runtime = "nodejs";

/**
 * List the signed-in user's cloud drafts — metadata only (id/title/
 * timestamps), never full content. Consumed by src/lib/drafts/cloud-sync.ts's
 * pullCloudDrafts() reconciliation on app load.
 */
export async function GET() {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) {
    return problem(401, "Unauthorized");
  }

  const drafts = await getDraftsByUser(userId);
  return NextResponse.json({ drafts });
}
