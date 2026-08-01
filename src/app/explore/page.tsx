import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Button } from "@/components/ui/Button";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { getFeaturedPages, getRecentPublicPages } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { ExploreClient } from "./ExploreClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Explore",
  description:
    "Browse recently published pages from the Booklet community — incident reports, docs, changelogs, and more.",
  pathname: "/explore",
});

export default async function ExplorePage() {
  const [featured, recent] = await Promise.all([
    getFeaturedPages(50),
    getRecentPublicPages(96),
  ]);

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <SiteHeader ctaLabel="Create a page" ctaTrackLocation="explore_topbar" />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-[clamp(22px,3vw,28px)] font-display">Explore</h1>
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

      <SiteFooter className="mt-8" />
    </div>
  );
}
