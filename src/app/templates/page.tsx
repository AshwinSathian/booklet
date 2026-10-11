import { ENGINEERING_TEMPLATE_SLUGS, TemplateCard } from "@/components/marketing/home/TemplateShelf";
import { Container, PageShell, PageTitle } from "@/components/marketing/primitives";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { TEMPLATES, type Template } from "@/lib/templates";
import type { Metadata } from "next";

export const metadata: Metadata = buildMetadata({
  title: "Templates for engineering documents",
  description:
    "Free templates for incident reports, postmortems, ADRs, runbooks, release notes and more. Open one in the Booklet editor, fill it in and publish it as a page.",
  pathname: "/templates",
});

export default function TemplatesPage() {
  const all = TEMPLATES.filter((t): t is Template & { slug: string } => Boolean(t.slug));
  const engineering = ENGINEERING_TEMPLATE_SLUGS.map((slug) => all.find((t) => t.slug === slug)).filter((t) => !!t);
  const other = all.filter((t) => !ENGINEERING_TEMPLATE_SLUGS.includes(t.slug));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Booklet document templates",
    url: absoluteUrl("/templates"),
    numberOfItems: all.length,
    itemListElement: [...engineering, ...other].map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      url: absoluteUrl(`/templates/${t.slug}`),
      description: t.metaDescription ?? t.description,
    })),
  };

  return (
    <PageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Container className="py-14 sm:py-20">
        <PageTitle
          eyebrow="Templates"
          title="Start from the structure."
          lede="Pick a template and the editor opens with its sections and frontmatter in place. Fill it in and publish. No account needed."
        />

        <section className="mt-14">
          <h2 className="font-display text-2xl font-medium">Engineering documents</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {engineering.map((t) => (
              <TemplateCard key={t.slug} template={t} />
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-2xl font-medium">Other templates</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {other.map((t) => (
              <TemplateCard key={t.slug} template={t} />
            ))}
          </div>
        </section>
      </Container>
    </PageShell>
  );
}
