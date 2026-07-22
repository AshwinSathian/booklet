import { AppLogo } from "@/components/ui/AppLogo";
import type { ReactNode } from "react";

/**
 * Shared chrome for every auth-adjacent page (sign-in, sign-up, claim,
 * cli-auth, team-invite join) — same ambient accent glow as the marketing
 * homepage hero (src/components/marketing/Landing.tsx) so these pages read
 * as Readable rather than a generic form, plus an elevated card so the
 * inputs aren't floating loose against bare bg.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-bg text-text-primary flex flex-col">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/2 h-150 w-150 -translate-x-1/2 rounded-full bg-accent opacity-[0.07] blur-[100px]" />
        <div className="absolute bottom-0 -left-24 h-87.5 w-87.5 rounded-full bg-accent-warm opacity-[0.04] blur-[80px]" />
      </div>

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
  );
}
