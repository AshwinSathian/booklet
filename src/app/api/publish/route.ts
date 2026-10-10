import { TURNSTILE_FAILED, verifyTurnstile } from "@/lib/turnstile";
import { unverifiedResponse } from "@/server/verification";
import type { PublishedDoc } from "@/lib/blocks";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { BLOCKS, ROUTES, STORAGE } from "@/lib/constants";
import { createPageRecord } from "@/lib/db";
import { createId } from "@/lib/id";
import { extractDocTitle } from "@/lib/doc-title";
import { snapshotPageVersion } from "@/lib/db/versions";
import { recordPublishEvent } from "@/lib/db/publish-events";
import { parseToBlocks } from "@/lib/parse";
import { stripWikilinksFromBlocks } from "@/lib/wikilinks/strip";
import { stripFrontmatter } from "@/lib/frontmatter";
import { putDoc } from "@/lib/storage";
import { validateBlocks } from "@/lib/block-schema";
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
import { assertRawWithinLimit } from "@/server/pages";
import { toErrorResponse } from "@/server/errors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PublishPayload = {
  raw: string;
  settings?: PublishedDoc["settings"];
  /** Signed-in publishes only. Anything other than "public" means unlisted. */
  visibility?: unknown;
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
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!isAuthenticated && !(await verifyTurnstile(req, payload?.turnstile_token))) {
      return NextResponse.json({ error: TURNSTILE_FAILED }, { status: 403 });
    }

    if (!payload?.raw || typeof payload.raw !== "string" || !payload.raw.trim()) {
      return NextResponse.json({ error: "Nothing to publish — provide `raw` markdown." }, { status: 400 });
    }

    try {
      assertRawWithinLimit(payload.raw);
    } catch (e) {
      return toErrorResponse(e);
    }

    // `blocks` is always derived server-side from `raw` — a client can no
    // longer submit a pre-built block tree directly (see block-schema.ts's
    // header for why: an unvalidated client-supplied tree was a
    // stack-overflow DoS vector, reachable here without even
    // authentication). validateBlocks() below is a defensive invariant
    // check on parseToBlocks' *own* output, not a client trust boundary.
    //
    // The editor's `raw` textarea deliberately keeps any frontmatter block
    // visible for editing (see stripFrontmatter's own doc comment) — it's
    // not part of the rendered document, so it's stripped here the same way
    // the client used to strip it before computing `blocks` itself.
    // Wikilinks (`[[...]]`) are a private, drafting-time-only concept (see
    // src/lib/blocks.ts's `Inline` doc comment) — stripped to plain text
    // before this ever reaches validateBlocks/storage, so a published page
    // never carries the private-linking concept.
    const blocks = stripWikilinksFromBlocks(parseToBlocks(stripFrontmatter(payload.raw)));
    if (!blocks.length) {
      return NextResponse.json({ error: "Nothing to publish" }, { status: 400 });
    }

    const blocksError = validateBlocks(blocks);
    if (blocksError) {
      logError("publish", "Parser produced an invalid block shape", new Error(blocksError));
      return NextResponse.json({ error: "Failed to parse document. Please report this." }, { status: 500 });
    }

    // Measures the actual stored shape (parsed blocks + raw), not just the
    // incoming payload — blocks are now always server-derived, and their
    // JSON can be larger than the source markdown that produced them.
    try {
      const bytes = new TextEncoder().encode(JSON.stringify({ blocks, raw: payload.raw }));
      if (bytes.byteLength > STORAGE.maxDocBytes) {
        return NextResponse.json(
          { error: "Document is too large to publish." },
          { status: 413 },
        );
      }
    } catch {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

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

    const id = createId(10);
    const doc: PublishedDoc = {
      v: BLOCKS.version,
      createdAt: new Date().toISOString(),
      settings: payload.settings ?? DEFAULT_SETTINGS,
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
      return NextResponse.json({ error: "Publish failed" }, { status: 500 });
    }

    void recordPublishEvent({
      userId: userId ?? null,
      pageId: id,
      isUpdate: false,
      contentLength: payload.raw.length,
      richBlockKinds: collectRichBlockKinds(blocks),
      source: "browser",
    }).catch((err) => logError("publish", "Event record failed", err));

    if (isAuthenticated && userId) {
      try {
        const title = extractDocTitle(blocks);
        await createPageRecord(
          id,
          userId,
          title,
          null,
          null,
          payload.visibility === "public" ? "public" : "unlisted",
        );
        void snapshotPageVersion(id, doc).catch((err) => {
          logError("publish", "Version snapshot failed", err);
        });
        void deliverWebhooks(userId, "page.published", {
          page_id: id,
          page_url: `${getSiteOrigin(req)}/p/${id}`,
          title,
          published_at: doc.createdAt,
        }).catch(() => {});
      } catch (dbErr) {
        logError("publish", "DB ownership write failed", dbErr);
      }
    }

    const publishedUrl = `${getSiteOrigin(req)}${ROUTES.publish(id)}`;

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
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
