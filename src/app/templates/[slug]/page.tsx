import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { TemplateCard } from "@/components/marketing/home/TemplateShelf";
import { Container, PageShell } from "@/components/marketing/primitives";
import { Button } from "@/components/ui/Button";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { ROUTES } from "@/lib/constants";
import { parseToBlocks } from "@/lib/parse";
import { breadcrumbJsonLd, buildMetadata, jsonLdScript } from "@/lib/seo";
import { TEMPLATES, getTemplateBySlug, templateMeta } from "@/lib/templates";
import { DocHeaderStrip } from "@/components/share/DocHeaderStrip";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const runtime = "nodejs";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const template = getTemplateBySlug(slug);
  if (!template) return buildMetadata({ title: "Not found", noIndex: true });
  return buildMetadata({
    title: `${template.name} template`,
    description: template.metaDescription,
    pathname: `/templates/${slug}`,
    image: `/og/templates/${slug}.png`,
    imageAlt: `${template.name} template`,
  });
}

export default async function TemplatePage({ params }: Props) {
  const { slug } = await params;
  const template = getTemplateBySlug(slug);
  if (!template) notFound();

  const editorUrl = `${ROUTES.app}?template=${template.slug}`;
  const others = TEMPLATES.filter((t) => t.slug !== template.slug && t.category === template.category).slice(0, 3);
  // Drawn by the real renderer, so the preview is the page a reader would get.
  const blocks = parseToBlocks(template.content.trim());

  const title = `${template.name} template`;
  // The trail a reader sees above the title, for a search result to show too.
  const jsonLd = jsonLdScript([breadcrumbJsonLd([["Templates", "/templates"], [title, `/templates/${slug}`]])]);

  return (
    <PageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <Container className="py-12 sm:py-16">
        <nav aria-label="Breadcrumb" className="text-sm text-text-muted">
          <Link href="/templates" className="hover:text-text-primary hover:underline">
            Templates
          </Link>
          <span aria-hidden className="mx-2">
            /
          </span>
          <span className="text-text-secondary">{template.name}</span>
        </nav>

        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
          <header className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">{template.category}</p>
            <h1 className="mt-3 font-display text-[clamp(2rem,4.2vw,3rem)] font-medium leading-[1.06] tracking-[-0.022em] text-balance">
              {template.name} template
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-text-secondary">{template.metaDescription}</p>
            {template.audience ? <p className="mt-4 text-sm text-text-muted">{template.audience}</p> : null}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button variant="primary" size="xl" href={editorUrl}>
                Use this template
              </Button>
              <span className="text-sm text-text-muted">Opens in the editor. No account needed.</span>
            </div>
          </header>

          <div>
            <p className="mb-3 text-sm font-medium text-text-secondary">What a reader gets</p>
            <div
              tabIndex={0}
              role="region"
              aria-label={`${template.name} template, rendered`}
              data-sample
              className="max-h-[42rem] overflow-y-auto rounded-xl border border-border-strong bg-bg-elevated px-6 py-7 sm:px-9"
            >
              {/* The strip a published page gets from the frontmatter the editor adds to this template. */}
              <DocHeaderStrip meta={templateMeta(template)} userId={null} />
              <BlockRenderer blocks={blocks} settings={DEFAULT_SETTINGS} headingOffset={1} />
            </div>
          </div>
        </div>

        {others.length ? (
          <section className="mt-20 border-t border-border-default pt-12">
            <h2 className="font-display text-2xl font-medium">More {template.category.toLowerCase()} templates</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((t) => (
                <TemplateCard key={t.slug} template={t} />
              ))}
            </div>
          </section>
        ) : null}
      </Container>
    </PageShell>
  );
}
