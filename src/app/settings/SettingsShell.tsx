import Link from "next/link";
import type { ReactNode } from "react";
import { AppPage } from "@/components/app/AppPage";
import { ROUTES } from "@/lib/constants";

const TABS = [
  { href: ROUTES.account, label: "Account" },
  { href: ROUTES.apiKeys, label: "API keys" },
  { href: ROUTES.webhooks, label: "Webhooks" },
] as const;

/** The header and section tabs shared by the three /settings pages. */
export function SettingsShell({ current, children }: { current: (typeof TABS)[number]["href"]; children: ReactNode }) {
  return (
    <AppPage>
      <nav aria-label="Settings" className="mb-10 flex gap-6 border-b border-border-default">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.href === current ? "page" : undefined}
            className={[
              "-mb-px border-b-2 pb-3 text-sm transition",
              tab.href === current
                ? "border-accent font-semibold text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </AppPage>
  );
}
