import { getPageVersion } from "@/lib/db/versions";
import { getSession } from "@/lib/auth/session";
import { getOwnedPage } from "@/server/pages";
import { toErrorResponse, problem } from "@/server/errors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; versionNumber: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return problem(401, "Unauthorized");

  const { id, versionNumber } = await params;
  try {
    await getOwnedPage(id, userId);
  } catch (e) {
    return toErrorResponse(e);
  }

  const parsedVersion = Number(versionNumber);
  if (!Number.isInteger(parsedVersion) || parsedVersion < 1) {
    return problem(422, "Invalid version");
  }

  const doc = await getPageVersion(id, parsedVersion);
  if (!doc) return problem(404, "Version not found");

  return NextResponse.json({ doc });
}
