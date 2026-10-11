import { DocsSearch } from "@/components/docs/DocsSearch";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { Container, PageShell } from "@/components/marketing/primitives";
import { getDocsTree } from "@/lib/docs";
import type { ReactNode } from "react";

export default function DocsLayout({ children }: { children: ReactNode }) {
  const sections = getDocsTree().map((s) => ({
    id: s.id,
    title: s.title,
    pages: s.pages.map((p) => ({ href: p.href, nav: p.nav })),
  }));

  return (
    <PageShell>
      <Container className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
        <aside className="hidden lg:block">
          <div className="sticky top-16 flex max-h-[calc(100dvh-4rem)] flex-col gap-7 overflow-y-auto py-10 pr-2">
            <DocsSearch />
            <DocsSidebar sections={sections} />
          </div>
        </aside>

        {/* Narrow screens: search, and the same navigation folded away. Works without JavaScript. */}
        <div className="flex flex-col gap-3 pt-6 lg:hidden">
          <DocsSearch />
          <details className="group rounded-lg border border-border-strong bg-bg-elevated">
            <summary className="flex h-10 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
              Docs menu
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden className="group-open:rotate-180">
                <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div className="border-t border-border-default p-4">
              <DocsSidebar sections={sections} />
            </div>
          </details>
        </div>

        <div className="min-w-0 py-10 lg:py-12">{children}</div>
      </Container>
    </PageShell>
  );
}
