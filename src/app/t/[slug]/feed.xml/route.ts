import { getCollectionBySlug, getSpacePages } from "@/lib/db";
import { getSiteOrigin } from "@/lib/site-url";
import { buildSpaceFeed } from "@/lib/space-groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Atom feed of a team space's public pages. A space with no public pages
 * has no feed (404), which is also what a space that does not exist
 * answers: the feed never confirms a private space.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const space = await getCollectionBySlug(slug);
  const pages = space ? await getSpacePages(space.id, true) : [];
  if (!space?.slug || pages.length === 0) {
    return new Response("Not found\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return new Response(buildSpaceFeed({ name: space.name, slug: space.slug }, pages, getSiteOrigin(req)), {
    headers: { "Content-Type": "application/atom+xml; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
