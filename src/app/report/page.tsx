import { AppLogo } from "@/components/ui/AppLogo";
import { buildMetadata } from "@/lib/seo";
import Link from "next/link";
import type { Metadata } from "next";
import { ReportForm } from "./ReportForm";

export const metadata: Metadata = buildMetadata({
  title: "Report a page",
  description: "Report a published page that breaks the terms of use.",
  pathname: "/report",
  noIndex: true,
});

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { page } = await searchParams;
  const pageId = typeof page === "string" ? page.trim().slice(0, 80) : "";

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <header className="border-b border-border-subtle">
        <div className="mx-auto w-full max-w-2xl px-4 py-3">
          <AppLogo onlyIcon={false} />
        </div>
      </header>
      <main className="flex-1 px-4 py-12">
        <div className="mx-auto flex max-w-md flex-col gap-5">
          <h1 className="text-xl font-medium">Report this page</h1>
          {pageId ? (
            <>
              <p className="text-sm text-text-secondary leading-relaxed">
                You are reporting <span className="font-mono text-text-primary">/p/{pageId}</span>. Reports go to
                the person who runs Booklet. What is and is not allowed is in the{" "}
                <Link href="/terms" className="text-accent hover:underline">
                  terms
                </Link>
                .
              </p>
              <ReportForm pageId={pageId} />
            </>
          ) : (
            <p className="text-sm text-text-secondary leading-relaxed">
              Open the page you want to report and use the &ldquo;Report this page&rdquo; link in its footer.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
