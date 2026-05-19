import { AppLogo } from "@/components/ui/AppLogo";
import { Button } from "@/components/ui/Button";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import { TEMPLATES } from "@/lib/templates";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = buildMetadata({
  title: "Free Document Templates",
  description:
    "Free templates for incident reports, ADRs, runbooks, meeting notes, changelogs, and more. Open any template in the Readable editor and share a clean page in seconds.",
  pathname: "/templates",
});

const CATEGORIES = ["All", "Engineering", "Product", "General"];

export default function TemplatesPage() {
  const templatesWithSlug = TEMPLATES.filter((t) => t.slug);

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <header className="border-b border-border-subtle bg-bg/85 backdrop-blur-xl sticky top-0 z-20">
        <div className="mx-auto w-full max-w-3xl px-4 h-12 flex items-center justify-between gap-4">
          <Link href="/">
            <AppLogo onlyIcon={false} />
          </Link>
          <Button variant="primary" size="md" href={ROUTES.app}>
            Start writing
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-12">
        {/* Hero */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">
            Free document templates
          </h1>
          <p className="mt-3 text-base text-text-secondary max-w-md mx-auto leading-relaxed">
            Click any template to open it in the editor, fill in your details, and share a clean page in seconds.
          </p>
        </div>

        {/* Template grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {templatesWithSlug.map((template) => (
            <Link
              key={template.slug}
              href={`/templates/${template.slug}`}
              className="group flex flex-col justify-between rounded-xl border border-border-subtle p-5 hover:border-accent-soft/40 hover:bg-fill-1 transition"
            >
              <div>
                {template.category && (
                  <span className="mb-2 inline-block text-2xs font-medium uppercase tracking-wider text-text-muted">
                    {template.category}
                  </span>
                )}
                <p className="text-sm font-semibold text-text-primary group-hover:text-accent transition">
                  {template.name}
                </p>
                <p className="mt-1 text-xs text-text-muted leading-relaxed">
                  {template.description}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-2xs text-text-muted">Free · No signup</span>
                <span className="text-xs text-accent opacity-0 group-hover:opacity-100 transition">
                  Use template →
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-xl border border-border-subtle bg-bg-elevated px-6 py-8 text-center">
          <p className="text-sm font-semibold text-text-primary mb-1">
            Don&apos;t see what you need?
          </p>
          <p className="text-xs text-text-muted mb-4">
            Start from scratch in the {APP_NAME} editor — it supports any Markdown document.
          </p>
          <Button variant="primary" size="md" href={ROUTES.app}>
            Open editor
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
            <Link href="/pricing" className="hover:text-text-primary transition">Pricing</Link>
            <Link href={ROUTES.app} className="text-accent hover:text-accent-soft transition">Start writing →</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
