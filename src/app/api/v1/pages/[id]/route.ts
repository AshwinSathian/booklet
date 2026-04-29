import type { PublishedDoc } from "@/lib/blocks";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { BLOCKS, STORAGE } from "@/lib/constants";
import { getPageRecord, updatePageRecord } from "@/lib/db";
import { resolveApiKey } from "@/lib/api-key-auth";
import { putDoc } from "@/lib/storage";
import { QuotaExceededError, quotaErrorResponse } from "@/lib/quota";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type UpdatePayload = {
  blocks: PublishedDoc["blocks"];
  settings?: PublishedDoc["settings"];
};

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

  let payload: UpdatePayload | null = null;
  try {
    payload = (await req.json()) as UpdatePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload?.blocks?.length) {
    return NextResponse.json({ error: "Nothing to publish" }, { status: 400 });
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
  };

  try {
    await putDoc(id, doc, true);
  } catch (e: unknown) {
    if (e instanceof QuotaExceededError) return quotaErrorResponse(e);
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const updatedAt = new Date().toISOString();
  try {
    await updatePageRecord(id, { updated_at: updatedAt });
  } catch (dbErr) {
    console.error("[v1/pages] D1 updated_at write failed:", dbErr);
  }

  const url = new URL(req.url);
  url.pathname = `/p/${id}`;
  url.search = "";
  url.hash = "";

  return NextResponse.json({ id, url: url.toString(), updated_at: updatedAt });
}
