import { NextResponse } from "next/server";
import { getUserById } from "@/lib/db/auth";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { getSession } from "@/lib/auth/session";
import { checkMonthlyQuota, checkRateLimit } from "@/lib/rate-limit";
import { getSiteOrigin } from "@/lib/site-url";
import { sendVerification } from "@/server/verification";

export const runtime = "nodejs";

/** Sends the signed-in user a new verification link. One a minute, 20 a month. */
export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const limited =
    (await checkRateLimit(`verify-send__${session.userId}`, 1)) ??
    (await checkMonthlyQuota(`verify-send__${session.userId}`, 20, "Too many verification emails this month. Contact support if they are not arriving."));
  if (limited) return limited;

  const user = await getUserById(session.userId);
  if (user) await sendVerification(user, getSiteOrigin(req));
  return NextResponse.json({ ok: true });
}
