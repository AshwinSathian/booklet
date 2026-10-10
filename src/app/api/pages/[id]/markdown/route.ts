import { getPageRecord } from "@/lib/db";
import { getDoc } from "@/lib/storage";
import { ROUTES } from "@/lib/constants";
import { getSiteOrigin } from "@/lib/site-url";
import { getGoneReason, resolvePageId } from "@/server/page-gone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () => new Response("Not found\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

/**
 * The raw Markdown of a share page, for agents and scripts. src/middleware.ts
 * rewrites `/p/:id.md`, and `/p/:id` requested with `Accept: text/markdown`,
 * to this route.
 *
 * Served only for pages anyone with the link may read. Password-protected,
 * taken-down and expired pages are 404, and so is any visibility this route
 * does not know: a visibility added later stays private until it is allowed
 * here on purpose.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idOrSlug } = await params;
  const id = await resolvePageId(idOrSlug);
  if (!id || (await getGoneReason(id))) return notFound();

  const record = await getPageRecord(id); // null for an anonymous page
  if (record && (record.password_hash || (record.visibility !== "public" && record.visibility !== "unlisted"))) {
    return notFound();
  }

  const raw = (await getDoc(id))?.raw;
  if (!raw) return notFound();

  return new Response(raw, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "no-store",
      Vary: "Accept",
      // The HTML page is the one to index; this is the same content again.
      "X-Robots-Tag": "noindex",
      Link: `<${getSiteOrigin(req)}${ROUTES.publish(record?.slug ?? id)}>; rel="canonical"`,
    },
  });
}
