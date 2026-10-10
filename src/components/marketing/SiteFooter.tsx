import { AppLogo } from "@/components/ui/AppLogo";
import { APP_NAME, REPO_URL, ROUTES } from "@/lib/constants";
import Link from "next/link";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// Public status page of the external uptime monitor. Inlined at build time;
// the link is left out when it is unset (local dev, CI).
const STATUS_PAGE_URL = process.env.NEXT_PUBLIC_STATUS_PAGE_URL?.trim() || null;

export interface SiteFooterProps {
  className?: string;
}

export function SiteFooter({ className }: SiteFooterProps) {
  return (
    <footer className={cn("border-t border-border-default", className)}>
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="py-10 sm:py-12">
          {/* Top row: logo + primary links */}
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <AppLogo onlyIcon={true} />
                <span className="text-[13px] font-semibold text-text-primary">{APP_NAME}</span>
              </div>
              <span className="text-[13px] text-text-muted">Built for clarity.</span>
            </div>

            {/* Link columns — 2-col grid on mobile, horizontal on sm+ */}
            <nav
              className="grid grid-cols-2 gap-x-10 gap-y-3 text-[13px] text-text-muted sm:flex sm:flex-wrap sm:items-center sm:gap-6"
              aria-label="Footer navigation"
            >
              <Link href={ROUTES.app} className="transition hover:text-text-primary">Editor</Link>
              <Link href="/templates" className="transition hover:text-text-primary">Templates</Link>
              <Link href="/explore" className="transition hover:text-text-primary">Explore</Link>
              <Link href="/integrations" className="transition hover:text-text-primary">Integrations</Link>
              <Link href="/api-docs" className="transition hover:text-text-primary">API docs</Link>
              <Link href="/changelog" className="transition hover:text-text-primary">Changelog</Link>
              <Link href="/about" className="transition hover:text-text-primary">About</Link>
              <Link href="/privacy" className="transition hover:text-text-primary">Privacy</Link>
              <Link href="/terms" className="transition hover:text-text-primary">Terms</Link>
              {/* AGPL-3.0 section 13: users of the hosted app are offered its source. */}
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="transition hover:text-text-primary">
                Source
              </a>
              {STATUS_PAGE_URL ? (
                <a
                  href={STATUS_PAGE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-text-primary"
                >
                  Status
                </a>
              ) : null}
            </nav>
          </div>

          {/* Bottom row: copyright */}
          <div className="mt-8 border-t border-border-subtle pt-6 text-[12px] text-text-muted">
            © {new Date().getFullYear()} {APP_NAME}. Licensed under AGPL-3.0.
          </div>
        </div>
      </div>
    </footer>
  );
}
