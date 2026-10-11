import { Container, PageShell, PageTitle } from "@/components/marketing/primitives";
import { getRecentPublicPages } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { ExploreClient } from "./ExploreClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Not indexed, and not linked from the site's navigation: this is a list of
// whatever authors chose to make public, not an editorial page.
export const metadata: Metadata = buildMetadata({
  title: "Public pages",
  description: "Pages whose authors set them to Public, newest first.",
  pathname: "/explore",
  noIndex: true,
});

export default async function ExplorePage() {
  const pages = await getRecentPublicPages(96);
  return (
    <PageShell>
      <Container className="py-14 sm:py-20">
        <PageTitle
          title="Public pages"
          lede="A page is listed here when its author sets it to Public. New pages are unlisted, so most never appear."
        />
        <div className="mt-10">
          <ExploreClient pages={pages} />
        </div>
      </Container>
    </PageShell>
  );
}
