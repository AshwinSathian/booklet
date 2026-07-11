import { getPageRecord } from "@/lib/db";
import { getPageVersions } from "@/lib/db/versions";
import { getSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const page = await getPageRecord(id);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (page.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const versions = await getPageVersions(id);
  return NextResponse.json({ versions });
}
