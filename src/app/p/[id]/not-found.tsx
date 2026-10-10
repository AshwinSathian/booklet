import Link from "next/link";
import { AppLogo } from "@/components/ui/AppLogo";
import { ROUTES } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Shown, with status 404, when a share page does not exist
// ---------------------------------------------------------------------------

const EXAMPLE_PAGES = [
  { label: "Incident Report", href: "https://booklet.ashwinsathian.com/p/example-incident-report" },
  { label: "Architecture Decision Record", href: "https://booklet.ashwinsathian.com/p/example-adr" },
  { label: "Technical Docs", href: "https://booklet.ashwinsathian.com/p/example-readme" },
] as const;

export default function SharePageNotFound() {
  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <header className="border-b border-border-subtle">
        <div className="mx-auto w-full max-w-2xl px-4 py-3">
          <AppLogo onlyIcon={false} />
        </div>
      </header>

      <main className="flex-1 px-4 py-16">
        <div className="mx-auto max-w-xl">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-card bg-fill-2 text-text-muted">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          <h1 className="text-xl font-medium">This page doesn&apos;t exist.</h1>
          <p className="mt-2 text-sm text-text-secondary leading-relaxed">
            The link may be wrong, or the page may have been deleted by its author.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={ROUTES.app}
              className="inline-flex items-center gap-1.5 rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast transition hover:bg-accent-hover active:scale-[0.97]"
            >
              Create a page
              <svg width="11" height="11" fill="none" viewBox="0 0 12 12" aria-hidden>
                <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href="/?#examples"
              className="inline-flex items-center gap-1.5 rounded-pill border border-border-default px-4 py-2 text-sm font-medium text-text-secondary transition hover:text-text-primary hover:bg-fill-2"
            >
              Browse examples
            </Link>
          </div>

          <div className="mt-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">Example pages</p>
            <div className="flex flex-col gap-2">
              {EXAMPLE_PAGES.map((ex) => (
                <a
                  key={ex.href}
                  href={ex.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-xl border border-border-subtle px-4 py-3 text-sm text-text-secondary transition hover:border-accent-soft/40 hover:text-text-primary hover:bg-fill-1 group"
                >
                  <span>{ex.label}</span>
                  <svg width="12" height="12" fill="none" viewBox="0 0 12 12" className="text-text-muted group-hover:text-accent transition" aria-hidden>
                    <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
