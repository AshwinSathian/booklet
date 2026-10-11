import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { TemplateCard } from "@/components/marketing/home/TemplateShelf";
import { Container, PageShell } from "@/components/marketing/primitives";
import { Button } from "@/components/ui/Button";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { ROUTES } from "@/lib/constants";
import { parseToBlocks } from "@/lib/parse";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { TEMPLATES, getTemplateBySlug } from "@/lib/templates";
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
    title: template.headline ?? template.name,
    description: template.metaDescription ?? template.description,
    pathname: `/templates/${slug}`,
  });
}

export default async function TemplatePage({ params }: Props) {
  const { slug } = await params;
  const template = getTemplateBySlug(slug);
  if (!template) notFound();

  const editorUrl = `${ROUTES.app}?template=${template.slug}`;
  const others = TEMPLATES.filter((t) => t.slug && t.slug !== template.slug && t.category === template.category).slice(0, 3);
  // Drawn by the real renderer, so the preview is the page a reader would get.
  const blocks = parseToBlocks(template.content.trim());

  const steps = [
    { name: "Open the template", text: `Choose "Use this template". The editor opens with the ${template.name} loaded.` },
    { name: "Fill it in", text: "Edit the Markdown. The preview beside it updates as you type." },
    { name: "Publish", text: "Publish and you get a link to send. You do not need an account." },
  ];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: template.headline ?? template.name,
    description: template.metaDescription ?? template.description,
    url: absoluteUrl(`/templates/${slug}`),
    tool: [{ "@type": "HowToTool", name: "Booklet editor" }],
    step: steps.map((step, i) => ({ "@type": "HowToStep", position: i + 1, ...step })),
  };

  return (
    <PageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
          <header className="lg:sticky lg:top-28 lg:self-start">
            {template.category ? (
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">{template.category}</p>
            ) : null}
            <h1 className="mt-3 font-display text-[clamp(2rem,4.2vw,3rem)] font-medium leading-[1.06] tracking-[-0.022em] text-balance">
              {template.name} template
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-text-secondary">{template.metaDescription ?? template.description}</p>
            {template.useCases?.length ? (
              <p className="mt-4 text-sm text-text-muted">For {template.useCases.join(", ").toLowerCase()}.</p>
            ) : null}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button variant="primary" size="xl" href={editorUrl}>
                Use this template
              </Button>
              <span className="text-sm text-text-muted">Free. No account needed.</span>
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
              <BlockRenderer blocks={blocks} settings={DEFAULT_SETTINGS} headingOffset={1} />
            </div>
          </div>
        </div>

        {others.length ? (
          <section className="mt-20 border-t border-border-default pt-12">
            <h2 className="font-display text-2xl font-medium">More {template.category?.toLowerCase()} templates</h2>
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
