import { getCollectionMembers, getCollectionRecord, removeCollectionMember } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const team = await getCollectionRecord(id);
  if (!team || !team.is_team_space) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (team.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const members = await getCollectionMembers(id);
  return NextResponse.json({ members });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const team = await getCollectionRecord(id);
  if (!team || !team.is_team_space) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (team.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { userId?: string };
  try {
    body = (await req.json()) as { userId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const targetUserId = body.userId;
  if (!targetUserId) return NextResponse.json({ error: "userId required" }, { status: 422 });
  if (targetUserId === userId) return NextResponse.json({ error: "Cannot remove yourself" }, { status: 422 });

  await removeCollectionMember(id, targetUserId);
  return new NextResponse(null, { status: 204 });
}
