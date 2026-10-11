import { Container, PageShell, PageTitle } from "@/components/marketing/primitives";
import { getDistinctTags } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Tags",
  description: "Public pages on Booklet, by tag.",
  pathname: "/tags",
  noIndex: true,
});

export default async function TagsPage() {
  const tags = await getDistinctTags(200).catch(() => [] as Array<{ tag: string; count: number }>);
  return (
    <PageShell>
      <Container className="py-14 sm:py-20">
        <PageTitle
          title="Tags"
          lede={
            <>
              Tags on public pages. A page gets them from <code className="rounded bg-bg-soft px-1.5 py-0.5 font-mono text-[0.9em]">tags: [postgres]</code>{" "}
              in its frontmatter.
            </>
          }
        />
        {tags.length === 0 ? (
          <p className="mt-10 max-w-xl rounded-xl border border-dashed border-border-strong px-6 py-12 text-center text-text-secondary">
            No public page has a tag yet.
          </p>
        ) : (
          <ul className="mt-10 flex flex-wrap gap-2">
            {tags.map(({ tag, count }) => (
              <li key={tag}>
                <Link
                  href={`/tags/${encodeURIComponent(tag)}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-border-strong bg-bg-elevated px-3 py-1.5 text-sm hover:border-accent"
                >
                  {tag}
                  <span className="text-xs tabular-nums text-text-muted">{count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </PageShell>
  );
}
