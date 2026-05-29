import { AppLogo } from "@/components/ui/AppLogo";
import { Button } from "@/components/ui/Button";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { getFeaturedPages, getRecentPublicPages } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { ExploreClient } from "./ExploreClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Explore",
  description:
    "Browse recently published pages from the Readable community — incident reports, docs, changelogs, and more.",
  pathname: "/explore",
});

export default async function ExplorePage() {
  const [featured, recent] = await Promise.all([
    getFeaturedPages(50),
    getRecentPublicPages(96),
  ]);

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <header className="border-b border-border-subtle bg-bg/85 backdrop-blur-xl sticky top-0 z-20">
        <div className="mx-auto w-full max-w-4xl px-4 h-12 flex items-center justify-between gap-4">
          <Link href="/">
            <AppLogo onlyIcon={false} />
          </Link>
          <Button variant="primary" size="md" href={ROUTES.app}>
            Create a page
          </Button>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-[clamp(22px,3vw,28px)]">Explore</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Pages from the {APP_NAME} community.
          </p>
        </div>

        <ExploreClient featured={featured} recent={recent} />

        <div className="mt-16 rounded-2xl border border-border-subtle bg-bg-elevated px-6 py-10 text-center">
          <p className="text-base font-semibold text-text-primary mb-1.5">
            Share something worth reading
          </p>
          <p className="text-sm text-text-muted mb-5 max-w-xs mx-auto">
            Write Markdown, hit Publish — your page appears here instantly.
          </p>
          <Button variant="primary" size="lg" href={ROUTES.app}>
            Start writing
            <svg width="11" height="11" fill="none" viewBox="0 0 11 11" aria-hidden>
              <path d="M2 9 9 2M9 2H4.5M9 2v4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
        </div>
      </main>

      <footer className="mt-8 border-t border-border-subtle">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
          <div className="flex items-center gap-2">
            <AppLogo onlyIcon={true} />
            <span>{APP_NAME} — Beautiful markdown pages, instantly.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/templates" className="hover:text-text-primary transition">Templates</Link>
            <Link href="/about" className="hover:text-text-primary transition">About</Link>
            <Link href={ROUTES.app} className="text-accent hover:text-accent-soft transition">Start writing →</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
