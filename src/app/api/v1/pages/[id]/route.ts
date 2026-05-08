import type { PublishedDoc } from "@/lib/blocks";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { BLOCKS, STORAGE } from "@/lib/constants";
import { getPageBySlug, getPageRecord, updatePageRecord, deletePageRecord } from "@/lib/db";
import { resolveApiKey } from "@/lib/api-key-auth";
import { parseToBlocks } from "@/lib/parse";
import { putDoc, deleteDoc } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Mirrors validation in /api/pages/[id]/route.ts
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$|^[a-z0-9]{1,60}$/;
function isValidSlug(s: string) { return SLUG_RE.test(s) && !s.includes("--"); }

type ContentPayload = {
  blocks?: PublishedDoc["blocks"];
  raw?: string;
  settings?: PublishedDoc["settings"];
};

type MetadataPayload = {
  slug?: string | null;
  visibility?: "public" | "unlisted";
};

type PatchPayload = ContentPayload & MetadataPayload;

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

  const record = await getPageRecord(id);
  if (!record) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }
  if (record.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: PatchPayload | null = null;
  try {
    payload = (await req.json()) as PatchPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hasContent = Boolean(payload?.raw || payload?.blocks?.length);
  const hasMetadata = payload !== null && ("slug" in payload || "visibility" in payload);

  if (!hasContent && !hasMetadata) {
    return NextResponse.json(
      { error: "Provide `raw`, `blocks`, `slug`, or `visibility`." },
      { status: 400 },
    );
  }

  // ── Metadata update (slug / visibility) ──────────────────────────────────
  const metaPatch: Parameters<typeof updatePageRecord>[1] = {};

  if (hasMetadata && payload) {
    if ("slug" in payload) {
      const rawSlug = payload.slug;
      const slug = rawSlug === null ? null : rawSlug?.trim().toLowerCase() ?? null;
      if (slug !== null && !isValidSlug(slug)) {
        return NextResponse.json(
          { error: "Invalid slug. Use 1–60 lowercase letters, numbers, or hyphens." },
          { status: 422 },
        );
      }
      if (slug !== null) {
        const existing = await getPageBySlug(slug);
        if (existing && existing.id !== id) {
          return NextResponse.json({ error: "Slug is already taken." }, { status: 409 });
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

  // ── Content update (blocks / raw) ────────────────────────────────────────
  if (hasContent && payload) {
    if (payload.raw && typeof payload.raw === "string") {
      payload = { ...payload, blocks: parseToBlocks(payload.raw) };
    }

    if (!payload.blocks?.length) {
      return NextResponse.json(
        { error: "Nothing to publish — provide `blocks` or `raw` markdown." },
        { status: 400 },
      );
    }

    try {
      const bytes = new TextEncoder().encode(JSON.stringify(payload));
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
      blocks: payload.blocks,
      ...(payload.raw ? { raw: payload.raw.slice(0, STORAGE.maxInputChars) } : {}),
    };

    try {
      await putDoc(id, doc, true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Update failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    metaPatch.updated_at = new Date().toISOString();
  }

  // Persist metadata changes (includes updated_at from content update)
  if (Object.keys(metaPatch).length > 0) {
    try {
      await updatePageRecord(id, metaPatch);
    } catch (dbErr) {
      console.error("[v1/pages] DB patch write failed:", dbErr);
    }
  }

  // Resolve the effective slug for the URL response
  const effectiveSlug = "slug" in metaPatch ? metaPatch.slug : record.slug;

  const url = new URL(req.url);
  url.pathname = `/p/${effectiveSlug ?? id}`;
  url.search = "";
  url.hash = "";

  return NextResponse.json({
    id,
    url: url.toString(),
    ...(metaPatch.updated_at ? { updated_at: metaPatch.updated_at } : {}),
  });
}

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

  const record = await getPageRecord(id);
  if (!record) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }
  if (record.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await deleteDoc(id);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  try {
    await deletePageRecord(id);
  } catch (dbErr) {
    console.error("[v1/pages] DB delete failed:", dbErr);
  }

  return NextResponse.json({ ok: true });
}
