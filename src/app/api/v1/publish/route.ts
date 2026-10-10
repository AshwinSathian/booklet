import { assertVerified } from "@/server/verification";
import type { PublishedDoc } from "@/lib/blocks";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { BLOCKS, ROUTES } from "@/lib/constants";
import { createPageRecord, updatePageRecord } from "@/lib/db";
import { createId } from "@/lib/id";
import { extractDocTitle } from "@/lib/doc-title";
import { snapshotPageVersion } from "@/lib/db/versions";
import { recordPublishEvent } from "@/lib/db/publish-events";
import { parseFrontmatter } from "@/lib/frontmatter";
import { deliverWebhooks } from "@/lib/webhook-delivery";
import { parseToBlocks } from "@/lib/parse";
import { stripWikilinksFromBlocks } from "@/lib/wikilinks/strip";
import { validateBlocks } from "@/lib/block-schema";
import { collectRichBlockKinds } from "@/lib/block-usage";
import { putDoc } from "@/lib/storage";
import { assertRawWithinLimit, assertSlugAvailable, assertStoredWithinLimit } from "@/server/pages";
import { problem } from "@/server/errors";
import { idempotent } from "@/server/idempotency";
import { v1 } from "@/server/v1";
import { getSiteOrigin } from "@/lib/site-url";
import { resolveApiClientSource } from "@/lib/request-source";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PublishPayload = {
  raw?: string;
  settings?: PublishedDoc["settings"];
  /** Overrides frontmatter `visibility`. Unknown values are ignored. */
  visibility?: unknown;
};

export const POST = v1("publish", 60, "pages:write", async (req: Request, userId: string) => {
  await assertVerified(userId);
  const bodyText = await req.text();
  return idempotent(req, userId, bodyText, () => publish(req, userId, bodyText));
});

async function publish(req: Request, userId: string, bodyText: string): Promise<Response> {
  let payload: PublishPayload | null = null;
  try {
    payload = JSON.parse(bodyText) as PublishPayload;
  } catch {
    return problem(400, "Invalid JSON");
  }

  if (!payload?.raw || typeof payload.raw !== "string" || !payload.raw.trim()) {
    return problem(400, "Nothing to publish — provide `raw` markdown.");
  }

  assertRawWithinLimit(payload.raw);

  // Extract frontmatter metadata before parsing.
  const { meta: frontmatterMeta, body } = parseFrontmatter(payload.raw);
  const settings = payload.settings;

  // `blocks` is always derived server-side from `raw` — submitting a
  // pre-built block tree directly (formerly documented as "Option B" in the
  // API docs) is no longer supported. See src/lib/block-schema.ts's header:
  // an unvalidated client-supplied tree, reachable by any API key holder,
  // was a stack-overflow DoS vector once its recursive consumers (the React
  // renderer, the HTML exporter, the TOC builder) were traced end to end.
  // See src/lib/blocks.ts's `Inline` doc comment: wikilinks are private
  // and drafting-time-only, stripped to plain text before storage.
  const blocks = stripWikilinksFromBlocks(parseToBlocks(body));
  if (!blocks.length) {
    return problem(400, "Nothing to publish — the document is empty.");
  }

  const blocksError = validateBlocks(blocks);
  if (blocksError) {
    logError("v1/publish", "Parser produced an invalid block shape", new Error(blocksError));
    return problem(500, "Failed to parse document. Please report this.");
  }

  const fm = frontmatterMeta as import("@/lib/frontmatter").FrontmatterMeta;

  // Validate + collision-check a frontmatter-supplied slug up front, before
  // any writes happen — unlike the UI PATCH path (api/pages/[id]/route.ts),
  // this previously applied fm.slug with no validation or feedback at all.
  let normalizedSlug: string | null = null;
  if (fm.slug) {
    normalizedSlug = fm.slug.trim().toLowerCase();
    await assertSlugAvailable(normalizedSlug, null);
  }

  assertStoredWithinLimit(blocks, body);

  const id = createId(10);
  const doc: PublishedDoc = {
    v: BLOCKS.version,
    createdAt: new Date().toISOString(),
    settings: settings ?? DEFAULT_SETTINGS,
    blocks,
    raw: body,
  };

  try {
    await putDoc(id, doc);
  } catch (e: unknown) {
    logError("v1/publish", "Publish failed", e);
    return problem(500, "Publish failed");
  }

  void recordPublishEvent({
    userId,
    pageId: id,
    isUpdate: false,
    contentLength: body.length,
    richBlockKinds: collectRichBlockKinds(blocks),
    source: resolveApiClientSource(req),
  }).catch((err) => logError("v1/publish", "Event record failed", err));

  let slugConflict = false;
  try {
    const title = fm.title ?? extractDocTitle(blocks);
    const fmRecord = Object.keys(fm).length > 0 ? (fm as Record<string, unknown>) : null;
    await createPageRecord(id, userId, title, null, fmRecord);

    // Apply frontmatter-derived settings (visibility, slug) — slug was
    // already validated + collision-checked above, before putDoc. That
    // check-then-write isn't atomic though: a concurrent publish can claim
    // the same slug in between, so the write can still legitimately lose to
    // the unique index (E11000). The page always publishes successfully
    // either way (it's reachable at /p/:id regardless) — this only decides
    // whether we tell the caller their requested slug didn't take, instead
    // of silently dropping it.
    const postPatch: Parameters<typeof updatePageRecord>[1] = {};
    const visibility =
      payload.visibility === "public" || payload.visibility === "unlisted" ? payload.visibility : fm.visibility;
    if (visibility) postPatch.visibility = visibility;
    if (normalizedSlug) postPatch.slug = normalizedSlug;
    if (Object.keys(postPatch).length > 0) {
      await updatePageRecord(id, postPatch).catch((e) => {
        logError("v1/publish", "Patch failed", e);
        if (normalizedSlug && typeof e === "object" && e !== null && "code" in e && e.code === 11000) {
          slugConflict = true;
        }
      });
    }

    void snapshotPageVersion(id, doc).catch((err) => {
      logError("v1/publish", "Version snapshot failed", err);
    });
    void deliverWebhooks(userId, "page.published", {
      page_id: id,
      page_url: `${getSiteOrigin(req)}/p/${id}`,
      title,
      published_at: doc.createdAt,
    }).catch(() => {});
  } catch (dbErr) {
    logError("v1/publish", "DB write failed", dbErr);
  }

  const url = `${getSiteOrigin(req)}${ROUTES.publish(id)}`;

  return NextResponse.json(
    {
      id,
      url,
      ...(slugConflict
        ? {
            warning: `The slug "${normalizedSlug}" was claimed by another page between validation and publish; this page published at its default URL instead.`,
          }
        : {}),
    },
    { status: 201 },
  );
}
