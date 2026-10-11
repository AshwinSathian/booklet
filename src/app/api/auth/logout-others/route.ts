import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { destroyOtherSessions, getSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { problem } from "@/server/errors";

export const runtime = "nodejs";

/** Signs the user out of every browser but this one. Connected apps and API keys are left as they are. */
export async function POST(req: Request) {
  if (!isSameOriginRequest(req) || !req.headers.get("origin")) {
    return problem(403, "Invalid request origin");
  }
  const session = await getSession();
  if (!session) return problem(401, "Not signed in");
  const limited = await checkRateLimit(`logout_others__${session.userId}`, 10);
  if (limited) return limited;

  return NextResponse.json({ ok: true, signed_out: await destroyOtherSessions(session.userId) });
}
