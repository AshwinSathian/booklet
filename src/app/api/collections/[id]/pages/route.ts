import { updatePageRecord } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getOwnedCollection } from "@/server/collections";
import { getOwnedPage } from "@/server/pages";
import { toErrorResponse } from "@/server/errors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function readPageId(req: Request): Promise<string | null> {
  try {
    const body = (await req.json()) as { pageId?: unknown };
    return typeof body.pageId === "string" && body.pageId.trim() ? body.pageId.trim() : null;
  } catch {
    return null;
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let page;
  try {
    await getOwnedCollection(id, userId);
    const pageId = await readPageId(req);
    if (!pageId) return NextResponse.json({ error: "Missing pageId" }, { status: 400 });
    page = await getOwnedPage(pageId, userId);
  } catch (e) {
    return toErrorResponse(e);
  }

  await updatePageRecord(page.id, {
    collection_id: id,
    updated_at: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let page;
  try {
    await getOwnedCollection(id, userId);
    const pageId = await readPageId(req);
    if (!pageId) return NextResponse.json({ error: "Missing pageId" }, { status: 400 });
    page = await getOwnedPage(pageId, userId);
  } catch (e) {
    return toErrorResponse(e);
  }

  if (page.collection_id === id) {
    await updatePageRecord(page.id, {
      collection_id: null,
      updated_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true });
}
