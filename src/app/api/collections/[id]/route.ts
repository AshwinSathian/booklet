import { deleteCollectionRecord, updateCollectionRecord } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { assertCanNest, getOwnedCollection, resolveParent } from "@/server/collections";
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

  let body: { name?: unknown; parent_id?: unknown };
  try {
    body = (await req.json()) as { name?: unknown; parent_id?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: { name?: string; parent_id?: string | null; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };

  if (body.name !== undefined) {
    const name = cleanName(body.name);
    if (name.length < 1 || name.length > 80) {
      return NextResponse.json({ error: "Collection name must be 1-80 characters." }, { status: 422 });
    }
    patch.name = name;
  }

  if (body.parent_id !== undefined) {
    const requestedParentId = typeof body.parent_id === "string" && body.parent_id.trim() ? body.parent_id.trim() : null;
    if (collection.is_team_space && requestedParentId !== null) {
      return NextResponse.json({ error: "Team spaces can't be nested." }, { status: 422 });
    }
    if (requestedParentId === id) {
      return NextResponse.json({ error: "A folder can't be its own parent." }, { status: 422 });
    }
    try {
      if (requestedParentId !== null) {
        await assertCanNest(id);
        await resolveParent(requestedParentId, userId);
      }
    } catch (e) {
      return toErrorResponse(e);
    }
    patch.parent_id = requestedParentId;
  }

  try {
    await updateCollectionRecord(id, patch);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("E11000")) {
      return NextResponse.json({ error: "A folder with that name already exists here." }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ collection: { ...collection, ...patch } });
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
