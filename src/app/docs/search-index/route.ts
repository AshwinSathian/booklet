import { getSearchIndex } from "@/lib/docs";

export const runtime = "nodejs";

/** The docs search index, fetched by DocsSearch the first time it opens. */
export function GET() {
  return Response.json(getSearchIndex(), { headers: { "cache-control": "public, max-age=300", "x-robots-tag": "noindex" } });
}
