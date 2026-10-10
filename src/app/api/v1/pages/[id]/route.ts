import { assertVerified } from "@/server/verification";
import type { PublishedDoc } from "@/lib/blocks";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { BLOCKS } from "@/lib/constants";
import { updatePageRecord, deletePageRecord, deletePageAssociatedRecords } from "@/lib/db";
import { deletePageVersions, snapshotPageVersion } from "@/lib/db/versions";
import { recordPublishEvent } from "@/lib/db/publish-events";
import { parseToBlocks } from "@/lib/parse";
import { stripWikilinksFromBlocks } from "@/lib/wikilinks/strip";
import { validateBlocks } from "@/lib/block-schema";
import { collectRichBlockKinds } from "@/lib/block-usage";
import { getDoc, putDoc, deleteDoc } from "@/lib/storage";
import { ROUTES } from "@/lib/constants";
import { logError } from "@/lib/logger";
import {
  getOwnedPage,
  getOwnedPageByIdOrSlug,
  assertNotTakenDown,
  assertRawWithinLimit,
  assertSlugAvailable,
  assertStoredWithinLimit,
  assertIfMatch,
  ifNoneMatchHits,
  pageEtag,
} from "@/server/pages";
import { problem } from "@/server/errors";
import { v1 } from "@/server/v1";
import { getSiteOrigin } from "@/lib/site-url";
import { resolveApiClientSource } from "@/lib/request-source";
import { GONE_MESSAGES } from "@/lib/gone-notice";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContentPayload = {
  raw?: string;
  settings?: PublishedDoc["settings"];
};

type MetadataPayload = {
  slug?: string | null;
  visibility?: "public" | "unlisted";
};

type PatchPayload = ContentPayload & MetadataPayload;

type Ctx = { params: Promise<{ id: string }> };

// ─── GET: read page metadata + raw content ────────────────────────────────────

export const GET = v1("page_get", 120, "pages:read", async (req: Request, userId: string, { params }: Ctx) => {

  const { id } = await params;
  if (!id?.trim()) {
    return problem(400, "Missing page id");
  }

  // Accept both page ID and custom slug
  const record = await getOwnedPageByIdOrSlug(id, userId);

  // A taken-down page is not served over the API either. (Its owner can
  // still read their own source in the dashboard; nothing is deleted.
  // Expiry never applies here: this route only serves pages with an owner.)
  if (record.taken_down_at) {
    return problem(410, GONE_MESSAGES.taken_down);
  }

  const etag = pageEtag(record);
  if (ifNoneMatchHits(req, record)) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  const doc = await getDoc(record.id);

  const url = `${getSiteOrigin(req)}${ROUTES.publish(record.slug ?? record.id)}`;

  return NextResponse.json({
    id: record.id,
    title: record.title ?? null,
    slug: record.slug ?? null,
    visibility: record.visibility,
    view_count: record.view_count,
    url,
    created_at: record.created_at,
    updated_at: record.updated_at,
    raw: doc?.raw ?? null,
  }, { headers: { ETag: etag } });
});

// ─── PATCH: update content, slug, or visibility ───────────────────────────────

export const PATCH = v1("patch", 60, "pages:write", async (req: Request, userId: string, { params }: Ctx) => {
  await assertVerified(userId);

  const { id } = await params;
  if (!id?.trim()) {
    return problem(400, "Missing page id");
  }

  const record = await getOwnedPage(id, userId);
  assertNotTakenDown(record);
  assertIfMatch(req, record);

  let payload: PatchPayload | null = null;
  try {
    payload = (await req.json()) as PatchPayload;
  } catch {
    return problem(400, "Invalid JSON");
  }

  const hasContent = Boolean(payload?.raw && typeof payload.raw === "string" && payload.raw.trim());
  const hasMetadata = payload !== null && ("slug" in payload || "visibility" in payload);

  if (!hasContent && !hasMetadata) {
    return problem(400, "Provide `raw`, `slug`, or `visibility`.");
  }

  const metaPatch: Parameters<typeof updatePageRecord>[1] = {};

  if (hasMetadata && payload) {
    if ("slug" in payload) {
      const rawSlug = payload.slug;
      const slug = rawSlug === null ? null : rawSlug?.trim().toLowerCase() ?? null;
      if (slug !== null) {
        await assertSlugAvailable(slug, id);
      }
      metaPatch.slug = slug;
    }
    if ("visibility" in payload) {
      if (payload.visibility !== "public" && payload.visibility !== "unlisted") {
        return problem(422, "visibility must be 'public' or 'unlisted'");
      }
      metaPatch.visibility = payload.visibility;
    }
  }

  if (hasContent && payload?.raw) {
    assertRawWithinLimit(payload.raw);

    // `blocks` is always derived server-side from `raw` — see
    // src/lib/block-schema.ts's header for why a client-supplied block tree
    // is no longer accepted.
    // See src/lib/blocks.ts's `Inline` doc comment: wikilinks are private
    // and drafting-time-only, stripped to plain text before storage.
    const blocks = stripWikilinksFromBlocks(parseToBlocks(payload.raw));
    if (!blocks.length) {
      return problem(400, "Nothing to publish — the document is empty.");
    }

    const blocksError = validateBlocks(blocks);
    if (blocksError) {
      logError("v1/pages", "Parser produced an invalid block shape", new Error(blocksError));
      return problem(500, "Failed to parse document. Please report this.");
    }

    assertStoredWithinLimit(blocks, payload.raw);

    const doc: PublishedDoc = {
      v: BLOCKS.version,
      createdAt: record.created_at,
      settings: payload.settings ?? DEFAULT_SETTINGS,
      blocks,
      raw: payload.raw,
    };

    try {
      await putDoc(id, doc);
      void snapshotPageVersion(id, doc).catch((err) => {
        logError("v1/pages", "Version snapshot failed", err);
      });
    } catch (e: unknown) {
      // Don't forward e.message to the client — size is already validated
      // above, so anything reaching here is an unexpected DB/driver
      // failure that could carry internal details (hosts, connection info).
      logError("v1/pages", "Update failed", e);
      return problem(500, "Update failed");
    }

    void recordPublishEvent({
      userId,
      pageId: id,
      isUpdate: true,
      contentLength: payload.raw.length,
      richBlockKinds: collectRichBlockKinds(blocks),
      source: resolveApiClientSource(req),
    }).catch((err) => logError("v1/pages", "Event record failed", err));

    metaPatch.updated_at = new Date().toISOString();
  }

  if (Object.keys(metaPatch).length > 0) {
    try {
      await updatePageRecord(id, metaPatch);
    } catch (dbErr) {
      logError("v1/pages", "DB patch write failed", dbErr);
    }
  }

  const effectiveSlug = "slug" in metaPatch ? metaPatch.slug : record.slug;
  const url = `${getSiteOrigin(req)}/p/${effectiveSlug ?? id}`;

  return NextResponse.json({
    id,
    url,
    ...(metaPatch.updated_at ? { updated_at: metaPatch.updated_at } : {}),
  }, { headers: { ETag: pageEtag({ ...record, ...metaPatch }) } });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

export const DELETE = v1("delete", 60, "pages:write", async (req: Request, userId: string, { params }: Ctx) => {

  const { id } = await params;
  if (!id?.trim()) {
    return problem(400, "Missing page id");
  }

  // Deleting would free the slug for a fresh copy at the same URL and
  // destroy the record of what was taken down.
  const record = await getOwnedPage(id, userId);
  assertNotTakenDown(record);
  assertIfMatch(req, record);

  try {
    await deleteDoc(id);
  } catch (e: unknown) {
    logError("v1/pages", "Delete failed", e);
    return problem(500, "Delete failed");
  }

  try {
    await deletePageRecord(id);
    await deletePageVersions(id);
    await deletePageAssociatedRecords(id);
  } catch (dbErr) {
    logError("v1/pages", "DB delete failed", dbErr);
  }

  return NextResponse.json({ ok: true });
});
