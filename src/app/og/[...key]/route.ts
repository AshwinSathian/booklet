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
  // As the page itself resolves its address: a document with this id first,
  // and a custom URL only when there is none. A page without an account has
  // no record, and its id must not be answered with whatever page took that
  // id as its slug.
  let id = idOrSlug;
  let doc = await getDoc(id);
  const record = doc ? await getPageRecord(id) : await getPageBySlug(idOrSlug);
  if (!doc && record) {
    id = record.id;
    doc = await getDoc(id);
  }
  if (record && (record.password_hash || record.visibility === "team")) return {};
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

const render = async (card: Card) =>
  new Uint8Array(await sharp(Buffer.from(buildOgSvg(card.title, card.kicker, card.footer))).png({ compressionLevel: 9, palette: true }).toBuffer());

// Drawn once: it is what every missing, locked or gone page gets, and anyone can ask for those in any number.
let site: Promise<Uint8Array<ArrayBuffer>> | null = null;
const siteCard = () => (site ??= render({}));

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

  let png: Uint8Array<ArrayBuffer>;
  try {
    png = found.title ? await render(found) : await siteCard();
  } catch {
    // A title the renderer cannot draw still gets a preview: the site's.
    png = await siteCard();
  }
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      // A page's title can change, and a page can be given a password or
      // taken down: its card is kept for ten minutes. The site's own cards
      // change with a release.
      "Cache-Control": parts[0] === "p" ? "public, max-age=600" : "public, max-age=86400, s-maxage=604800",
      "X-Robots-Tag": "noindex",
    },
  });
}
