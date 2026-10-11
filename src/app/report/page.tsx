import { Container, PageShell } from "@/components/marketing/primitives";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { ReportForm } from "./ReportForm";

export const metadata: Metadata = buildMetadata({
  title: "Report a page",
  description: "Report a published page that breaks the terms of service.",
  pathname: "/report",
  noIndex: true,
});

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const { page } = await searchParams;
  const pageId = typeof page === "string" ? page.trim().slice(0, 80) : "";

  return (
    <PageShell>
      <Container className="py-14 sm:py-20">
        <div className="max-w-md">
          <h1 className="font-display text-4xl font-medium tracking-[-0.02em]">Report this page</h1>
          {pageId ? (
            <>
              <p className="prose-typeset mt-4 leading-relaxed text-text-secondary">
                You are reporting <span className="font-mono text-text-primary">/p/{pageId}</span>. Reports go to the
                person who runs Booklet. What is and is not allowed is in the <Link href="/terms">terms</Link>.
              </p>
              <div className="mt-6">
                <ReportForm pageId={pageId} />
              </div>
            </>
          ) : (
            <p className="mt-4 leading-relaxed text-text-secondary">
              Open the page you want to report and use the &ldquo;Report this page&rdquo; link in its footer.
            </p>
          )}
        </div>
      </Container>
    </PageShell>
  );
}
