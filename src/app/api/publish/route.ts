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
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PublishPayload = {
  raw: string;
  settings?: PublishedDoc["settings"];
};

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req.headers);

    // Rate limiting is best-effort — a DB failure must not block publish.
    const rl = await checkRateLimit(`publish__ip__${ip}`, 12).catch(() => null);
    if (rl) return rl;

    const userId = (await getSession())?.userId ?? null;
    const isAuthenticated = Boolean(userId);

    let payload: PublishPayload | null = null;
    try {
      payload = (await req.json()) as PublishPayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!payload?.raw || typeof payload.raw !== "string" || !payload.raw.trim()) {
      return NextResponse.json({ error: "Nothing to publish — provide `raw` markdown." }, { status: 400 });
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
      raw: payload.raw.slice(0, STORAGE.maxInputChars),
    };

    try {
      await putDoc(id, doc);
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
        await createPageRecord(id, userId, title);
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

    return NextResponse.json({
      id,
      url: publishedUrl,
      owned: isAuthenticated,
    });
  } catch (e: unknown) {
    logError("publish", "Unhandled error", e);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
