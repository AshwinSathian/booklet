import {
  createCollectionRecord,
  getCollectionsByUser,
  getTeamSpacesByMembership,
} from "@/lib/db";
import { createId } from "@/lib/id";
import { getSession } from "@/lib/auth/session";
import { resolveParent } from "@/server/collections";
import { toErrorResponse } from "@/server/errors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function cleanName(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanParentId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET() {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [owned, memberOf] = await Promise.all([
    getCollectionsByUser(userId),
    getTeamSpacesByMembership(userId),
  ]);
  // Deduplicate (user might also own team spaces they're listed as a member of)
  const seen = new Set(owned.map((c) => c.id));
  const collections = [...owned, ...memberOf.filter((c) => !seen.has(c.id))];
  return NextResponse.json({ collections });
}

export async function POST(req: Request) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: unknown; is_team_space?: unknown; parent_id?: unknown };
  try {
    body = (await req.json()) as { name?: unknown; is_team_space?: unknown; parent_id?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = cleanName(body.name);
  if (name.length < 1 || name.length > 80) {
    return NextResponse.json({ error: "Collection name must be 1-80 characters." }, { status: 422 });
  }

  const isTeamSpace = body.is_team_space === true;
  const requestedParentId = isTeamSpace ? null : cleanParentId(body.parent_id);

  let parent;
  try {
    parent = await resolveParent(requestedParentId, userId);
  } catch (e) {
    return toErrorResponse(e);
  }
  const parentId = parent ? parent.id : null;

  const id = createId(10);
  const now = new Date().toISOString();
  try {
    await createCollectionRecord(id, userId, name, isTeamSpace, parentId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("E11000")) {
      return NextResponse.json(
        { error: parentId ? "A folder with that name already exists here." : "Collection name already exists." },
        { status: 409 },
      );
    }
    throw err;
  }

  return NextResponse.json({
    collection: {
      id,
      user_id: userId,
      name,
      is_team_space: isTeamSpace,
      parent_id: parentId,
      created_at: now,
      updated_at: now,
    },
  }, { status: 201 });
}
