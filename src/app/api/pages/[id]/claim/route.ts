import { unverifiedResponse } from "@/server/verification";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { claimCookieName, claimTokenMatches } from "@/lib/anonymous-claim";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { getSession } from "@/lib/auth/session";
import { createPageRecord, getPageRecord } from "@/lib/db";
import { snapshotPageVersion } from "@/lib/db/versions";
import { parseFrontmatter } from "@/lib/frontmatter";
import { GONE_MESSAGES } from "@/lib/gone-notice";
import { recordFields } from "@/server/pages";
import { logError } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { clearClaimToken, clearDocExpiry, getDoc, getDocState } from "@/lib/storage";
import { problem } from "@/server/errors";

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
    return problem(403, "Forbidden");
  }

  try {
    const userId = (await getSession())?.userId ?? null;
    if (!userId) {
      return problem(401, "Sign in to keep this page.");
    }

    const rl = await checkRateLimit(`claim__${userId}`, 20);
    if (rl) return rl;

    const unverified = await unverifiedResponse(userId);
    if (unverified) return unverified;

    const { id } = await params;
    const state = await getDocState(id);
    if (!state) {
      return problem(404, "Page not found");
    }
    if (state.takenDownAt) {
      return problem(410, GONE_MESSAGES.taken_down);
    }
    if (await getPageRecord(id)) {
      return problem(409, "This page already belongs to an account.");
    }

    const cookieName = claimCookieName(id);
    const token = (await cookies()).get(cookieName)?.value;
    if (!(await claimTokenMatches(token, state.claimTokenHash))) {
      return problem(403, "This page can only be claimed from the browser that published it.");
    }

    const doc = await getDoc(id);
    if (!doc) {
      return problem(404, "Page not found");
    }

    // Expiry is cleared BEFORE the owner record is written. The daily purge
    // deletes a document only while expires_at is still set, so in this
    // order it can never delete a page in the middle of being claimed. If
    // the insert below then fails, the page is left ownerless and
    // non-expiring — recoverable, unlike a deleted document.
    await clearDocExpiry(id);
    try {
      // `pages._id` is unique, so of two racing claims exactly one insert
      // succeeds — that insert is the ownership decision.
      // The document's frontmatter was never stored anywhere but in its
      // Markdown, since there was no record to hold it.
      const record = recordFields(doc.raw ? parseFrontmatter(doc.raw).meta : {}, doc.blocks);
      await createPageRecord(id, userId, record.title, null, record.frontmatter_meta, "unlisted", {
        docType: record.doc_type,
      });
    } catch (e) {
      if (typeof e === "object" && e !== null && "code" in e && e.code === 11000) {
        return problem(409, "This page already belongs to an account.");
      }
      throw e;
    }
    await clearClaimToken(id);
    void snapshotPageVersion(id, doc).catch((err) => logError("claim", "Version snapshot failed", err));

    const res = NextResponse.json({ ok: true, id });
    res.cookies.set(cookieName, "", { path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    logError("claim", "Unhandled error", e);
    return problem(500, "Could not claim this page. Try again.");
  }
}
