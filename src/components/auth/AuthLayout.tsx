import { AppLogo } from "@/components/ui/AppLogo";
import type { ReactNode } from "react";

/**
 * Shared chrome for every auth-adjacent page (sign-in, sign-up, password
 * reset, email verification, cli-auth, OAuth consent, team-invite join):
 * the logo, then the form on a paper card. Nothing else is on the page, so
 * the form is the one thing to look at.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-bg px-4 py-12 text-text-primary">
      <header>
        <AppLogo />
      </header>
      <main className="flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border border-border-default bg-bg-elevated px-6 py-8 sm:px-8 sm:py-10">
        {children}
      </main>
    </div>
  );
}
