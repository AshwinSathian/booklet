import { addCollectionMember, createCollectionRecord, deleteCollectionRecord, getCollectionBySlug, getCollectionsByUser, getTeamSpacesByMembership, updateCollectionRecord } from "@/lib/db";
import { createId } from "@/lib/id";
import { getSession } from "@/lib/auth/session";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

// Static segments under /t/ — a team claiming one of these would be
// permanently unreachable at /t/<slug>, since Next.js resolves the static
// route (e.g. src/app/t/join/page.tsx) before the dynamic src/app/t/[slug].
const RESERVED_TEAM_SLUGS = new Set(["join"]);

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
  if (RESERVED_TEAM_SLUGS.has(slug)) {
    return NextResponse.json({ error: "That team URL is reserved." }, { status: 409 });
  }

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
    logError("teams", "Failed to create team", e);
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
  }

  return NextResponse.json({ id, name, slug }, { status: 201 });
}
