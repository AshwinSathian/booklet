import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { getSession } from "@/lib/auth/session";
import { disconnectApp } from "@/lib/oauth/server";

export const runtime = "nodejs";

/** Disconnects one app: every token it holds for the signed-in user stops working. */
export async function DELETE(req: Request) {
  if (!isSameOriginRequest(req) || !req.headers.get("origin")) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { client_id?: unknown } | null;
  if (typeof body?.client_id !== "string" || !body.client_id || body.client_id.length > 2000) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  await disconnectApp(session.userId, body.client_id);
  return NextResponse.json({ ok: true });
}
