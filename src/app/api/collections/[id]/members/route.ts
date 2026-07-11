import {
  addCollectionMember,
  getCollectionMembers,
  getCollectionRecord,
  getUserByEmail,
  removeCollectionMember,
} from "@/lib/db";
import { createId } from "@/lib/id";
import { getSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// GET — list members of a team space collection
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const collection = await getCollectionRecord(id);
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (collection.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const members = await getCollectionMembers(id);
  return NextResponse.json({ members });
}

// POST — add a member (owner only)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const collection = await getCollectionRecord(id);
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (collection.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!collection.is_team_space) return NextResponse.json({ error: "Not a team space" }, { status: 400 });

  let body: { email?: string; role?: string };
  try {
    body = (await req.json()) as { email?: string; role?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 422 });
  }

  const role = body.role === "viewer" ? "viewer" : "editor";

  // Look up user by email if they already have an account
  const invitedUser = await getUserByEmail(email).catch(() => null);
  const invitedUserId = invitedUser?.id ?? `pending:${email}`;

  const memberId = createId(10);
  await addCollectionMember(memberId, id, invitedUserId, email, role, userId);

  return NextResponse.json({ ok: true, member: { email, role, user_id: invitedUserId } }, { status: 201 });
}

// DELETE — remove a member
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const collection = await getCollectionRecord(id);
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (collection.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { user_id?: string };
  try {
    body = (await req.json()) as { user_id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  await removeCollectionMember(id, body.user_id);
  return new NextResponse(null, { status: 204 });
}
