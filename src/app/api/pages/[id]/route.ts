import { updatePageRecord, deletePageRecord } from "@/lib/db";
import { deletePageVersions } from "@/lib/db/versions";
import { deleteDoc, getDoc } from "@/lib/storage";
import { hashPassword } from "@/lib/password";
import { logError } from "@/lib/logger";
import { getSession } from "@/lib/auth/session";
import { getOwnedPage, assertSlugAvailable } from "@/server/pages";
import { toErrorResponse } from "@/server/errors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing page id" }, { status: 400 });
  }

  let record;
  try {
    record = await getOwnedPage(id, userId);
  } catch (e) {
    return toErrorResponse(e);
  }

  const doc = await getDoc(record.id);

  return NextResponse.json({
    id: record.id,
    title: record.title ?? null,
    raw: doc?.raw ?? null,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing page id" }, { status: 400 });
  }

  try {
    await getOwnedPage(id, userId);
  } catch (e) {
    return toErrorResponse(e);
  }

  let body: {
    slug?: string | null;
    visibility?: string;
    password?: string | null;
    featured?: boolean;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Parameters<typeof updatePageRecord>[1] = {};

  if (body.password !== undefined) {
    if (body.password === null || body.password === "") {
      patch.password_hash = null;
    } else if (typeof body.password === "string" && body.password.length >= 6) {
      patch.password_hash = await hashPassword(body.password);
    } else {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 422 });
    }
  }

  if (body.featured !== undefined) {
    patch.featured = Boolean(body.featured);
  }

  if (body.slug !== undefined) {
    const rawSlug = body.slug;
    const slug = rawSlug === null ? null : (rawSlug.trim().toLowerCase() || null);

    if (slug !== null) {
      try {
        await assertSlugAvailable(slug, id);
      } catch (e) {
        return toErrorResponse(e);
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
  const userId = (await getSession())?.userId ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing page id" }, { status: 400 });
  }

  try {
    await getOwnedPage(id, userId);
  } catch (e) {
    return toErrorResponse(e);
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
    logError("delete-page", "DB delete failed", dbErr);
  }

  return new NextResponse(null, { status: 204 });
}
