import { DocsBody } from "@/components/docs/DocsBody";
import { LegacyHashRedirect } from "@/components/docs/LegacyHashRedirect";
import { CopyButton } from "@/components/marketing/CopyButton";
import { getDocPage, getDocsTree, getNeighbours } from "@/lib/docs";
import { parseToBlocks } from "@/lib/parse";
import { buildMetadata } from "@/lib/seo";
import { buildToc } from "@/lib/toc";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = getDocPage((await params).slug);
  if (!page) return buildMetadata({ title: "Not found", noIndex: true });
  return buildMetadata({ title: page.title, description: page.description, pathname: page.href });
}

export default async function DocPageRoute({ params }: Props) {
  const page = getDocPage((await params).slug);
  if (!page) notFound();

  const blocks = parseToBlocks(page.body);
  const { toc, anchorMap } = buildToc(blocks);
  const headings = toc.filter((t) => t.level === 2);
  const { prev, next } = getNeighbours(page);
  const section = getDocsTree().find((s) => s.id === page.section)!;

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_13rem] xl:gap-12">
      <article className="min-w-0 max-w-3xl">
        {page.href === "/docs/reference/api" ? <LegacyHashRedirect /> : null}
        <header className="border-b border-border-default pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">{section.title}</p>
          <h1 className="mt-3 font-display text-[clamp(2rem,4.4vw,2.875rem)] font-medium leading-[1.08] tracking-[-0.022em] text-balance">
            {page.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-text-secondary">{page.description}</p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <CopyButton text={page.raw} label="Copy as Markdown" />
            <a
              href={`${page.href}.md`}
              className="rounded-md border border-border-strong bg-bg-elevated px-2.5 py-1 text-xs font-medium text-text-primary hover:border-accent"
            >
              View as Markdown
            </a>
          </div>
        </header>

        {headings.length > 1 ? (
          <details className="group mt-6 rounded-lg border border-border-default xl:hidden">
            <summary className="flex h-10 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
              On this page
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden className="group-open:rotate-180">
                <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <ul className="border-t border-border-default px-3 py-2 text-sm">
              {headings.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`} className="block py-1.5 text-text-secondary hover:text-text-primary">
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <div className="docs-body mt-8">
          <DocsBody blocks={blocks} headingAnchors={anchorMap} />
        </div>

        <nav aria-label="Previous and next page" className="mt-16 grid gap-4 border-t border-border-default pt-8 sm:grid-cols-2">
          {prev ? (
            <Link href={prev.href} className="group rounded-xl border border-border-default bg-bg-elevated p-4 hover:border-accent">
              <span className="text-xs text-text-muted">Previous</span>
              <span className="mt-1 block font-semibold">{prev.nav}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={next.href} className="group rounded-xl border border-border-default bg-bg-elevated p-4 text-right hover:border-accent">
              <span className="text-xs text-text-muted">Next</span>
              <span className="mt-1 block font-semibold">{next.nav}</span>
            </Link>
          ) : null}
        </nav>
      </article>

      {headings.length > 1 ? (
        <aside className="hidden xl:block">
          <nav aria-label="On this page" className="sticky top-28 text-sm">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">On this page</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {headings.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`} className="text-text-secondary hover:text-text-primary hover:underline">
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      ) : null}
    </div>
  );
}
