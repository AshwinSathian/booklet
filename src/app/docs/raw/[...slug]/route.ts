import { getDocPage } from "@/lib/docs";

export const runtime = "nodejs";

/** A docs page as Markdown. src/middleware.ts rewrites /docs/<slug>.md here. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  const page = getDocPage((await params).slug);
  if (!page) return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response(page.raw, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      // The HTML page is the one to index; this is the same text for agents and copy-paste.
      "x-robots-tag": "noindex",
      link: `<${page.href}>; rel="canonical"`,
    },
  });
}
