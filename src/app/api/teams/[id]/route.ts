import { deleteCollectionRecord, getCollectionRecord, updateCollectionRecord } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const team = await getCollectionRecord(id);
  if (!team || !team.is_team_space) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (team.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { name?: string };
  try {
    body = (await req.json()) as { name?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (name) {
    await updateCollectionRecord(id, { name, updated_at: new Date().toISOString() });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const team = await getCollectionRecord(id);
  if (!team || !team.is_team_space) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (team.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await deleteCollectionRecord(id, userId);

  return new NextResponse(null, { status: 204 });
}
