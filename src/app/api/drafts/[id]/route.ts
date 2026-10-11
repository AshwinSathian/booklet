import { STORAGE } from "@/lib/constants";
import {
  deleteDraftRecord,
  getDraftRecord,
  upsertDraftRecord,
} from "@/lib/db/drafts";
import { coerceDraftDoc } from "@/lib/drafts/coerce";
import { logError } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";
import { problem } from "@/server/errors";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) {
    return problem(401, "Unauthorized");
  }

  const { id } = await params;
  if (!id?.trim()) {
    return problem(400, "Missing draft id");
  }

  const record = await getDraftRecord(id);
  if (!record) {
    return problem(404, "Draft not found");
  }
  if (record.user_id !== userId) {
    return problem(403, "Forbidden");
  }

  const { user_id: _uid, ...draft } = record;
  return NextResponse.json({ draft });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) {
    return problem(401, "Unauthorized");
  }

  // Keyed by userId, not IP — every caller here is authenticated, and this
  // endpoint is hit by debounced background autosave-style syncs rather
  // than one-off user actions, so it gets a generous but still bounded cap.
  const rl = await checkRateLimit(`drafts_put__${userId}`, 60).catch(() => null);
  if (rl) return rl;

  const { id } = await params;
  if (!id?.trim()) {
    return problem(400, "Missing draft id");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return problem(400, "Invalid JSON");
  }

  const draft = coerceDraftDoc(body);
  if (!draft || draft.id !== id) {
    return problem(422, "Invalid draft payload");
  }

  try {
    const bytes = new TextEncoder().encode(JSON.stringify(draft));
    if (bytes.byteLength > STORAGE.maxDocBytes) {
      return problem(413, "Draft is too large to sync.");
    }
  } catch {
    return problem(400, "Invalid payload");
  }

  // Ownership check before upsert — same 403 pattern as pages'
  // `record.user_id !== userId` guard (src/app/api/pages/[id]/route.ts).
  const existing = await getDraftRecord(id);
  if (existing && existing.user_id !== userId) {
    return problem(403, "Forbidden");
  }

  try {
    await upsertDraftRecord(id, userId, draft);
  } catch (e: unknown) {
    logError("drafts-sync", "Upsert failed", e);
    const msg = e instanceof Error ? e.message : "Failed to sync draft";
    return problem(500, msg);
  }

  return NextResponse.json({ id, updatedAt: draft.updatedAt });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) {
    return problem(401, "Unauthorized");
  }

  const rl = await checkRateLimit(`drafts_delete__${userId}`, 60).catch(() => null);
  if (rl) return rl;

  const { id } = await params;
  if (!id?.trim()) {
    return problem(400, "Missing draft id");
  }

  const record = await getDraftRecord(id);
  if (!record) {
    // Already gone (or never synced) — deletion is idempotent from the
    // client's perspective.
    return new NextResponse(null, { status: 204 });
  }
  if (record.user_id !== userId) {
    return problem(403, "Forbidden");
  }

  try {
    await deleteDraftRecord(id, userId);
  } catch (e: unknown) {
    logError("drafts-sync", "Delete failed", e);
    const msg = e instanceof Error ? e.message : "Failed to delete draft";
    return problem(500, msg);
  }

  return new NextResponse(null, { status: 204 });
}
