import { NextResponse } from "next/server";
import { deletePasskey } from "@/lib/db/auth";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { getSession } from "@/lib/auth/session";
import { countSignInMethods } from "@/server/sso";

export const runtime = "nodejs";

/** Removes a passkey from the signed-in account, unless it is the only way left to sign in. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(req) || !req.headers.get("origin")) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  if ((await countSignInMethods(session.userId)) <= 1) {
    return NextResponse.json({ error: "This is the only way to sign in to this account. Set a password first." }, { status: 409 });
  }
  const removed = await deletePasskey((await params).id, session.userId);
  return removed ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
