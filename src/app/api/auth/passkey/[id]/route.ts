import { NextResponse } from "next/server";
import { deletePasskey } from "@/lib/db/auth";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { getSession } from "@/lib/auth/session";
import { countSignInMethods } from "@/server/sso";
import { problem } from "@/server/errors";

export const runtime = "nodejs";

/** Removes a passkey from the signed-in account, unless it is the only way left to sign in. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(req) || !req.headers.get("origin")) {
    return problem(403, "Invalid request origin");
  }
  const session = await getSession();
  if (!session) return problem(401, "Not signed in");

  if ((await countSignInMethods(session.userId)) <= 1) {
    return problem(409, "This is the only way to sign in to this account. Set a password first.");
  }
  const removed = await deletePasskey((await params).id, session.userId);
  return removed ? NextResponse.json({ ok: true }) : problem(404, "Not found");
}
