import { updatePageRecord } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getAssignableCollection } from "@/server/collections";
import { ServiceError } from "@/server/errors";
import { getOwnedPage } from "@/server/pages";
import { toErrorResponse } from "@/server/errors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const teamOnlyPageStays = () =>
  new ServiceError(
    "TEAM_ONLY_PAGE",
    "This page is team-only. Change its visibility before moving it out of its team space.",
    422,
  );

async function readPageId(req: Request): Promise<string | null> {
  try {
    const body = (await req.json()) as { pageId?: unknown };
    return typeof body.pageId === "string" && body.pageId.trim() ? body.pageId.trim() : null;
  } catch {
    return null;
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let page;
  try {
    await getAssignableCollection(id, userId);
    const pageId = await readPageId(req);
    if (!pageId) return NextResponse.json({ error: "Missing pageId" }, { status: 400 });
    page = await getOwnedPage(pageId, userId);
    // A team-only page is readable by the members of the space it is in.
    // Moving it would hand it to another team, or to nobody.
    if (page.visibility === "team" && page.collection_id !== id) throw teamOnlyPageStays();
  } catch (e) {
    return toErrorResponse(e);
  }

  await updatePageRecord(page.id, {
    collection_id: id,
    updated_at: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let page;
  try {
    // Owning the page is enough to take it out. Someone removed from a
    // team space, or made a viewer, must still be able to leave with what
    // is theirs.
    const pageId = await readPageId(req);
    if (!pageId) return NextResponse.json({ error: "Missing pageId" }, { status: 400 });
    page = await getOwnedPage(pageId, userId);
    if (page.visibility === "team" && page.collection_id === id) throw teamOnlyPageStays();
  } catch (e) {
    return toErrorResponse(e);
  }

  if (page.collection_id === id) {
    await updatePageRecord(page.id, {
      collection_id: null,
      updated_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true });
}
