import { getPageBySlug, getPageRecord } from "@/lib/db";
import { extractDocTitle } from "@/lib/doc-title";
import { embedIframe } from "@/lib/embed-code";
import { APP_NAME } from "@/lib/constants";
import { absoluteUrl } from "@/lib/seo";
import { getDoc } from "@/lib/storage";
import { problem } from "@/server/errors";
import { getGoneReason } from "@/server/page-gone";

export const runtime = "nodejs";

/**
 * oEmbed (https://oembed.com) for a published page: `GET /api/oembed?url=<page address>`.
 * Tools that take a pasted link and embed it (Notion, Discord, a wiki) ask
 * here for the frame. Same rule as the link preview: a page that is
 * missing, gone, behind a password or for a team only does not exist here.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  if ((params.get("format") ?? "json") !== "json") return problem(501, "Only format=json is supported.");
  let key: string | null = null;
  try {
    const target = new URL(params.get("url") ?? "");
    if (target.origin === new URL(absoluteUrl("/")).origin) key = /^\/p\/([^/]+)\/?$/.exec(target.pathname)?.[1] ?? null;
    if (key) key = decodeURIComponent(key);
  } catch {
    key = null;
  }
  if (!key) return problem(404, "No published page at that address.");

  const record = (await getPageRecord(key)) ?? (await getPageBySlug(key));
  const id = record?.id ?? key;
  if (record && (record.password_hash || record.visibility === "team")) return problem(404, "No published page at that address.");
  const doc = await getDoc(id);
  if (!doc || (await getGoneReason(id))) return problem(404, "No published page at that address.");

  const title = extractDocTitle(doc.blocks) ?? "Shared page";
  const page = record?.slug ?? id;
  return Response.json(
    {
      version: "1.0",
      type: "rich",
      title,
      provider_name: APP_NAME,
      provider_url: absoluteUrl("/"),
      html: embedIframe(absoluteUrl(`/p/${page}/embed`), title),
      width: 720,
      height: 400,
      thumbnail_url: absoluteUrl(`/og/p/${encodeURIComponent(page)}.png`),
      thumbnail_width: 1200,
      thumbnail_height: 630,
      cache_age: 3600,
    },
    { headers: { "Cache-Control": "public, max-age=600", "X-Robots-Tag": "noindex" } },
  );
}
