import { getPageVersion } from "@/lib/db/versions";
import { getSession } from "@/lib/auth/session";
import { getOwnedPage } from "@/server/pages";
import { toErrorResponse } from "@/server/errors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; versionNumber: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, versionNumber } = await params;
  try {
    await getOwnedPage(id, userId);
  } catch (e) {
    return toErrorResponse(e);
  }

  const parsedVersion = Number(versionNumber);
  if (!Number.isInteger(parsedVersion) || parsedVersion < 1) {
    return NextResponse.json({ error: "Invalid version" }, { status: 422 });
  }

  const doc = await getPageVersion(id, parsedVersion);
  if (!doc) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  return NextResponse.json({ doc });
}
