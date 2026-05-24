import { AppLogo } from "@/components/ui/AppLogo";
import { Button } from "@/components/ui/Button";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { getFeaturedPages, getRecentPublicPages } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Explore",
  description:
    "Browse recently published pages from the Readable community — incident reports, docs, changelogs, and more.",
  pathname: "/explore",
});

function pageHref(item: { id: string; slug: string | null }) {
  return `/p/${item.slug ?? item.id}`;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function ExplorePage() {
  const [featured, recent] = await Promise.all([
    getFeaturedPages(50),
    getRecentPublicPages(24),
  ]);

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <header className="border-b border-border-subtle bg-bg/85 backdrop-blur-xl sticky top-0 z-20">
        <div className="mx-auto w-full max-w-3xl px-4 h-12 flex items-center justify-between gap-4">
          <Link href="/">
            <AppLogo onlyIcon={false} />
          </Link>
          <Button variant="primary" size="md" href={ROUTES.app}>
            Create a page
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Explore</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Pages from the {APP_NAME} community.
          </p>
        </div>

        {featured.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">Featured</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {featured.map((page) => (
                <Link
                  key={page.id}
                  href={pageHref(page)}
                  className="group relative flex flex-col justify-between rounded-xl border border-accent-soft/30 bg-accent-dim/30 p-4 hover:border-accent-soft/60 hover:bg-accent-dim/50 transition"
                >
                  <div className="absolute top-3 right-3">
                    <span className="rounded-pill bg-accent/10 text-accent text-2xs font-semibold px-2 py-0.5 border border-accent/20">
                      Featured
                    </span>
                  </div>
                  <div className="min-w-0 pr-16">
                    <p className="text-sm font-medium text-text-primary group-hover:text-accent transition truncate">
                      {page.title ?? "Untitled"}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {page.slug ? `/p/${page.slug}` : `/p/${page.id}`}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-2xs text-text-muted">{timeAgo(page.created_at)}</span>
                    <div className="flex items-center gap-1 text-2xs text-text-muted">
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
                        <path d="M1 8C2.5 4.5 5 3 8 3s5.5 1.5 7 5c-1.5 3.5-4 5-7 5S2.5 11.5 1 8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                      {page.view_count.toLocaleString()}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          {(featured.length > 0 || recent.length > 0) && (
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
              Recently Published
            </h2>
          )}

          {recent.length === 0 && featured.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-text-muted text-sm">No published pages yet.</p>
              <div className="mt-4">
                <Button variant="primary" size="md" href={ROUTES.app}>
                  Publish the first one →
                </Button>
              </div>
            </div>
          ) : recent.length === 0 ? (
            <p className="text-sm text-text-muted py-4">
              No recent pages yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recent.map((page) => (
                <Link
                  key={page.id}
                  href={pageHref(page)}
                  className="group flex flex-col justify-between rounded-xl border border-border-subtle p-4 hover:border-accent-soft/40 hover:bg-fill-1 transition"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary group-hover:text-accent transition truncate">
                      {page.title ?? "Untitled"}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {page.slug ? `/p/${page.slug}` : `/p/${page.id}`}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-2xs text-text-muted">{timeAgo(page.created_at)}</span>
                    <div className="flex items-center gap-1 text-2xs text-text-muted">
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
                        <path d="M1 8C2.5 4.5 5 3 8 3s5.5 1.5 7 5c-1.5 3.5-4 5-7 5S2.5 11.5 1 8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                      {page.view_count.toLocaleString()}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="mt-12 rounded-xl border border-border-subtle bg-bg-elevated px-6 py-8 text-center">
          <p className="text-sm font-semibold text-text-primary mb-1">
            Share your own page
          </p>
          <p className="text-xs text-text-muted mb-4">
            Write Markdown, hit Publish — your page appears here and anywhere you share the link.
          </p>
          <Button variant="primary" size="md" href={ROUTES.app}>
            Start writing
            <svg width="11" height="11" fill="none" viewBox="0 0 11 11" aria-hidden>
              <path d="M2 9 9 2M9 2H4.5M9 2v4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
        </div>
      </main>

      <footer className="mt-8 border-t border-border-subtle">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
          <div className="flex items-center gap-2">
            <AppLogo onlyIcon={true} />
            <span>{APP_NAME} — Beautiful markdown pages, instantly.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/templates" className="hover:text-text-primary transition">Templates</Link>
            <Link href="/pricing" className="hover:text-text-primary transition">Pricing</Link>
            <Link href={ROUTES.app} className="text-accent hover:text-accent-soft transition">Start writing →</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
