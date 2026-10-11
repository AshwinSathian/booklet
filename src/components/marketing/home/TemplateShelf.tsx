import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { Section } from "@/components/marketing/primitives";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { parseToBlocks } from "@/lib/parse";
import { TEMPLATES, type Template } from "@/lib/templates";
import Link from "next/link";

/** The templates the homepage leads with: the six made for engineering documents. */
// The six document types Booklet is built for, in the order a team meets them.
export const ENGINEERING_TEMPLATE_SLUGS = ["incident-report", "postmortem", "architecture-decision-record", "rfc", "runbook", "release-notes"];

/**
 * A template as a small page: the top of its body as the real renderer draws
 * it, with its name under it. The whole card is one link, made by stretching the title's
 * link over the card: the preview can contain links of its own, and a link
 * cannot sit inside another.
 */
export function TemplateCard({ template }: { template: Template }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-border-default bg-bg-elevated hover:border-accent">
      <div aria-hidden inert data-sample className="relative h-36 overflow-hidden border-b border-border-default bg-bg px-5 pt-5">
        <div className="origin-top-left scale-[0.72]" style={{ width: "139%" }}>
          <BlockRenderer blocks={parseToBlocks(template.content.trim()).slice(0, 7)} settings={DEFAULT_SETTINGS} headingOffset={2} />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-bg to-transparent" />
      </div>
      <div className="p-5">
        <h3 className="font-semibold text-text-primary">
          <Link href={`/templates/${template.slug}`} className="after:absolute after:inset-0 group-hover:underline group-hover:underline-offset-4">
            {template.name}
          </Link>
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{template.description}</p>
      </div>
    </article>
  );
}

export function TemplateShelf() {
  const templates = ENGINEERING_TEMPLATE_SLUGS.map((slug) => TEMPLATES.find((t) => t.slug === slug)).filter((t): t is Template => !!t);
  return (
    <Section
      eyebrow="Templates"
      title="Start from a template"
      lede="A template opens in the editor with its sections and frontmatter in place. These six are the same ones the CLI and the MCP prompts use."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <TemplateCard key={t.slug} template={t} />
        ))}
      </div>
      <p className="mt-8 text-sm">
        <Link href="/templates" className="font-semibold underline decoration-highlight decoration-[3px] underline-offset-[5px] hover:decoration-accent">
          All {TEMPLATES.length} templates
        </Link>
      </p>
    </Section>
  );
}
