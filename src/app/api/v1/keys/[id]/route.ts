import { deleteApiKey } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

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
    return NextResponse.json({ error: "Missing key id" }, { status: 400 });
  }

  // deleteApiKey already scopes to the user — safe against cross-user deletion.
  await deleteApiKey(id, userId);

  return new NextResponse(null, { status: 204 });
}
