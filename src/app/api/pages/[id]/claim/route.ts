import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { claimCookieName, claimTokenMatches } from "@/lib/anonymous-claim";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { getSession } from "@/lib/auth/session";
import { createPageRecord, getPageRecord } from "@/lib/db";
import { snapshotPageVersion } from "@/lib/db/versions";
import { extractDocTitle } from "@/lib/doc-title";
import { GONE_MESSAGES } from "@/lib/gone-notice";
import { logError } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { clearDocExpiry, getDoc, getDocState } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Hands a page that was published without an account to the signed-in
 * user, so it stops expiring. Requires the claim cookie set in the
 * publisher's browser at publish time — see src/lib/anonymous-claim.ts.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // State-changing and cookie-authenticated: same Origin check as the other
  // session endpoints.
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const userId = (await getSession())?.userId ?? null;
    if (!userId) {
      return NextResponse.json({ error: "Sign in to keep this page." }, { status: 401 });
    }

    const rl = await checkRateLimit(`claim__${userId}`, 20);
    if (rl) return rl;

    const { id } = await params;
    const state = await getDocState(id);
    if (!state) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }
    if (state.takenDownAt) {
      return NextResponse.json({ error: GONE_MESSAGES.taken_down }, { status: 410 });
    }
    if (await getPageRecord(id)) {
      return NextResponse.json({ error: "This page already belongs to an account." }, { status: 409 });
    }

    const cookieName = claimCookieName(id);
    const token = (await cookies()).get(cookieName)?.value;
    if (!(await claimTokenMatches(token, state.claimTokenHash))) {
      return NextResponse.json(
        { error: "This page can only be claimed from the browser that published it." },
        { status: 403 },
      );
    }

    const doc = await getDoc(id);
    if (!doc) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    try {
      // `pages._id` is unique, so of two racing claims exactly one insert
      // succeeds — that insert is the ownership decision.
      await createPageRecord(id, userId, extractDocTitle(doc.blocks));
    } catch (e) {
      if (typeof e === "object" && e !== null && "code" in e && e.code === 11000) {
        return NextResponse.json({ error: "This page already belongs to an account." }, { status: 409 });
      }
      throw e;
    }
    await clearDocExpiry(id);
    void snapshotPageVersion(id, doc).catch((err) => logError("claim", "Version snapshot failed", err));

    const res = NextResponse.json({ ok: true, id });
    res.cookies.set(cookieName, "", { path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    logError("claim", "Unhandled error", e);
    return NextResponse.json({ error: "Could not claim this page. Try again." }, { status: 500 });
  }
}
