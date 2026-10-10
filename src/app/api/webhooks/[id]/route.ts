import { deleteWebhook } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";
import { problem } from "@/server/errors";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return problem(401, "Unauthorized");

  const { id } = await params;
  await deleteWebhook(id, userId);
  return new NextResponse(null, { status: 204 });
}
