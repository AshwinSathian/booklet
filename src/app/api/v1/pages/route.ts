import { getPagesByUser } from "@/lib/db";
import { isDocType } from "@/lib/doc-types";
import { getSpaceForMember } from "@/server/access";
import { spaceSlugs } from "@/server/pages";
import { problem } from "@/server/errors";
import { v1 } from "@/server/v1";
import { ROUTES } from "@/lib/constants";
import { getSiteOrigin } from "@/lib/site-url";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/** Opaque keyset cursor: the sort key of the last page already returned. */
function encodeCursor(p: { created_at: string; id: string }): string {
  return Buffer.from(JSON.stringify([p.created_at, p.id])).toString("base64url");
}

function decodeCursor(cursor: string): { created_at: string; id: string } | null {
  try {
    const v: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString());
    if (Array.isArray(v) && v.length === 2 && typeof v[0] === "string" && typeof v[1] === "string") {
      return { created_at: v[0], id: v[1] };
    }
  } catch {
    /* fall through */
  }
  return null;
}

export const GET = v1("pages_list", 60, "pages:read", async (req: Request, userId: string) => {
  const url = new URL(req.url);
  const rawLimit = parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
  const rawOffset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  // Both optional — an empty/whitespace-only value is treated as "no
  // filter" by getPagesByUser itself, so no extra normalization needed here.
  const query = url.searchParams.get("q") ?? undefined;
  const tag = url.searchParams.get("tag") ?? undefined;

  const type = url.searchParams.get("type") ?? undefined;
  if (type !== undefined && !isDocType(type)) return problem(422, "Unknown document type.");

  // With `space`, the list is that team space's pages, whoever owns them,
  // and the caller must be in the space. Without it, the caller's own pages.
  const spaceSlug = url.searchParams.get("space");
  const space = spaceSlug === null ? null : await getSpaceForMember(spaceSlug, userId);

  // `cursor` walks the list by position in the sort order, so pages created
  // or deleted during the walk never shift it. `offset` still works; when
  // both are sent the offset counts from the cursor.
  const cursor = url.searchParams.get("cursor");
  const after = cursor ? decodeCursor(cursor) : undefined;
  if (after === null) return problem(400, "Invalid cursor");

  const { pages, total } = await getPagesByUser(userId, { limit, offset, query, tag, type, spaceId: space?.id, after });
  const slugs = await spaceSlugs(pages);

  const origin = getSiteOrigin(req);

  const items = pages.map((p) => {
    const path = ROUTES.publish(p.slug ?? p.id);
    return {
      id: p.id,
      title: p.title ?? null,
      slug: p.slug ?? null,
      visibility: p.visibility,
      doc_type: p.doc_type ?? null,
      space: (p.collection_id && slugs.get(p.collection_id)) || null,
      view_count: p.view_count,
      url: `${origin}${path}`,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  });

  return NextResponse.json(
    {
      pages: items,
      total,
      limit,
      offset,
      next_cursor: pages.length === limit ? encodeCursor(pages[pages.length - 1]) : null,
    },
    { status: 200 },
  );
});
