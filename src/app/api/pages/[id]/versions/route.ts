import { getPageVersions } from "@/lib/db/versions";
import { getSession } from "@/lib/auth/session";
import { getOwnedPage } from "@/server/pages";
import { toErrorResponse } from "@/server/errors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await getOwnedPage(id, userId);
  } catch (e) {
    return toErrorResponse(e);
  }

  const versions = await getPageVersions(id);
  return NextResponse.json({ versions });
}
