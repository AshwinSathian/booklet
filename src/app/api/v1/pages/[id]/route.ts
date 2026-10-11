import { assertVerified } from "@/server/verification";
import type { PublishedDoc } from "@/lib/blocks";
import { resolveSettings } from "@/lib/blocks";
import { BLOCKS } from "@/lib/constants";
import { updatePageRecord, deletePageRecord, deletePageAssociatedRecords, setPageLinks } from "@/lib/db";
import { assertVisibilityAllowed } from "@/server/access";
import { deletePageVersions, snapshotPageVersion } from "@/lib/db/versions";
import { recordPublishEvent } from "@/lib/db/publish-events";
import { deliverWebhooks } from "@/lib/webhook-delivery";
import { collectRichBlockKinds } from "@/lib/block-usage";
import { getDoc, putDoc, deleteDoc } from "@/lib/storage";
import { ROUTES } from "@/lib/constants";
import { logError } from "@/lib/logger";
import {
  getOwnedPage,
  getOwnedPageByIdOrSlug,
  assertNotTakenDown,
  assertSlugAvailable,
  buildDocument,
  relinkPage,
  resolveSpaceMove,
  spaceSlugs,
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
  visibility?: "public" | "unlisted" | "team";
  /** Slug of the team space to move the page into, or null to take it out of its space. */
  space?: string | null;
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
    doc_type: record.doc_type ?? null,
    space: (record.collection_id && (await spaceSlugs([record])).get(record.collection_id)) || null,
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
  const hasMetadata = payload !== null && ("slug" in payload || "visibility" in payload || "space" in payload);

  if (!hasContent && !hasMetadata) {
    return problem(400, "Provide `raw`, `slug`, `visibility` or `space`.");
  }

  const metaPatch: Parameters<typeof updatePageRecord>[1] = {};

  if (payload && "visibility" in payload && payload.visibility !== "public" && payload.visibility !== "unlisted" && payload.visibility !== "team") {
    return problem(422, "visibility must be 'public', 'unlisted' or 'team'");
  }

  // `space` moves the page: a team space's slug, or null for no space. It is
  // settled before visibility, so `{ space, visibility: "team" }` in one
  // request is judged against the space the page is going to.
  let collectionId = record.collection_id;
  if (payload && "space" in payload) {
    if (payload.space !== null && typeof payload.space !== "string") return problem(422, "space must be a team space's slug, or null.");
    collectionId = await resolveSpaceMove(record, payload.space, userId, payload.visibility ?? record.visibility);
    if (collectionId !== record.collection_id) metaPatch.collection_id = collectionId;
  }
  const moved = collectionId !== record.collection_id;

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
      await assertVisibilityAllowed(payload.visibility, collectionId, userId);
      metaPatch.visibility = payload.visibility;
    }
  }

  if (hasContent && payload?.raw) {
    const built = await buildDocument(
      payload.raw,
      { id, userId, collectionId, visibility: metaPatch.visibility ?? record.visibility },
      getSiteOrigin(req),
    );
    const { blocks } = built;

    const doc: PublishedDoc = {
      v: BLOCKS.version,
      createdAt: record.created_at,
      // What the request did not send stays as the author left it: the API, the
      // CLI and the MCP server never send a theme or a typeface.
      settings: resolveSettings(payload.settings, (await getDoc(record.id))?.settings),
      blocks,
      raw: payload.raw,
    };

    try {
      await putDoc(id, doc);
      void setPageLinks(id, built.linkTargetIds).catch((err) => logError("v1/pages", "Link write failed", err));
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
    void deliverWebhooks(userId, "page.updated", {
      page_id: id,
      page_url: `${getSiteOrigin(req)}/p/${id}`,
      title: built.record.title,
      published_at: new Date().toISOString(),
    }).catch(() => {});

    // The title, type and frontmatter fields follow the document.
    Object.assign(metaPatch, built.record, { updated_at: new Date().toISOString() });
  } else if (moved || (metaPatch.visibility && metaPatch.visibility !== record.visibility)) {
    // Before the record changes, so the page is never public while it
    // still carries links only a less visible page may have. A move
    // changes which pages its `[[Title]]`s may point at, too.
    await relinkPage({ ...record, collection_id: collectionId }, metaPatch.visibility ?? record.visibility, getSiteOrigin(req));
    if (!metaPatch.updated_at) metaPatch.updated_at = new Date().toISOString();
  }

  if (Object.keys(metaPatch).length > 0) {
    try {
      await updatePageRecord(id, metaPatch);
    } catch (dbErr) {
      // Not swallowed: a caller told "200" after asking for `team` or
      // `unlisted` would believe a page is restricted when it is not.
      if (typeof dbErr === "object" && dbErr !== null && "code" in dbErr && dbErr.code === 11000) {
        return problem(409, "Slug is already taken.");
      }
      logError("v1/pages", "DB patch write failed", dbErr);
      return problem(500, "Update failed");
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
