import { PageCard } from "@/app/explore/ExploreClient";
import { Container, PageShell, PageTitle } from "@/components/marketing/primitives";
import { getCollectionRecord, getPagesByCollection } from "@/lib/db";
import { APP_NAME } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import type { ExploreItem } from "@/lib/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const collection = await getCollectionRecord(id).catch(() => null);
  if (!collection) {
    return buildMetadata({ title: "Folder not found", noIndex: true });
  }
  return buildMetadata({
    title: collection.name,
    description: `Public pages in the ${collection.name} collection on ${APP_NAME}.`,
    pathname: `/c/${id}`,
    // An empty list is not worth a place in a search index.
    noIndex: !(await getPagesByCollection(id).catch(() => [])).length,
  });
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [collection, pages] = await Promise.all([
    getCollectionRecord(id).catch(() => null),
    getPagesByCollection(id).catch(() => [] as ExploreItem[]),
  ]);

  if (!collection) notFound();

  return (
    <PageShell>
      <Container className="py-14 sm:py-20">
        <PageTitle
          eyebrow={collection.is_team_space ? "Team space" : "Collection"}
          title={collection.name}
          lede={pages.length > 0 ? `${pages.length} public ${pages.length === 1 ? "page" : "pages"}` : undefined}
        />
        {pages.length > 0 ? (
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((page) => (
              <PageCard key={page.id} page={page} />
            ))}
          </div>
        ) : (
          <p className="mt-6 text-lg text-text-secondary">This folder has no public pages yet.</p>
        )}
      </Container>
    </PageShell>
  );
}

export async function generateStaticParams() {
  return [];
}
