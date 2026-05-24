import { addCollectionMember, createCollectionRecord, getCollectionsByUser, getTeamSpacesByMembership, updateCollectionRecord } from "@/lib/db";
import { createId } from "@/lib/id";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [owned, member] = await Promise.all([
    getCollectionsByUser(userId).then((cs) => cs.filter((c) => c.is_team_space)),
    getTeamSpacesByMembership(userId),
  ]);

  const ownedIds = new Set(owned.map((c) => c.id));
  const teams = [...owned, ...member.filter((c) => !ownedIds.has(c.id))];

  return NextResponse.json({ teams });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; slug?: string };
  try {
    body = (await req.json()) as { name?: string; slug?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name || name.length > 80) {
    return NextResponse.json({ error: "Team name is required (max 80 chars)." }, { status: 422 });
  }

  const slug = body.slug?.trim() ? slugify(body.slug.trim()) : slugify(name);
  if (!slug) return NextResponse.json({ error: "Could not derive a valid slug from the name." }, { status: 422 });

  const id = createId(10);

  try {
    await createCollectionRecord(id, userId, name, true);
    await updateCollectionRecord(id, { slug });
    // Add creator as first member so getCollectionMembers returns a non-empty list
    await addCollectionMember(createId(10), id, userId, null, "editor", userId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create team";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ id, name, slug }, { status: 201 });
}
