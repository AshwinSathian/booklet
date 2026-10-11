"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SidebarSection = { id: string; title: string; pages: Array<{ href: string; nav: string }> };

/** The docs navigation. Rendered twice by the layout: as a column on wide screens, inside a <details> on narrow ones. */
export function DocsSidebar({ sections }: { sections: SidebarSection[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Docs" className="flex flex-col gap-7 text-sm">
      {sections.map((section) => (
        <div key={section.id}>
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">{section.title}</h2>
          <ul className="mt-3 flex flex-col border-l border-border-default">
            {section.pages.map((page) => {
              const current = pathname === page.href;
              return (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    aria-current={current ? "page" : undefined}
                    className={
                      current
                        ? "-ml-px block border-l-2 border-accent py-1.5 pl-4 font-semibold text-text-primary"
                        : "-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-text-secondary hover:border-border-strong hover:text-text-primary"
                    }
                  >
                    {page.nav}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
