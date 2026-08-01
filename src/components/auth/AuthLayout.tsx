import { AppLogo } from "@/components/ui/AppLogo";
import type { ReactNode } from "react";

/**
 * Shared chrome for every auth-adjacent page (sign-in, sign-up, claim,
 * cli-auth, team-invite join) — an editorial two-pane split so these pages
 * read as Booklet rather than a generic centered form card (the design
 * audit flagged the old single-card layout as the most generic-looking
 * surface in the product).
 *
 * Left pane (`lg:` and up only — mobile keeps the original single-column
 * form-only experience): a static, non-interactive example card — a
 * hairline-bordered neutral surface showing a short excerpt, in the same
 * card pattern used throughout the product (see TemplatePreviewCard).
 * Deliberately not scroll-animated: a full scroll-driven reveal doesn't make
 * sense on a short, single-viewport form page.
 *
 * Right pane (the only pane on mobile): the actual form, in the elevated
 * card this file has always used.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen bg-bg text-text-primary">
      {/* Left: static editorial panel — hidden below lg, never carries any
          scroll/motion behavior (this is a form page, not a marketing
          scroll section). */}
      <div className="relative hidden overflow-hidden bg-bg-soft p-12 lg:flex lg:flex-col lg:justify-center">
        <div aria-hidden className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent opacity-[0.07] blur-[100px]" />

        <h2 className="relative max-w-md text-balance text-[clamp(28px,3vw,40px)] font-semibold leading-tight text-text-primary">
          Written in Markdown. Read by everyone else.
        </h2>

        <div className="relative mt-8 max-w-sm rounded-2xl border border-border-default bg-bg-elevated p-6 shadow-card">
          <p className="text-[15px] font-medium text-text-primary">Incident Report</p>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            <span className="font-semibold text-text-primary">Severity:</span> P1, resolved in 13 minutes.
          </p>
        </div>
      </div>

      {/* Right: the actual form — full width on mobile, half on lg:. */}
      <div className="relative flex flex-col overflow-hidden">
        <header className="relative border-b border-border-subtle">
          <div className="mx-auto w-full max-w-md px-4 py-3">
            <AppLogo onlyIcon={false} />
          </div>
        </header>

        <main className="relative flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm rounded-2xl border border-border-subtle bg-bg-elevated/60 backdrop-blur px-6 py-8 sm:px-8 sm:py-10 shadow-card flex flex-col items-center gap-5">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
