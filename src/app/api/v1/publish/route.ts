import type { PublishedDoc } from "@/lib/blocks";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { BLOCKS, ROUTES, STORAGE } from "@/lib/constants";
import { createPageRecord, updatePageRecord } from "@/lib/db";
import { createId } from "@/lib/id";
import { resolveApiKey } from "@/lib/api-key-auth";
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
import { checkRateLimit } from "@/lib/rate-limit";
import { assertSlugAvailable } from "@/server/pages";
import { toErrorResponse } from "@/server/errors";
import { getSiteOrigin } from "@/lib/site-url";
import { resolveApiClientSource } from "@/lib/request-source";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PublishPayload = {
  raw?: string;
  settings?: PublishedDoc["settings"];
};

export async function POST(req: Request) {
  const userId = await resolveApiKey(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`v1__publish__${userId}`, 60);
  if (rl) return rl;

  let payload: PublishPayload | null = null;
  try {
    payload = (await req.json()) as PublishPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload?.raw || typeof payload.raw !== "string" || !payload.raw.trim()) {
    return NextResponse.json({ error: "Nothing to publish — provide `raw` markdown." }, { status: 400 });
  }

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
    return NextResponse.json({ error: "Nothing to publish — the document is empty." }, { status: 400 });
  }

  const blocksError = validateBlocks(blocks);
  if (blocksError) {
    logError("v1/publish", "Parser produced an invalid block shape", new Error(blocksError));
    return NextResponse.json({ error: "Failed to parse document. Please report this." }, { status: 500 });
  }

  const fm = frontmatterMeta as import("@/lib/frontmatter").FrontmatterMeta;

  // Validate + collision-check a frontmatter-supplied slug up front, before
  // any writes happen — unlike the UI PATCH path (api/pages/[id]/route.ts),
  // this previously applied fm.slug with no validation or feedback at all.
  let normalizedSlug: string | null = null;
  if (fm.slug) {
    normalizedSlug = fm.slug.trim().toLowerCase();
    try {
      await assertSlugAvailable(normalizedSlug, null);
    } catch (e) {
      return toErrorResponse(e);
    }
  }

  try {
    const bytes = new TextEncoder().encode(JSON.stringify({ blocks, raw: body }));
    if (bytes.byteLength > STORAGE.maxDocBytes) {
      return NextResponse.json({ error: "Document too large." }, { status: 413 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const id = createId(10);
  const doc: PublishedDoc = {
    v: BLOCKS.version,
    createdAt: new Date().toISOString(),
    settings: settings ?? DEFAULT_SETTINGS,
    blocks,
    raw: body.slice(0, STORAGE.maxInputChars),
  };

  try {
    await putDoc(id, doc);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Publish failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  void recordPublishEvent({
    userId,
    pageId: id,
    isUpdate: false,
    contentLength: body.length,
    richBlockKinds: collectRichBlockKinds(blocks),
    source: resolveApiClientSource(req),
  }).catch((err) => logError("v1/publish", "Event record failed", err));

  try {
    const title = fm.title ?? extractDocTitle(blocks);
    const fmRecord = Object.keys(fm).length > 0 ? (fm as Record<string, unknown>) : null;
    await createPageRecord(id, userId, title, null, fmRecord);

    // Apply frontmatter-derived settings (visibility, slug) — slug was
    // already validated + collision-checked above, before putDoc.
    const postPatch: Parameters<typeof updatePageRecord>[1] = {};
    if (fm.visibility) postPatch.visibility = fm.visibility;
    if (normalizedSlug) postPatch.slug = normalizedSlug;
    if (Object.keys(postPatch).length > 0) {
      await updatePageRecord(id, postPatch).catch((e) => logError("v1/publish", "Patch failed", e));
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

  return NextResponse.json({ id, url }, { status: 201 });
}
