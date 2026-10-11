import { LegacyHashRedirect } from "@/components/docs/LegacyHashRedirect";
import { Button } from "@/components/ui/Button";
import { getDocsTree } from "@/lib/docs";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = buildMetadata({
  title: "Docs",
  description:
    "How to publish with Booklet: a quickstart, guides for the CLI, GitHub, MCP clients and team spaces, task recipes, and the API reference.",
  pathname: "/docs",
});

export default function DocsHome() {
  const tree = getDocsTree();
  return (
    <>
      <LegacyHashRedirect />
      <header className="max-w-2xl">
        <h1 className="font-display text-[clamp(2.25rem,5vw,3.25rem)] font-medium leading-[1.05] tracking-[-0.025em]">Docs</h1>
        <p className="mt-4 text-lg leading-relaxed text-text-secondary">
          Booklet publishes Markdown as pages. These docs cover every way to publish, the features made for engineering
          documents, and the API.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button variant="primary" size="lg" href="/docs/quickstart">
            Start with the quickstart
          </Button>
          <Button variant="secondary" size="lg" href="/docs/reference/api">
            API reference
          </Button>
        </div>
      </header>

      {tree
        .filter((section) => section.id !== "start")
        .map((section) => (
          <section key={section.id} id={section.id} className="mt-16 scroll-mt-24">
            <h2 className="font-display text-2xl font-medium">{section.title}</h2>
            <p className="mt-1.5 text-text-secondary">{section.blurb}</p>
            <ul className="mt-6 grid gap-x-10 border-t border-border-default sm:grid-cols-2">
              {section.pages.map((page) => (
                <li key={page.href} className="border-b border-border-default">
                  <Link href={page.href} className="group block py-4">
                    <span className="font-semibold text-text-primary group-hover:underline group-hover:underline-offset-4">{page.title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-text-secondary">{page.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </>
  );
}
