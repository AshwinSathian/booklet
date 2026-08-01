import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { AppLogo } from "@/components/ui/AppLogo";
import { Button } from "@/components/ui/Button";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { parseToBlocks } from "@/lib/parse";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { TEMPLATES, getTemplateBySlug } from "@/lib/templates";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const runtime = "nodejs";

export async function generateStaticParams() {
  return TEMPLATES.filter((t) => t.slug).map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const template = getTemplateBySlug(slug);
  if (!template) return buildMetadata({ title: "Not found", noIndex: true });

  return buildMetadata({
    title: template.headline ?? template.name,
    description: template.metaDescription ?? template.description,
    pathname: `/templates/${slug}`,
  });
}

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const template = getTemplateBySlug(slug);
  if (!template) notFound();

  const editorUrl = `${ROUTES.app}?template=${template.slug}`;
  const otherTemplates = TEMPLATES.filter((t) => t.slug && t.slug !== slug).slice(0, 4);
  // Rendered through the real block pipeline (not a raw-markdown <pre>) so the
  // preview actually demonstrates the typeset output — the thing that
  // differentiates Booklet from a plain .md file — rather than the source.
  const previewBlocks = parseToBlocks(template.content.trim());

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: template.headline ?? template.name,
    description: template.metaDescription ?? template.description,
    url: absoluteUrl(`/templates/${slug}`),
    tool: [{ "@type": "HowToTool", name: "Booklet editor" }],
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Open the template",
        text: `Click "Use this template" — the editor opens with the ${template.name} pre-loaded.`,
        url: absoluteUrl(`/templates/${slug}`),
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Fill in your details",
        text: "Edit the Markdown directly. The preview updates in real time as you type.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Publish and share",
        text: "Hit Publish and get a clean, shareable link in seconds. No account needed.",
      },
    ],
  };

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="border-b border-border-subtle bg-bg/85 backdrop-blur-xl sticky top-0 z-20">
        <div className="mx-auto w-full max-w-3xl px-4 h-12 flex items-center justify-between gap-4">
          <AppLogo onlyIcon={false} />
          <div className="flex items-center gap-2">
            <Link
              href="/templates"
              className="hidden sm:inline text-xs text-text-muted hover:text-text-primary transition"
            >
              All templates
            </Link>
            <Button variant="primary" size="md" href={editorUrl}>
              Use this template
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-12">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-xs text-text-muted">
          <Link href="/" className="hover:text-text-primary transition">Home</Link>
          <span>/</span>
          <Link href="/templates" className="hover:text-text-primary transition">Templates</Link>
          <span>/</span>
          <span className="text-text-secondary">{template.name}</span>
        </nav>

        {/* Header */}
        <div className="mb-10">
          {template.category && (
            <span className="mb-3 inline-block rounded-pill border border-border-subtle px-2.5 py-0.5 text-2xs font-medium text-text-muted uppercase tracking-wider">
              {template.category}
            </span>
          )}
          <h1 className="text-[clamp(24px,4vw,32px)] text-text-primary font-display">
            {template.headline ?? template.name}
          </h1>
          <p className="mt-3 text-base text-text-secondary leading-relaxed max-w-xl">
            {template.metaDescription ?? template.description}
          </p>

          {template.useCases && template.useCases.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {template.useCases.map((uc) => (
                <span
                  key={uc}
                  className="rounded-pill border border-border-subtle px-2.5 py-1 text-xs text-text-muted"
                >
                  {uc}
                </span>
              ))}
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            <Button variant="primary" size="md" href={editorUrl}>
              Use this template
              <svg width="11" height="11" fill="none" viewBox="0 0 11 11" aria-hidden>
                <path d="M2 9 9 2M9 2H4.5M9 2v4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
            <span className="text-xs text-text-muted">Free · No account required</span>
          </div>
        </div>

        {/* Template preview — rendered exactly as the published page would look */}
        <div className="rounded-xl border border-border-subtle bg-bg overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-subtle bg-bg-elevated px-4 py-2.5">
            <span className="text-xs font-medium text-text-muted">What readers see</span>
            <Button variant="ghost" size="sm" href={editorUrl}>
              Open in editor →
            </Button>
          </div>
          <div className="max-h-128 overflow-y-auto px-5 py-6 sm:px-8">
            <BlockRenderer blocks={previewBlocks} settings={DEFAULT_SETTINGS} />
          </div>
        </div>

        {/* How it works */}
        <section className="mt-14">
          <h2 className="text-lg mb-6">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                step: "1",
                title: "Open the template",
                body: `Click "Use this template" — the editor opens with the ${template.name} pre-loaded.`,
              },
              {
                step: "2",
                title: "Fill in your details",
                body: "Edit the Markdown directly. The preview updates in real time as you type.",
              },
              {
                step: "3",
                title: "Publish and share",
                body: "Hit Publish and get a clean, shareable link in seconds. No account needed.",
              },
            ].map(({ step, title, body }) => (
              <div key={step} className="rounded-xl border border-border-subtle p-5 bg-bg">
                <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                  {step}
                </div>
                <p className="text-sm font-semibold text-text-primary mb-1">{title}</p>
                <p className="text-xs text-text-secondary leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA banner */}
        <section className="mt-10 rounded-xl border border-accent/20 bg-accent/5 px-6 py-8 text-center">
          <p className="text-sm font-semibold text-text-primary mb-1">
            Ready to use this template?
          </p>
          <p className="text-xs text-text-muted mb-4">
            Opens in the {APP_NAME} editor · Free · No account required
          </p>
          <Button variant="primary" size="md" href={editorUrl}>
            Use {template.name} template
          </Button>
        </section>

        {/* Other templates */}
        {otherTemplates.length > 0 && (
          <section className="mt-14">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base">More templates</h2>
              <Link href="/templates" className="text-xs text-accent hover:text-accent-soft transition">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {otherTemplates.map((t) => (
                <Link
                  key={t.slug}
                  href={`/templates/${t.slug}`}
                  className="group flex items-start justify-between gap-3 rounded-xl border border-border-subtle p-4 hover:border-accent-soft/40 hover:bg-fill-1 transition"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary group-hover:text-accent transition">{t.name}</p>
                    <p className="mt-0.5 text-xs text-text-muted truncate">{t.description}</p>
                  </div>
                  <svg width="12" height="12" fill="none" viewBox="0 0 12 12" className="mt-0.5 shrink-0 text-text-muted group-hover:text-accent transition" aria-hidden>
                    <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="mt-16 border-t border-border-subtle">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
          <div className="flex items-center gap-2">
          <AppLogo onlyIcon={true} />
            <span>{APP_NAME} — Beautiful markdown pages, instantly.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/templates" className="hover:text-text-primary transition">Templates</Link>
            <Link href="/explore" className="hover:text-text-primary transition">Explore</Link>
            <Link href={ROUTES.app} className="text-accent hover:text-accent-soft transition">Start writing →</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
