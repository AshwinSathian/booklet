import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { Section } from "@/components/marketing/primitives";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { parseToBlocks } from "@/lib/parse";
import { TEMPLATES, type Template } from "@/lib/templates";
import Link from "next/link";

/** The templates the homepage leads with: the six made for engineering documents. */
export const ENGINEERING_TEMPLATE_SLUGS = [
  "incident-report",
  "postmortem",
  "architecture-decision-record",
  "runbook",
  "release-notes",
  "technical-investigation",
];

/** A template as a small page: the top of its real rendered output, with its name under it. */
export function TemplateCard({ template }: { template: Template }) {
  return (
    <Link
      href={`/templates/${template.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border-default bg-bg-elevated hover:border-accent"
    >
      <div aria-hidden inert data-sample className="relative h-44 overflow-hidden border-b border-border-default bg-bg px-5 pt-5">
        <div className="origin-top-left scale-[0.72]" style={{ width: "139%" }}>
          <BlockRenderer blocks={parseToBlocks(template.content.trim()).slice(0, 7)} settings={DEFAULT_SETTINGS} headingOffset={2} />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-bg to-transparent" />
      </div>
      <div className="p-5">
        <h3 className="font-semibold text-text-primary group-hover:underline group-hover:underline-offset-4">{template.name}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{template.description}</p>
      </div>
    </Link>
  );
}

export function TemplateShelf() {
  const templates = ENGINEERING_TEMPLATE_SLUGS.map((slug) => TEMPLATES.find((t) => t.slug === slug)).filter((t): t is Template => !!t);
  return (
    <Section
      eyebrow="Templates"
      title="Start from the structure, not a blank page."
      lede="Each template opens in the editor with its sections and frontmatter in place."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <TemplateCard key={t.slug} template={t} />
        ))}
      </div>
      <p className="mt-8 text-sm">
        <Link href="/templates" className="font-semibold underline decoration-highlight decoration-[3px] underline-offset-[5px] hover:decoration-accent">
          All {TEMPLATES.filter((t) => t.slug).length} templates
        </Link>
      </p>
    </Section>
  );
}
