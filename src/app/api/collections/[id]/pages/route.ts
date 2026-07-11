import {
  getCollectionRecord,
  getPageRecord,
  updatePageRecord,
} from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function requireOwnedCollection(collectionId: string, userId: string) {
  const collection = await getCollectionRecord(collectionId);
  if (!collection) return { error: NextResponse.json({ error: "Collection not found" }, { status: 404 }) };
  if (collection.user_id !== userId) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { collection };
}

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
  const ownedCollection = await requireOwnedCollection(id, userId);
  if ("error" in ownedCollection) return ownedCollection.error;

  const pageId = await readPageId(req);
  if (!pageId) return NextResponse.json({ error: "Missing pageId" }, { status: 400 });

  const page = await getPageRecord(pageId);
  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });
  if (page.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await updatePageRecord(pageId, {
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
  const ownedCollection = await requireOwnedCollection(id, userId);
  if ("error" in ownedCollection) return ownedCollection.error;

  const pageId = await readPageId(req);
  if (!pageId) return NextResponse.json({ error: "Missing pageId" }, { status: 400 });

  const page = await getPageRecord(pageId);
  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });
  if (page.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (page.collection_id === id) {
    await updatePageRecord(pageId, {
      collection_id: null,
      updated_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true });
}
