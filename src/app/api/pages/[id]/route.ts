import { getPageBySlug, getPageRecord, updatePageRecord, deletePageRecord } from "@/lib/db";
import { deletePageVersions } from "@/lib/db/versions";
import { deleteDoc } from "@/lib/storage";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Slug rules: 3-60 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphens.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$|^[a-z0-9]{3,60}$/;

function isValidSlug(s: string): boolean {
  return SLUG_RE.test(s) && !s.includes("--");
}

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing page id" }, { status: 400 });
  }

  const record = await getPageRecord(id);
  if (!record) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }
  if (record.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { slug?: string | null; visibility?: string } = {};
  try {
    body = (await req.json()) as { slug?: string | null; visibility?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Parameters<typeof updatePageRecord>[1] = {};

  if (body.slug !== undefined) {
    const rawSlug = body.slug;
    const slug = rawSlug === null ? null : rawSlug.trim().toLowerCase();

    if (slug !== null && !isValidSlug(slug)) {
      return NextResponse.json(
        { error: "Invalid slug. Use 1-60 lowercase letters, numbers, or hyphens." },
        { status: 422 },
      );
    }

    if (slug !== null) {
      const existing = await getPageBySlug(slug);
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: "Slug is already taken." }, { status: 409 });
      }
    }

    patch.slug = slug;
  }

  if (body.visibility !== undefined) {
    if (body.visibility !== "public" && body.visibility !== "unlisted") {
      return NextResponse.json(
        { error: "visibility must be 'public' or 'unlisted'" },
        { status: 422 },
      );
    }
    patch.visibility = body.visibility;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    await updatePageRecord(id, patch);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ id, ...patch });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing page id" }, { status: 400 });
  }

  const record = await getPageRecord(id);
  if (!record) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }
  if (record.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await deleteDoc(id);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  try {
    await deletePageRecord(id);
    await deletePageVersions(id);
  } catch (dbErr) {
    console.error("[delete-page] DB delete failed:", dbErr);
  }

  return new NextResponse(null, { status: 204 });
}
