import { deleteCollectionRecord, updateCollectionRecord } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getOwnedTeamSpace } from "@/server/collections";
import { toErrorResponse, problem } from "@/server/errors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PATCH(
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

  let body: { name?: string };
  try {
    body = (await req.json()) as { name?: string };
  } catch {
    return problem(400, "Invalid JSON");
  }

  // One line of at most 80 characters, as when the space was created: the name goes into invite emails.
  const name = typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim().slice(0, 80) : "";
  if (name) {
    await updateCollectionRecord(id, { name, updated_at: new Date().toISOString() });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
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

  await deleteCollectionRecord(id, userId);

  return new NextResponse(null, { status: 204 });
}
