import { deleteCollectionRecord, updateCollectionRecord } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getOwnedCollection } from "@/server/collections";
import { toErrorResponse } from "@/server/errors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function cleanName(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let collection;
  try {
    collection = await getOwnedCollection(id, userId);
  } catch (e) {
    return toErrorResponse(e);
  }

  let body: { name?: unknown };
  try {
    body = (await req.json()) as { name?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = cleanName(body.name);
  if (name.length < 1 || name.length > 80) {
    return NextResponse.json({ error: "Collection name must be 1-80 characters." }, { status: 422 });
  }

  const updatedAt = new Date().toISOString();
  try {
    await updateCollectionRecord(id, { name, updated_at: updatedAt });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("E11000")) {
      return NextResponse.json({ error: "Collection name already exists." }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ collection: { ...collection, name, updated_at: updatedAt } });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await getOwnedCollection(id, userId);
  } catch (e) {
    return toErrorResponse(e);
  }

  await deleteCollectionRecord(id, userId);
  return new NextResponse(null, { status: 204 });
}
