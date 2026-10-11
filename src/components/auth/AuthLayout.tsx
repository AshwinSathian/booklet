import { AppLogo } from "@/components/ui/AppLogo";
import type { ReactNode } from "react";

/**
 * Shared chrome for every auth-adjacent page (sign-in, sign-up, password
 * reset, email verification, cli-auth, OAuth consent, team-invite join):
 * the logo, then a serif title and the form on a paper card. Nothing else is on the page, so
 * the form is the one thing to look at.
 */
export function AuthLayout({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-bg px-4 py-12 text-text-primary">
      <header>
        <AppLogo />
      </header>
      <main id="main" className="flex w-full max-w-[26rem] flex-col items-center gap-5 rounded-2xl border border-border-default bg-bg-elevated px-6 py-8 sm:px-9 sm:py-10">
        {title ? <h1 className="text-center font-display text-[1.75rem] font-medium leading-tight tracking-[-0.02em]">{title}</h1> : null}
        {children}
      </main>
    </div>
  );
}
