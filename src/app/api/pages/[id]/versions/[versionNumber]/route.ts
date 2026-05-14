import { getPageRecord } from "@/lib/db";
import { getPageVersion } from "@/lib/db/versions";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; versionNumber: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, versionNumber } = await params;
  const page = await getPageRecord(id);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (page.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsedVersion = Number(versionNumber);
  if (!Number.isInteger(parsedVersion) || parsedVersion < 1) {
    return NextResponse.json({ error: "Invalid version" }, { status: 422 });
  }

  const doc = await getPageVersion(id, parsedVersion);
  if (!doc) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  return NextResponse.json({ doc });
}
