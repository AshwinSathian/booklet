"use client";

import { AccountMenu } from "@/components/auth/AccountMenu";
import { useSession } from "@/components/auth/SessionProvider";
import { AppLogo } from "@/components/ui/AppLogo";
import { Button } from "@/components/ui/Button";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { ROUTES } from "@/lib/constants";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export const NAV_LINKS = [
  { href: ROUTES.docs, label: "Docs" },
  { href: ROUTES.templates, label: "Templates" },
  { href: ROUTES.changelog, label: "Changelog" },
  { href: ROUTES.pricing, label: "Pricing" },
] as const;

const isCurrent = (href: string, pathname: string | null) => pathname === href || !!pathname?.startsWith(`${href}/`);

/** The one header of every marketing and docs page. */
export function SiteHeader() {
  const { isSignedIn, isLoaded } = useSession();
  const pathname = usePathname();
  const menu = useRef<HTMLDialogElement>(null);

  // A link inside the menu navigates without unmounting the header.
  useEffect(() => menu.current?.close(), [pathname]);

  return (
    <header data-site-header className="sticky top-0 z-30 border-b border-border-default bg-bg-glass backdrop-blur-md print:hidden">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-highlight focus:px-3 focus:py-1.5 focus:text-sm focus:font-semibold focus:text-on-highlight"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 w-full max-w-[72rem] items-center gap-8 px-5 sm:px-8">
        <AppLogo />

        <nav aria-label="Site" className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => {
            const current = isCurrent(link.href, pathname);
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

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {isLoaded && isSignedIn ? (
            <>
              <Link href={ROUTES.myPages} className="hidden px-2 text-sm text-text-secondary hover:text-text-primary md:inline">
                My pages
              </Link>
              <AccountMenu />
            </>
          ) : (
            // Kept in the layout while the session loads, so the header does not shift.
            <Link
              href={ROUTES.signIn}
              className={`hidden px-2 text-sm text-text-secondary hover:text-text-primary md:inline ${isLoaded ? "" : "invisible"}`}
            >
              Sign in
            </Link>
          )}
          <Button variant="primary" size="lg" href={ROUTES.app} className="hidden sm:inline-flex">
            Write a page
          </Button>
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => menu.current?.showModal()}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-text-primary hover:bg-fill-2 md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* A native dialog: focus is trapped, Escape closes it, the page behind is inert. */}
      <dialog
        ref={menu}
        aria-label="Menu"
        onClick={(e) => e.target === e.currentTarget && menu.current?.close()}
        className="m-0 ml-auto h-dvh max-h-none w-[min(22rem,88vw)] max-w-none border-l border-border-default bg-bg p-0 text-text-primary backdrop:bg-black/40"
      >
        <div className="flex h-16 items-center justify-between border-b border-border-default px-5">
          <span className="font-display text-lg font-semibold">Menu</span>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => menu.current?.close()}
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-fill-2"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <nav aria-label="Site, mobile" className="flex flex-col px-3 py-3">
          {[...NAV_LINKS, isSignedIn ? { href: ROUTES.myPages, label: "My pages" } : { href: ROUTES.signIn, label: "Sign in" }].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isCurrent(link.href, pathname) ? "page" : undefined}
              className="rounded-lg px-3 py-3 font-display text-xl font-medium hover:bg-fill-2 aria-[current=page]:underline aria-[current=page]:decoration-highlight aria-[current=page]:decoration-[3px] aria-[current=page]:underline-offset-[6px]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border-default p-5">
          <Button variant="primary" size="xl" href={ROUTES.app} className="w-full">
            Write a page
          </Button>
        </div>
      </dialog>
    </header>
  );
}
