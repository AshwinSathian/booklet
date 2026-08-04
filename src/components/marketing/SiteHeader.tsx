"use client";

import { AppLogo } from "@/components/ui/AppLogo";
import { Button } from "@/components/ui/Button";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { trackEvent } from "@/lib/analytics";
import { ROUTES } from "@/lib/constants";
import { useSession } from "@/components/auth/SessionProvider";
import { AccountMenu } from "@/components/auth/AccountMenu";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared site navigation — used by the desktop nav, the mobile drawer, and
// (via the resolveNavHref helper below) from every non-landing page.
// ─────────────────────────────────────────────────────────────────────────────

export const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#examples", label: "Examples" },
  { href: "/mcp-setup", label: "AI Agents" },
  { href: "/integrations", label: "Integrations" },
  { href: "/api-docs", label: "API" },
  { href: "/templates", label: "Templates" },
];

/**
 * The landing page's own in-page sections (#features, #how, #examples) only
 * exist in the DOM on "/". From any other page those anchors need to resolve
 * back to the homepage first so the link still goes somewhere real.
 */
function resolveNavHref(href: string, pathname: string | null) {
  if (!href.startsWith("#")) return href;
  return pathname === "/" ? href : `/${href}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile nav drawer
// ─────────────────────────────────────────────────────────────────────────────

function MobileNavPanel({
  open,
  isSignedIn,
  isLoaded,
  pathname,
  onClose,
}: {
  open: boolean;
  isSignedIn: boolean | null | undefined;
  isLoaded: boolean;
  pathname: string | null;
  onClose: () => void;
}) {
  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-30 bg-bg/60 backdrop-blur-sm"
        style={{ animation: "fadeIn 0.18s ease both" }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Navigation menu"
        className="fixed inset-x-0 top-0 z-40 bg-bg border-b border-border-default shadow-glass"
        style={{ animation: "mobileNavIn 0.28s cubic-bezier(0.16,1,0.3,1) both" }}
      >
        {/* Header row */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <AppLogo onlyIcon={false} />
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-fill-2 hover:text-text-primary"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 16 16" aria-hidden>
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Nav links */}
        <nav aria-label="Mobile site navigation" className="px-3 py-3">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={resolveNavHref(link.href, pathname)}
              onClick={onClose}
              className="flex items-center px-3 py-3.5 rounded-xl text-[15px] font-medium text-text-secondary transition hover:bg-fill-2 hover:text-text-primary active:scale-[0.99]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTA strip */}
        <div className="border-t border-border-subtle px-5 py-4 flex flex-col gap-3">
          <Button
            variant="primary"
            size="lg"
            href={ROUTES.app}
            onClick={() => { onClose(); trackEvent("open_editor_clicked", { location: "mobile_nav" }); }}
            className="w-full justify-center"
          >
            Open editor
            <svg width="12" height="12" fill="none" viewBox="0 0 12 12" aria-hidden>
              <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
          {isLoaded && isSignedIn ? (
            <Button variant="secondary" size="lg" href={ROUTES.myPages} onClick={onClose} className="w-full justify-center">
              My pages
            </Button>
          ) : isLoaded ? (
            <Button variant="secondary" size="lg" href={ROUTES.signIn} onClick={onClose} className="w-full justify-center">
              Sign in
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Site header
// ─────────────────────────────────────────────────────────────────────────────

export interface SiteHeaderProps {
  /** Label for the primary right-hand CTA button. Defaults to "Open editor". */
  ctaLabel?: string;
  /** Href for the primary CTA. Defaults to the editor route. */
  ctaHref?: string;
  /** `location` field passed to the `open_editor_clicked` analytics event. */
  ctaTrackLocation?: string;
  /** Set to false to render a static (non-sticky) header. Defaults to true. */
  sticky?: boolean;
  className?: string;
}

export function SiteHeader({
  ctaLabel = "Open editor",
  ctaHref = ROUTES.app,
  ctaTrackLocation = "topbar",
  sticky = true,
  className,
}: SiteHeaderProps) {
  const { isSignedIn, isLoaded } = useSession();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const closeNav = useCallback(() => setMobileNavOpen(false), []);
  const openNav = useCallback(() => setMobileNavOpen(true), []);

  return (
    <>
      <MobileNavPanel
        open={mobileNavOpen}
        isSignedIn={isSignedIn}
        isLoaded={isLoaded}
        pathname={pathname}
        onClose={closeNav}
      />

      <header
        className={cn(
          "z-20 border-b border-border-default/60 bg-bg/80 backdrop-blur-xl",
          sticky && "sticky top-0",
          className,
        )}
      >
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <div className="flex items-center justify-between py-3.5 sm:py-4">
            <AppLogo onlyIcon={false} />

            {/* Desktop nav — hidden below lg */}
            <nav
              className="hidden items-center gap-6 lg:flex"
              aria-label="Site navigation"
            >
              {NAV_LINKS.map((link) => {
                const isActive = !link.href.startsWith("#") && link.href === pathname;
                return (
                  <a
                    key={link.href}
                    href={resolveNavHref(link.href, pathname)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "text-sm transition hover:text-text-primary",
                      isActive ? "font-semibold text-text-primary" : "text-text-muted",
                    )}
                  >
                    {link.label}
                  </a>
                );
              })}
            </nav>

            {/* Right controls */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <ThemeToggle />

              {/* Desktop: sign in / my pages */}
              {isLoaded && isSignedIn ? (
                <div className="hidden lg:flex items-center gap-3">
                  <Link
                    href={ROUTES.myPages}
                    className="text-sm text-text-muted transition hover:text-text-primary"
                  >
                    My pages
                  </Link>
                  <AccountMenu />
                </div>
              ) : (
                <span
                  className={cn(
                    "hidden lg:inline",
                    !isLoaded && "pointer-events-none opacity-0",
                  )}
                  aria-hidden={!isLoaded || undefined}
                >
                  <Button variant="secondary" size="lg" href={ROUTES.signIn}>Sign in</Button>
                </span>
              )}

              {/* Mobile: avatar when signed in */}
              {isLoaded && isSignedIn && (
                <div className="lg:hidden">
                  <AccountMenu />
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                href={ctaHref}
                onClick={() => trackEvent("open_editor_clicked", { location: ctaTrackLocation })}
              >
                {ctaLabel}
                <svg width="12" height="12" fill="none" viewBox="0 0 12 12" aria-hidden>
                  <path
                    d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Button>

              {/* Hamburger — mobile only */}
              <button
                type="button"
                aria-label="Open navigation"
                aria-expanded={mobileNavOpen}
                onClick={openNav}
                className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-fill-2 hover:text-text-primary"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 16 16" aria-hidden>
                  <path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
