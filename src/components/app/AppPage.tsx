"use client";

import { AccountMenu } from "@/components/auth/AccountMenu";
import { useSession } from "@/components/auth/SessionProvider";
import { AppLogo } from "@/components/ui/AppLogo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { ROUTES } from "@/lib/constants";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: ROUTES.myPages, label: "My pages" },
  { href: ROUTES.spaces, label: "Spaces" },
  { href: ROUTES.account, label: "Settings", match: "/settings" },
] as const;

const WIDTHS = { wide: "max-w-[72rem]", medium: "max-w-4xl", narrow: "max-w-[46rem]" } as const;

/** The one header of every page behind the editor: My pages, Settings, Spaces, admin. */
export function AppHeader() {
  const { isSignedIn, isLoaded } = useSession();
  const pathname = usePathname();

  return (
    <header data-app-header className="sticky top-0 z-30 border-b border-border-default bg-bg-glass backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-14 w-full max-w-[72rem] items-center gap-8 px-5 sm:px-8">
        <AppLogo href={ROUTES.app} />

        {isSignedIn ? (
          <nav aria-label="App" className="hidden items-center gap-7 md:flex">
            {NAV.map((link) => {
              const root = "match" in link ? link.match : link.href;
              const current = pathname === root || !!pathname?.startsWith(`${root}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={current ? "page" : undefined}
                  className={
                    current
                      ? "text-sm font-semibold text-text-primary underline decoration-highlight decoration-[3px] underline-offset-[7px]"
                      : "text-sm text-text-secondary hover:text-text-primary"
                  }
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {isLoaded && isSignedIn ? (
            <AccountMenu />
          ) : (
            // Kept in the layout while the session loads, so the header does not shift.
            <Link href={ROUTES.signIn} className={`px-2 text-sm text-text-secondary hover:text-text-primary ${isLoaded ? "" : "invisible"}`}>
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

/** Header and main column of an app page. */
export function AppPage({ width = "narrow", children }: { width?: keyof typeof WIDTHS; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-text-primary">
      <AppHeader />
      <main id="main" className={`mx-auto w-full flex-1 px-5 py-10 sm:px-8 sm:py-12 ${WIDTHS[width]}`}>
        {children}
      </main>
    </div>
  );
}

/** Title block of an app page: where you came from, a serif title, one line under it, one action. */
export function AppPageTitle({
  back,
  eyebrow,
  title,
  lede,
  action,
}: {
  back?: { href: string; label: string };
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8">
      {back ? (
        <Link href={back.href} className="link mb-4 inline-block text-sm text-text-secondary">
          ← {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">{eyebrow}</p> : null}
          <h1 className="mt-1 font-display text-2xl font-medium tracking-[-0.02em] text-balance sm:text-[1.75rem]">{title}</h1>
          {lede ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">{lede}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
    </div>
  );
}

/** An empty list: one serif line, one sentence, at most one action. */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border-default px-6 py-14 text-center">
      <p className="font-display text-xl font-medium">{title}</p>
      {children ? <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-secondary">{children}</p> : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
