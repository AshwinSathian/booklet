import { getPageBySlug } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Mirrors the validation in /api/pages/[id]/route.ts
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$|^[a-z0-9]{3,60}$/;

function isValidSlug(s: string): boolean {
  return SLUG_RE.test(s) && !s.includes("--");
}

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
