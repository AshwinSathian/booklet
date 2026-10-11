import { Container, PageShell, PageTitle } from "@/components/marketing/primitives";
import { getPagesByTag, type ExploreItem } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageCard } from "../../explore/ExploreClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ tag: string }> };

/** Null for a malformed escape, which is a 404 and not an error. */
function decodeTag(tag: string): string | null {
  try {
    return decodeURIComponent(tag);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  const decoded = decodeTag(tag) ?? "";
  return buildMetadata({
    title: `Pages tagged ${decoded}`,
    description: `Public pages tagged "${decoded}".`,
    pathname: `/tags/${tag}`,
    noIndex: true,
  });
}

export default async function TagPage({ params }: Props) {
  const { tag } = await params;
  const decoded = decodeTag(tag) ?? "";
  if (!decoded.trim()) notFound();
  const pages = await getPagesByTag(decoded).catch(() => [] as ExploreItem[]);

  return (
    <PageShell>
      <Container className="py-14 sm:py-20">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
          <Link href="/tags" className="hover:text-text-primary hover:underline">
            Tags
          </Link>
        </nav>
        <PageTitle
          title={<>Pages tagged &ldquo;{decoded}&rdquo;</>}
          lede={pages.length === 0 ? "No public page has this tag yet." : `${pages.length} ${pages.length === 1 ? "page" : "pages"}.`}
        />
        {pages.length > 0 ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((page) => (
              <PageCard key={page.id} page={page} />
            ))}
          </div>
        ) : null}
      </Container>
    </PageShell>
  );
}
