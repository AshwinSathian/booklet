import { resolveApiKey } from "@/lib/api-key-auth";
import { getPagesByUser } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { ROUTES } from "@/lib/constants";
import { getSiteOrigin } from "@/lib/site-url";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

export async function GET(req: Request) {
  const userId = await resolveApiKey(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`v1__pages_list__${userId}`, 60);
  if (rl) return rl;

  const url = new URL(req.url);
  const rawLimit = parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
  const rawOffset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  // Both optional — an empty/whitespace-only value is treated as "no
  // filter" by getPagesByUser itself, so no extra normalization needed here.
  const query = url.searchParams.get("q") ?? undefined;
  const tag = url.searchParams.get("tag") ?? undefined;

  const { pages, total } = await getPagesByUser(userId, { limit, offset, query, tag });

  const origin = getSiteOrigin(req);

  const items = pages.map((p) => {
    const path = ROUTES.publish(p.slug ?? p.id);
    return {
      id: p.id,
      title: p.title ?? null,
      slug: p.slug ?? null,
      visibility: p.visibility,
      view_count: p.view_count,
      url: `${origin}${path}`,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  });

  return NextResponse.json(
    { pages: items, total, limit, offset },
    { status: 200 },
  );
}
