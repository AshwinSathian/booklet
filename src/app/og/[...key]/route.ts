import sharp from "sharp";
import { getPageBySlug, getPageRecord } from "@/lib/db";
import { DOC_TYPE_LABELS, isDocType } from "@/lib/doc-types";
import { extractDocTitle } from "@/lib/doc-title";
import { getDocPage } from "@/lib/docs";
import { buildOgSvg } from "@/lib/og-image";
import { getDoc } from "@/lib/storage";
import { TEMPLATES } from "@/lib/templates";
import { getGoneReason } from "@/server/page-gone";

export const runtime = "nodejs";

/**
 * Link-preview images, 1200 by 630, as PNG:
 *
 *   /og/site.png              the site's card
 *   /og/p/<id or slug>.png    a published page: its title, and its type if it has one
 *   /og/docs/<slug>.png       a docs page
 *   /og/templates/<slug>.png  a template
 *
 * What is drawn is looked up from the path, never taken from the request,
 * so nobody can make a card that says something of their own under this
 * site's name. A page that is missing, gone, behind a password or for a
 * team only gets the site's card: its title is not for a link preview.
 *
 * The `.png` ending keeps these paths out of the middleware (see its
 * matcher) and lets a CDN cache them.
 */
type Card = { title?: string; kicker?: string; footer?: string };

async function publishedPage(idOrSlug: string): Promise<Card> {
  let id = idOrSlug;
  let record = await getPageRecord(id);
  if (!record) {
    record = await getPageBySlug(idOrSlug);
    if (record) id = record.id;
  }
  if (record && (record.password_hash || record.visibility === "team")) return {};
  const doc = await getDoc(id);
  if (!doc || (await getGoneReason(id))) return {};
  const title = extractDocTitle(doc.blocks);
  if (!title) return {};
  return { title, kicker: record && isDocType(record.doc_type) ? DOC_TYPE_LABELS[record.doc_type] : undefined };
}

async function card(key: string[]): Promise<Card | null> {
  const [kind, ...rest] = key;
  if (kind === "site" && rest.length === 0) return {};
  if (kind === "p" && rest.length === 1) return publishedPage(rest[0]);
  if (kind === "docs" && rest.length > 0) {
    const page = getDocPage(rest);
    return page ? { title: page.title, kicker: "Docs", footer: "Booklet documentation" } : null;
  }
  if (kind === "templates" && rest.length === 1) {
    const template = TEMPLATES.find((t) => t.slug === rest[0]);
    return template ? { title: `${template.name} template`, kicker: "Template", footer: "Free to use, in Markdown" } : null;
  }
  return null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const last = key.at(-1) ?? "";
  if (!last.endsWith(".png")) return new Response("Not found", { status: 404 });
  let parts: string[];
  try {
    parts = [...key.slice(0, -1), last.slice(0, -4)].map((part) => decodeURIComponent(part));
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const found = await card(parts);
  if (!found) return new Response("Not found", { status: 404 });

  const png = await sharp(Buffer.from(buildOgSvg(found.title, found.kicker, found.footer))).png({ compressionLevel: 9, palette: true }).toBuffer();
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // A page's title can change; the site's own cards change with a release.
      "Cache-Control": parts[0] === "p" ? "public, max-age=600, s-maxage=3600" : "public, max-age=86400, s-maxage=604800",
      "X-Robots-Tag": "noindex",
    },
  });
}
