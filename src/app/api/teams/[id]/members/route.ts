import { getCollectionMembers, removeCollectionMember } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getOwnedTeamSpace } from "@/server/collections";
import { toErrorResponse, problem } from "@/server/errors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return problem(401, "Unauthorized");

  const { id } = await params;
  try {
    await getOwnedTeamSpace(id, userId);
  } catch (e) {
    return toErrorResponse(e);
  }

  const members = await getCollectionMembers(id);
  return NextResponse.json({ members });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return problem(401, "Unauthorized");

  const { id } = await params;
  try {
    await getOwnedTeamSpace(id, userId);
  } catch (e) {
    return toErrorResponse(e);
  }

  let body: { userId?: string };
  try {
    body = (await req.json()) as { userId?: string };
  } catch {
    return problem(400, "Invalid JSON");
  }

  const targetUserId = body.userId;
  if (typeof targetUserId !== "string" || !targetUserId) {
    return problem(422, "userId required");
  }
  if (targetUserId === userId) return problem(422, "Cannot remove yourself");

  await removeCollectionMember(id, targetUserId);
  return new NextResponse(null, { status: 204 });
}
