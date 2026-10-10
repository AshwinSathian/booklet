import Link from "next/link";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { AppLogo } from "@/components/ui/AppLogo";
import { ROUTES } from "@/lib/constants";

const TABS = [
  { href: ROUTES.account, label: "Account" },
  { href: ROUTES.apiKeys, label: "API keys" },
  { href: ROUTES.webhooks, label: "Webhooks" },
] as const;

/** The header and section tabs shared by the three /settings pages. */
export function SettingsShell({ current, children }: { current: (typeof TABS)[number]["href"]; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-3xl px-4 h-12 flex items-center justify-between gap-4">
          <AppLogo onlyIcon={false} />
          <div className="flex items-center gap-3">
            <Link
              href={ROUTES.myPages}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-pill border border-border-default px-3.5 py-1.5 text-xs font-medium text-text-secondary transition hover:border-accent-soft/50 hover:text-text-primary"
            >
              My pages
            </Link>
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-10">
        <nav aria-label="Settings" className="mb-8 flex gap-1 border-b border-border-subtle">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={tab.href === current ? "page" : undefined}
              className={[
                "-mb-px border-b-2 px-3 py-2 text-sm transition",
                tab.href === current
                  ? "border-accent font-medium text-text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary",
              ].join(" ")}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        {children}
      </main>
    </div>
  );
}
