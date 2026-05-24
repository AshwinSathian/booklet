import { AppLogo } from "@/components/ui/AppLogo";
import { Button } from "@/components/ui/Button";
import { getPagesByTag } from "@/lib/db";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import type { ExploreItem } from "@/lib/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  return buildMetadata({
    title: `#${decoded} — ${APP_NAME}`,
    description: `Public pages tagged "${decoded}" on ${APP_NAME}.`,
    pathname: `/tags/${tag}`,
  });
}

function pageHref(item: ExploreItem) {
  return `/p/${item.slug ?? item.id}`;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);

  if (!decoded.trim()) notFound();

  const pages = await getPagesByTag(decoded).catch(() => [] as ExploreItem[]);

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AppLogo onlyIcon={false} />
            <span className="text-text-muted/40" aria-hidden>/</span>
            <Link
              href="/tags"
              className="text-sm text-text-muted transition hover:text-text-primary"
            >
              Tags
            </Link>
            <span className="text-text-muted/40" aria-hidden>/</span>
            <span className="text-sm text-text-primary font-medium">{decoded}</span>
          </div>
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
          <div className="flex items-center gap-2 mb-2">
            <span className="rounded-pill border border-accent/30 bg-accent/8 px-2.5 py-0.5 text-xs font-semibold text-accent">
              #{decoded}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            Pages tagged &ldquo;{decoded}&rdquo;
          </h1>
          <p className="mt-1.5 text-sm text-text-muted">
            {pages.length === 0
              ? "No public pages with this tag yet."
              : `${pages.length} ${pages.length === 1 ? "page" : "pages"}`}
          </p>
        </div>

        {pages.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pages.map((page) => (
              <Link
                key={page.id}
                href={pageHref(page)}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col justify-between rounded-xl border border-border-subtle bg-bg-elevated p-4 transition hover:border-accent-soft/30 hover:bg-fill-1"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary group-hover:text-accent transition line-clamp-2 leading-snug mb-1">
                    {page.title ?? "Untitled"}
                  </p>
                  <p className="text-2xs text-text-muted/60 font-mono truncate">
                    {page.slug ? `/p/${page.slug}` : `/p/${page.id}`}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-3 gap-2">
                  <span className="text-2xs text-text-muted/50">{timeAgo(page.created_at)}</span>
                  <span className="text-2xs text-text-muted/50 tabular-nums">
                    {page.view_count === 1 ? "1 view" : `${page.view_count.toLocaleString()} views`}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-outline px-6 py-16 text-center">
            <p className="text-sm text-text-muted mb-4">No public pages with this tag yet.</p>
            <p className="text-xs text-text-muted/70">
              Add <code className="rounded bg-fill-2 px-1 py-0.5 font-mono">tags: [{decoded}]</code> to your page&apos;s YAML frontmatter to appear here.
            </p>
          </div>
        )}

        <div className="mt-8">
          <Link
            href="/tags"
            className="inline-flex items-center gap-1.5 text-sm text-text-muted transition hover:text-text-primary"
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 16 16" aria-hidden>
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            All tags
          </Link>
        </div>
      </main>

      <footer className="mt-12 border-t border-border-subtle">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <AppLogo onlyIcon={false} />
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <Link href="/explore" className="transition hover:text-text-primary">Explore</Link>
            <Link href="/tags" className="transition hover:text-text-primary">Tags</Link>
            <Link href={ROUTES.app} className="transition hover:text-text-primary">Write</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export async function generateStaticParams() {
  return [];
}
