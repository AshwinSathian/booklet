import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { TemplatePreviewCard } from "@/components/marketing/TemplatePreviewCard";
import { Button } from "@/components/ui/Button";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { TEMPLATES, type Template } from "@/lib/templates";
import type { Metadata } from "next";

export const metadata: Metadata = buildMetadata({
  title: "Free Document Templates",
  description:
    "Free templates for incident reports, ADRs, runbooks, meeting notes, changelogs, and more. Open any template in the Booklet editor and share a clean page in seconds.",
  pathname: "/templates",
});

export default function TemplatesPage() {
  const templatesWithSlug = TEMPLATES.filter(
    (t): t is Template & { slug: string } => Boolean(t.slug)
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Free Document Templates — Booklet",
    description:
      "Free templates for incident reports, ADRs, runbooks, meeting notes, changelogs, and more.",
    url: absoluteUrl("/templates"),
    numberOfItems: templatesWithSlug.length,
    itemListElement: templatesWithSlug.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      url: absoluteUrl(`/templates/${t.slug}`),
      description: t.metaDescription ?? t.description,
    })),
  };

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader ctaLabel="Start writing" ctaTrackLocation="templates_topbar" />

      <main className="mx-auto w-full max-w-4xl px-4 py-12">
        {/* Hero */}
        <div className="mb-10 text-center">
          <h1 className="text-[clamp(24px,4vw,32px)] text-text-primary font-display">
            Free document templates
          </h1>
          <p className="mt-3 text-base text-text-secondary max-w-md mx-auto leading-relaxed">
            Click any template to open it in the editor, fill in your details, and share a clean page in seconds.
          </p>
        </div>

        {/* Template grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {templatesWithSlug.map((template) => (
            <TemplatePreviewCard
              key={template.slug}
              slug={template.slug}
              name={template.name}
              description={template.description}
              content={template.content}
              category={template.category}
            />
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

      <SiteFooter className="mt-8" />
    </div>
  );
}
