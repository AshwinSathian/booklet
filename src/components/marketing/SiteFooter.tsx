import { AppLogo } from "@/components/ui/AppLogo";
import { APP_NAME, REPO_URL, ROUTES } from "@/lib/constants";
import Link from "next/link";

// Public status page of the external uptime monitor. Inlined at build time;
// the link is left out when it is unset (local dev, CI).
const STATUS_PAGE_URL = process.env.NEXT_PUBLIC_STATUS_PAGE_URL?.trim() || null;

type FooterLink = { href: string; label: string; external?: boolean };

const COLUMNS: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: "Product",
    links: [
      { href: ROUTES.app, label: "Editor" },
      { href: ROUTES.templates, label: "Templates" },
      { href: ROUTES.pricing, label: "Pricing" },
      { href: ROUTES.changelog, label: "Changelog" },
    ],
  },
  {
    title: "Docs",
    links: [
      { href: "/docs/quickstart", label: "Quickstart" },
      { href: "/docs#guides", label: "Guides" },
      { href: "/docs#recipes", label: "Recipes" },
      { href: "/docs/reference/api", label: "API reference" },
    ],
  },
  {
    title: "Project",
    links: [
      { href: "/about", label: "About" },
      { href: "/trust", label: "Trust" },
      // AGPL-3.0 section 13: users of the hosted app are offered its source.
      { href: REPO_URL, label: "Source", external: true },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      ...(STATUS_PAGE_URL ? [{ href: STATUS_PAGE_URL, label: "Status", external: true }] : []),
    ],
  },
];

/** The one footer of every marketing and docs page. */
export function SiteFooter() {
  return (
    <footer data-site-footer className="border-t border-border-default print:hidden">
      <div className="mx-auto grid w-full max-w-[72rem] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="flex flex-col items-start gap-4">
          <AppLogo />
          <p className="max-w-xs text-sm leading-relaxed text-text-secondary">
            Incident reports, ADRs, RFCs and runbooks, written in Markdown and published as pages.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">{column.title}</h2>
            <ul className="mt-4 flex flex-col gap-2.5 text-sm">
              {column.links.map((link) => (
                <li key={link.href}>
                  {link.external ? (
                    <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-text-secondary hover:text-text-primary hover:underline">
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className="text-text-secondary hover:text-text-primary hover:underline">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border-subtle">
        <p className="mx-auto w-full max-w-[72rem] px-5 py-6 text-xs text-text-muted sm:px-8">
          © {new Date().getFullYear()} {APP_NAME}. The app is open source under AGPL-3.0.
        </p>
      </div>
    </footer>
  );
}
