import type { PublishedDoc } from "@/lib/blocks";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { BLOCKS, STORAGE } from "@/lib/constants";
import { updatePageRecord, deletePageRecord } from "@/lib/db";
import { deletePageVersions, snapshotPageVersion } from "@/lib/db/versions";
import { recordPublishEvent } from "@/lib/db/publish-events";
import { resolveApiKey } from "@/lib/api-key-auth";
import { parseToBlocks } from "@/lib/parse";
import { validateBlocks } from "@/lib/block-schema";
import { collectRichBlockKinds } from "@/lib/block-usage";
import { getDoc, putDoc, deleteDoc } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rate-limit";
import { ROUTES } from "@/lib/constants";
import { logError } from "@/lib/logger";
import { getOwnedPage, getOwnedPageByIdOrSlug, assertSlugAvailable } from "@/server/pages";
import { toErrorResponse } from "@/server/errors";
import { getSiteOrigin } from "@/lib/site-url";
import { resolveApiClientSource } from "@/lib/request-source";
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

// ─── GET: read page metadata + raw content ────────────────────────────────────

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await resolveApiKey(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`v1__page_get__${userId}`, 120);
  if (rl) return rl;

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing page id" }, { status: 400 });
  }

  // Accept both page ID and custom slug
  let record;
  try {
    record = await getOwnedPageByIdOrSlug(id, userId);
  } catch (e) {
    return toErrorResponse(e);
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
  });
}

// ─── PATCH: update content, slug, or visibility ───────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await resolveApiKey(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`v1__patch__${userId}`, 60);
  if (rl) return rl;

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing page id" }, { status: 400 });
  }

  let record;
  try {
    record = await getOwnedPage(id, userId);
  } catch (e) {
    return toErrorResponse(e);
  }

  let payload: PatchPayload | null = null;
  try {
    payload = (await req.json()) as PatchPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hasContent = Boolean(payload?.raw && typeof payload.raw === "string" && payload.raw.trim());
  const hasMetadata = payload !== null && ("slug" in payload || "visibility" in payload);

  if (!hasContent && !hasMetadata) {
    return NextResponse.json(
      { error: "Provide `raw`, `slug`, or `visibility`." },
      { status: 400 },
    );
  }

  const metaPatch: Parameters<typeof updatePageRecord>[1] = {};

  if (hasMetadata && payload) {
    if ("slug" in payload) {
      const rawSlug = payload.slug;
      const slug = rawSlug === null ? null : rawSlug?.trim().toLowerCase() ?? null;
      if (slug !== null) {
        try {
          await assertSlugAvailable(slug, id);
        } catch (e) {
          return toErrorResponse(e);
        }
      }
      metaPatch.slug = slug;
    }
    if ("visibility" in payload) {
      if (payload.visibility !== "public" && payload.visibility !== "unlisted") {
        return NextResponse.json(
          { error: "visibility must be 'public' or 'unlisted'" },
          { status: 422 },
        );
      }
      metaPatch.visibility = payload.visibility;
    }
  }

  if (hasContent && payload?.raw) {
    // `blocks` is always derived server-side from `raw` — see
    // src/lib/block-schema.ts's header for why a client-supplied block tree
    // is no longer accepted.
    const blocks = parseToBlocks(payload.raw);
    if (!blocks.length) {
      return NextResponse.json(
        { error: "Nothing to publish — the document is empty." },
        { status: 400 },
      );
    }

    const blocksError = validateBlocks(blocks);
    if (blocksError) {
      logError("v1/pages", "Parser produced an invalid block shape", new Error(blocksError));
      return NextResponse.json({ error: "Failed to parse document. Please report this." }, { status: 500 });
    }

    try {
      const bytes = new TextEncoder().encode(JSON.stringify({ blocks, raw: payload.raw }));
      if (bytes.byteLength > STORAGE.maxDocBytes) {
        return NextResponse.json({ error: "Document too large." }, { status: 413 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const doc: PublishedDoc = {
      v: BLOCKS.version,
      createdAt: record.created_at,
      settings: payload.settings ?? DEFAULT_SETTINGS,
      blocks,
      raw: payload.raw.slice(0, STORAGE.maxInputChars),
    };

    try {
      await putDoc(id, doc);
      void snapshotPageVersion(id, doc).catch((err) => {
        logError("v1/pages", "Version snapshot failed", err);
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Update failed";
      return NextResponse.json({ error: msg }, { status: 500 });
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
  });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await resolveApiKey(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`v1__delete__${userId}`, 60);
  if (rl) return rl;

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing page id" }, { status: 400 });
  }

  try {
    await getOwnedPage(id, userId);
  } catch (e) {
    return toErrorResponse(e);
  }

  try {
    await deleteDoc(id);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  try {
    await deletePageRecord(id);
    await deletePageVersions(id);
  } catch (dbErr) {
    logError("v1/pages", "DB delete failed", dbErr);
  }

  return NextResponse.json({ ok: true });
}
