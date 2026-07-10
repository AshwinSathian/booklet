import { STORAGE } from "@/lib/constants";
import {
  deleteDraftRecord,
  getDraftRecord,
  upsertDraftRecord,
} from "@/lib/db/drafts";
import { ensureDbUser } from "@/lib/db/ensure-user";
import { coerceDraftDoc } from "@/lib/drafts/migrate";
import { logError } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing draft id" }, { status: 400 });
  }

  const record = await getDraftRecord(id);
  if (!record) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }
  if (record.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { user_id: _uid, ...draft } = record;
  return NextResponse.json({ draft });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Keyed by userId, not IP — every caller here is authenticated, and this
  // endpoint is hit by debounced background autosave-style syncs rather
  // than one-off user actions, so it gets a generous but still bounded cap.
  const rl = await checkRateLimit(`drafts_put__${userId}`, 60).catch(() => null);
  if (rl) return rl;

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing draft id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const draft = coerceDraftDoc(body);
  if (!draft || draft.id !== id) {
    return NextResponse.json({ error: "Invalid draft payload" }, { status: 422 });
  }

  try {
    const bytes = new TextEncoder().encode(JSON.stringify(draft));
    if (bytes.byteLength > STORAGE.maxDocBytes) {
      return NextResponse.json(
        { error: "Draft is too large to sync." },
        { status: 413 },
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Ownership check before upsert — same 403 pattern as pages'
  // `record.user_id !== userId` guard (src/app/api/pages/[id]/route.ts).
  const existing = await getDraftRecord(id);
  if (existing && existing.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await ensureDbUser(userId, null);
    await upsertDraftRecord(id, userId, draft);
  } catch (e: unknown) {
    logError("drafts-sync", "Upsert failed", e);
    const msg = e instanceof Error ? e.message : "Failed to sync draft";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ id, updatedAt: draft.updatedAt });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`drafts_delete__${userId}`, 60).catch(() => null);
  if (rl) return rl;

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing draft id" }, { status: 400 });
  }

  const record = await getDraftRecord(id);
  if (!record) {
    // Already gone (or never synced) — deletion is idempotent from the
    // client's perspective.
    return new NextResponse(null, { status: 204 });
  }
  if (record.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await deleteDraftRecord(id, userId);
  } catch (e: unknown) {
    logError("drafts-sync", "Delete failed", e);
    const msg = e instanceof Error ? e.message : "Failed to delete draft";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
