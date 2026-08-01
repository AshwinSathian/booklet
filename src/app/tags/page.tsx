import { AppLogo } from "@/components/ui/AppLogo";
import { Button } from "@/components/ui/Button";
import { getDistinctTags } from "@/lib/db";
import { ROUTES } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Tags — Booklet",
  description: "Browse public pages on Booklet by topic tag.",
  pathname: "/tags",
});

export default async function TagsPage() {
  const tags = await getDistinctTags(200).catch(() => [] as Array<{ tag: string; count: number }>);

  const maxCount = tags[0]?.count ?? 1;

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
          <AppLogo onlyIcon={false} />
          <Button variant="primary" size="md" href={ROUTES.app}>
            <span className="hidden sm:inline">Make your own</span>
            <span className="sm:hidden">Write</span>
            <svg width="11" height="11" fill="none" viewBox="0 0 11 11" aria-hidden>
              <path d="M2 9 9 2M9 2H4.5M9 2v4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-[clamp(20px,3vw,26px)] text-text-primary font-display">Browse by tag</h1>
          <p className="mt-1.5 text-sm text-text-muted">
            Public pages tagged with YAML frontmatter — add <code className="rounded bg-fill-2 px-1 py-0.5 text-xs font-mono">tags: [engineering]</code> to your page to appear here.
          </p>
        </div>

        {tags.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-subtle px-6 py-16 text-center">
            <p className="text-sm text-text-muted">No tags found yet. Publish a page with frontmatter tags to see them here.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map(({ tag, count }) => {
              const weight = Math.ceil((count / maxCount) * 3);
              const sizes = ["text-xs", "text-sm", "text-base"];
              const sizeClass = sizes[Math.min(weight - 1, 2)];
              return (
                <Link
                  key={tag}
                  href={`/tags/${encodeURIComponent(tag)}`}
                  className={[
                    sizeClass,
                    "inline-flex items-center gap-1.5 rounded-pill border border-border-default bg-bg-elevated px-3 py-1.5",
                    "text-text-secondary transition hover:border-accent-soft/40 hover:bg-accent/8 hover:text-accent",
                  ].join(" ")}
                >
                  <span>{tag}</span>
                  <span className="text-2xs text-text-muted/60 tabular-nums">{count}</span>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <footer className="mt-12 border-t border-border-subtle">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <AppLogo onlyIcon={false} />
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <Link href="/explore" className="transition hover:text-text-primary">Explore</Link>
            <Link href="/about" className="transition hover:text-text-primary">About</Link>
            <Link href={ROUTES.app} className="transition hover:text-text-primary">Write</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
