import { getPageBySlug } from "@/lib/db";
import { isValidSlug } from "@/lib/slug";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/pages/check-slug?slug=my-slug&exclude=pageId
 * Returns { available: boolean }.
 * No auth required — slug availability is public information.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug")?.trim().toLowerCase() ?? "";
  const exclude = searchParams.get("exclude") ?? "";

  if (!slug || !isValidSlug(slug)) {
    return NextResponse.json({ available: false });
  }

  try {
    const existing = await getPageBySlug(slug);
    const available = !existing || existing.id === exclude;
    return NextResponse.json({ available });
  } catch {
    return NextResponse.json({ available: false });
  }
}
