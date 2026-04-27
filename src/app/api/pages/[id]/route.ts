import { deletePageRecord, getPageRecord } from "@/lib/db";
import { deleteDoc } from "@/lib/storage";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

  // Delete KV content first; if D1 delete fails, the page is still gone.
  await deleteDoc(id);

  try {
    await deletePageRecord(id);
  } catch (dbErr) {
    console.error("[delete-page] D1 delete failed:", dbErr);
  }

  return new NextResponse(null, { status: 204 });
}
