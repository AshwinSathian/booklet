import { addCollectionMember, createCollectionRecord, deleteCollectionRecord, getCollectionBySlug, getCollectionsByUser, getTeamSpacesByMembership, updateCollectionRecord } from "@/lib/db";
import { createId } from "@/lib/id";
import { getSession } from "@/lib/auth/session";
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
  const userId = (await getSession())?.userId ?? null;
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
  const userId = (await getSession())?.userId ?? null;
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

  // Fast, friendly rejection for the common case. This is a check-then-act
  // race in the worst case (two simultaneous requests for the same slug),
  // so it is NOT the source of truth — the unique index on
  // `collections.slug` (see src/lib/db/index-specs.mjs) is, and its
  // duplicate-key error is what we authoritatively act on below.
  const existing = await getCollectionBySlug(slug);
  if (existing) {
    return NextResponse.json({ error: "That team URL is already taken." }, { status: 409 });
  }

  const id = createId(10);

  try {
    await createCollectionRecord(id, userId, name, true);
    try {
      await updateCollectionRecord(id, { slug });
    } catch (e) {
      const isDuplicateKey =
        typeof e === "object" && e !== null && "code" in e && (e as { code?: unknown }).code === 11000;
      if (isDuplicateKey) {
        await deleteCollectionRecord(id, userId).catch(() => {});
        return NextResponse.json({ error: "That team URL is already taken." }, { status: 409 });
      }
      throw e;
    }
    // Add creator as first member so getCollectionMembers returns a non-empty list
    await addCollectionMember(createId(10), id, userId, null, "editor", userId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create team";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ id, name, slug }, { status: 201 });
}
