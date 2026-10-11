import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { getSession } from "@/lib/auth/session";
import { disconnectApp } from "@/lib/oauth/server";
import { problem } from "@/server/errors";

export const runtime = "nodejs";

/** Disconnects one app: every token it holds for the signed-in user stops working. */
export async function DELETE(req: Request) {
  if (!isSameOriginRequest(req) || !req.headers.get("origin")) {
    return problem(403, "Invalid request origin");
  }
  const session = await getSession();
  if (!session) return problem(401, "Not signed in");

  const body = (await req.json().catch(() => null)) as { client_id?: unknown } | null;
  if (typeof body?.client_id !== "string" || !body.client_id || body.client_id.length > 2000) {
    return problem(400, "Invalid request");
  }
  await disconnectApp(session.userId, body.client_id);
  return NextResponse.json({ ok: true });
}
