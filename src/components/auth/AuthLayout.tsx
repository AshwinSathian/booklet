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
 * form-only experience): a static, non-interactive example of "The Reveal"
 * transformation (see RevealHero.tsx, the scroll-driven version of this same
 * idea on the marketing homepage) — a fully-revealed, paper-toned snippet.
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
      <div className="hidden lg:flex relative flex-col items-center justify-center overflow-hidden bg-bg px-12 py-16">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-48 left-1/2 h-150 w-150 -translate-x-1/2 rounded-full bg-accent opacity-[0.07] blur-[100px]" />
          <div className="absolute bottom-0 -left-24 h-87.5 w-87.5 rounded-full bg-accent-warm opacity-[0.04] blur-[80px]" />
        </div>

        <div className="relative flex max-w-md flex-col gap-8">
          <h2 className="font-display font-display-hero text-balance text-[clamp(28px,3vw,40px)] leading-tight text-text-primary">
            Written in Markdown. Read by everyone else.
          </h2>

          {/* Static, fully-revealed snippet — same idea as RevealHero's
              SAMPLE, minus the scroll-driven mono→Fraunces interpolation:
              this is the end state only. */}
          <div className="rounded-2xl bg-paper p-6 text-paper-ink shadow-print">
            <p className="font-display font-display-body text-lg font-medium">Incident Report</p>
            <p className="mt-2 text-sm leading-relaxed text-paper-ink-secondary">
              <span className="font-semibold text-paper-ink">Severity:</span> P1, resolved in 13
              minutes.
            </p>
          </div>
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
