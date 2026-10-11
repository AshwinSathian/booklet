import { TURNSTILE_FAILED, verifyTurnstile } from "@/lib/turnstile";
import { unverifiedResponse } from "@/server/verification";
import type { PublishedDoc } from "@/lib/blocks";
import { resolveSettings } from "@/lib/blocks";
import { BLOCKS, ROUTES } from "@/lib/constants";
import { createPageRecord, setPageLinks } from "@/lib/db";
import { createId } from "@/lib/id";
import { snapshotPageVersion } from "@/lib/db/versions";
import { recordPublishEvent } from "@/lib/db/publish-events";
import { deleteDoc, putDoc } from "@/lib/storage";
import { collectRichBlockKinds } from "@/lib/block-usage";
import { checkRateLimit, checkMonthlyQuota } from "@/lib/rate-limit";
import { ANONYMOUS_LIMITS } from "@/lib/quota";
import { deliverWebhooks } from "@/lib/webhook-delivery";
import { getClientIp } from "@/lib/request-ip";
import { getSiteOrigin } from "@/lib/site-url";
import { logError } from "@/lib/logger";
import { getSession } from "@/lib/auth/session";
import {
  ANONYMOUS_PAGE_TTL_DAYS,
  PURGE_GRACE_DAYS,
  claimCookieName,
  generateClaimToken,
  hashClaimToken,
} from "@/lib/anonymous-claim";
import { assertVisibilityAllowed, getWritableSpace } from "@/server/access";
import { buildDocument, type BuiltDocument } from "@/server/pages";
import { toErrorResponse, problem } from "@/server/errors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PublishPayload = {
  raw: string;
  settings?: PublishedDoc["settings"];
  /** Signed-in publishes only. Anything other than "public" or "team" means unlisted. */
  visibility?: unknown;
  /** Signed-in publishes only: id of a team space to create the page in. */
  space_id?: unknown;
  /** Anonymous publishes only, and only where Turnstile is configured. */
  turnstile_token?: unknown;
};

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req.headers);

    // Rate limiting is best-effort — a DB failure must not block publish.
    const rl = await checkRateLimit(`publish__ip__${ip}`, 12).catch(() => null);
    if (rl) return rl;

    const userId = (await getSession())?.userId ?? null;
    const isAuthenticated = Boolean(userId);
    // A signed-in account with an unconfirmed address is refused here; it
    // does not fall through to an anonymous publish.
    const unverified = userId ? await unverifiedResponse(userId) : null;
    if (unverified) return unverified;

    let payload: PublishPayload | null = null;
    try {
      payload = (await req.json()) as PublishPayload;
    } catch {
      return problem(400, "Invalid JSON");
    }

    if (!isAuthenticated && !(await verifyTurnstile(req, payload?.turnstile_token))) {
      return problem(403, TURNSTILE_FAILED);
    }

    if (!payload?.raw || typeof payload.raw !== "string" || !payload.raw.trim()) {
      return problem(400, "Nothing to publish — provide `raw` markdown.");
    }

    const id = createId(10);
    const origin = getSiteOrigin(req);
    const visibility = payload.visibility === "public" || payload.visibility === "team" ? payload.visibility : "unlisted";

    // The editor keeps any frontmatter block in `raw`; buildDocument reads
    // it and leaves it out of the rendered blocks. A `[[Title]]` that
    // matches one of the author's published pages becomes a link; every
    // other wikilink, and all of them on an anonymous publish, is plain
    // text (see src/server/links.ts).
    let built: BuiltDocument;
    let spaceId: string | null = null;
    try {
      if (userId && payload.space_id !== undefined && payload.space_id !== null) {
        spaceId = (await getWritableSpace({ id: payload.space_id }, userId)).id;
      }
      if (userId) await assertVisibilityAllowed(visibility, spaceId, userId);
      built = await buildDocument(payload.raw, { id, userId, collectionId: spaceId, visibility }, origin);
    } catch (e) {
      return toErrorResponse(e);
    }
    const { blocks } = built;

    // Anonymous publishes have no DB "pages" record and no owner, so they're
    // otherwise unbounded — enforce the advertised anonymous quota here,
    // per-IP, rolling calendar month. Gated on `!isAuthenticated` so a
    // signed-in user publishing from the same browser/IP is never subject to
    // this — no double-penalizing, and no risk of an anonymous burst from
    // that IP earlier in the month blocking their authenticated publish.
    if (!isAuthenticated) {
      const quota = await checkMonthlyQuota(
        `publish__ip__${ip}`,
        ANONYMOUS_LIMITS.pagesPerMonth,
        `You've reached the anonymous publishing limit (${ANONYMOUS_LIMITS.pagesPerMonth} pages per month). Sign in for unlimited publishing.`,
      ).catch(() => null);
      if (quota) return quota;
    }

    const doc: PublishedDoc = {
      v: BLOCKS.version,
      createdAt: new Date().toISOString(),
      settings: resolveSettings(payload.settings),
      blocks,
      raw: payload.raw,
    };

    // No account means no owner record: the page expires unless its author
    // signs in and claims it, and this cookie is what proves authorship
    // then. See src/lib/anonymous-claim.ts.
    const claimToken = isAuthenticated ? null : generateClaimToken();

    try {
      await putDoc(
        id,
        doc,
        claimToken
          ? {
              expiresAt: new Date(Date.now() + ANONYMOUS_PAGE_TTL_DAYS * 86_400_000),
              claimTokenHash: await hashClaimToken(claimToken),
            }
          : undefined,
      );
    } catch (e: unknown) {
      logError("publish", "Publish failed", e);
      return problem(500, "Publish failed");
    }

    if (isAuthenticated && userId) {
      // The record is what makes the page owned and what a team-only page's
      // access check reads; without it the document would be an ownerless
      // page open to anyone with the link. So a failure undoes the publish.
      try {
        await createPageRecord(id, userId, built.record.title, null, built.record.frontmatter_meta, visibility, {
          collectionId: spaceId,
          docType: built.record.doc_type,
        });
      } catch (dbErr) {
        logError("publish", "DB ownership write failed", dbErr);
        await deleteDoc(id).catch(() => {});
        return problem(500, "Publish failed");
      }
      void setPageLinks(id, built.linkTargetIds).catch((err) => logError("publish", "Link write failed", err));
      void snapshotPageVersion(id, doc).catch((err) => {
        logError("publish", "Version snapshot failed", err);
      });
      void deliverWebhooks(userId, "page.published", {
        page_id: id,
        page_url: `${origin}/p/${id}`,
        title: built.record.title,
        published_at: doc.createdAt,
      }).catch(() => {});
    }

    // After the page record: the event also writes the record's `last_source`.
    void recordPublishEvent({
      userId: userId ?? null,
      pageId: id,
      isUpdate: false,
      contentLength: payload.raw.length,
      richBlockKinds: collectRichBlockKinds(blocks),
      source: "browser",
    }).catch((err) => logError("publish", "Event record failed", err));

    const publishedUrl = `${origin}${ROUTES.publish(id)}`;

    const res = NextResponse.json({
      id,
      url: publishedUrl,
      owned: isAuthenticated,
    });
    if (claimToken) {
      res.cookies.set(claimCookieName(id), claimToken, {
        httpOnly: true,
        // Same rule as the session cookie (src/lib/auth/session.ts): Secure
        // whenever the request really arrived over HTTPS via the tunnel.
        secure: req.headers.get("x-forwarded-proto") === "https",
        sameSite: "lax",
        path: "/",
        maxAge: (ANONYMOUS_PAGE_TTL_DAYS + PURGE_GRACE_DAYS) * 86_400,
      });
    }
    return res;
  } catch (e: unknown) {
    logError("publish", "Unhandled error", e);
    return problem(500, "An unexpected error occurred");
  }
}
