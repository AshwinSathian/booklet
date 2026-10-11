import { unverifiedResponse } from "@/server/verification";
import { updatePageRecord, deletePageRecord, deletePageAssociatedRecords } from "@/lib/db";
import { deletePageVersions } from "@/lib/db/versions";
import { deleteDoc, getDoc } from "@/lib/storage";
import { hashPassword } from "@/lib/password";
import { logError } from "@/lib/logger";
import { getSession } from "@/lib/auth/session";
import { getOwnedPage, assertNotTakenDown, assertSlugAvailable, relinkPage } from "@/server/pages";
import { getSiteOrigin } from "@/lib/site-url";
import { toErrorResponse, problem } from "@/server/errors";
import { assertVisibilityAllowed } from "@/server/access";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) {
    return problem(401, "Unauthorized");
  }

  const { id } = await params;
  if (!id?.trim()) {
    return problem(400, "Missing page id");
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
    return problem(401, "Unauthorized");
  }

  // Slug, password and visibility decide how a page is published, so this
  // is gated like the publish routes.
  const unverified = await unverifiedResponse(userId);
  if (unverified) return unverified;

  const { id } = await params;
  if (!id?.trim()) {
    return problem(400, "Missing page id");
  }

  let record;
  try {
    record = await getOwnedPage(id, userId);
    assertNotTakenDown(record);
  } catch (e) {
    return toErrorResponse(e);
  }

  let body: {
    slug?: string | null;
    visibility?: string;
    password?: string | null;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return problem(400, "Invalid JSON");
  }

  const patch: Parameters<typeof updatePageRecord>[1] = {};

  if (body.password !== undefined) {
    if (body.password === null || body.password === "") {
      patch.password_hash = null;
    } else if (typeof body.password === "string" && body.password.length >= 6) {
      patch.password_hash = await hashPassword(body.password);
    } else {
      return problem(422, "Password must be at least 6 characters.");
    }
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
    if (body.visibility !== "public" && body.visibility !== "unlisted" && body.visibility !== "team") {
      return problem(422, "visibility must be 'public', 'unlisted' or 'team'");
    }
    try {
      await assertVisibilityAllowed(body.visibility, record.collection_id, userId);
    } catch (e) {
      return toErrorResponse(e);
    }
    patch.visibility = body.visibility;
  }

  if (Object.keys(patch).length === 0) {
    return problem(400, "No valid fields to update");
  }

  try {
    if (patch.visibility && patch.visibility !== record.visibility) {
      // Before the record changes, so the page is never public while it
      // still carries links only a less visible page may have.
      await relinkPage(record, patch.visibility, getSiteOrigin(req));
    }
    await updatePageRecord(id, patch);
  } catch (e: unknown) {
    // The slug availability check above isn't atomic with this write — a
    // concurrent request can still claim the slug in between, which surfaces
    // here as the unique index rejecting the write (E11000). Recognize that
    // case for a clean message; anything else is an unexpected DB failure
    // whose raw driver message shouldn't go to the client.
    if (typeof e === "object" && e !== null && "code" in e && e.code === 11000) {
      return problem(409, "This slug is already taken.");
    }
    logError("update-page", "Failed to update", e);
    return problem(500, "Failed to update");
  }

  return NextResponse.json({ id, ...patch });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) {
    return problem(401, "Unauthorized");
  }

  const { id } = await params;
  if (!id?.trim()) {
    return problem(400, "Missing page id");
  }

  try {
    // Deleting would free the slug for a fresh copy at the same URL and
    // destroy the record of what was taken down.
    assertNotTakenDown(await getOwnedPage(id, userId));
  } catch (e) {
    return toErrorResponse(e);
  }

  try {
    await deleteDoc(id);
  } catch (e: unknown) {
    logError("delete-page", "Delete failed", e);
    return problem(500, "Delete failed");
  }

  try {
    await deletePageRecord(id);
    await deletePageVersions(id);
    await deletePageAssociatedRecords(id);
  } catch (dbErr) {
    logError("delete-page", "DB delete failed", dbErr);
  }

  return new NextResponse(null, { status: 204 });
}
