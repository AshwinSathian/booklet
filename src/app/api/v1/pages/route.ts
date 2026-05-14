import { resolveApiKey } from "@/lib/api-key-auth";
import { getPagesByUser } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { ROUTES } from "@/lib/constants";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const userId = await resolveApiKey(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`v1__pages_list__${userId}`, 60);
  if (rl) return rl;

  const pages = await getPagesByUser(userId);

  const base = new URL(req.url);
  base.search = "";
  base.hash = "";

  const items = pages.map((p) => {
    const path = ROUTES.publish(p.slug ?? p.id);
    return {
      id: p.id,
      title: p.title ?? null,
      slug: p.slug ?? null,
      visibility: p.visibility,
      view_count: p.view_count,
      url: `${base.origin}${path}`,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  });

  return NextResponse.json({ pages: items }, { status: 200 });
}
