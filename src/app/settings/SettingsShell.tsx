import Link from "next/link";
import type { ReactNode } from "react";
import { AppPage } from "@/components/app/AppPage";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { ROUTES } from "@/lib/constants";

const GROUPS = [
  {
    label: "Personal",
    links: [
      { href: ROUTES.account, label: "Account" },
      { href: ROUTES.security, label: "Sign-in and security" },
    ],
  },
  {
    label: "Developer",
    links: [
      { href: ROUTES.apiKeys, label: "API keys" },
      { href: ROUTES.webhooks, label: "Webhooks" },
    ],
  },
] as const;

type SettingsRoute = (typeof GROUPS)[number]["links"][number]["href"];

/**
 * The frame of every /settings page: the sections down the left, the page
 * beside them. Below `md` the sections are a row above the page that wraps.
 */
export function SettingsShell({ current, children }: { current: SettingsRoute; children: ReactNode }) {
  return (
    <AppPage width="wide">
      <div className="md:grid md:grid-cols-[13rem_minmax(0,1fr)] md:gap-12 lg:gap-16">
        <nav aria-label="Settings" className="max-md:-mx-5 max-md:mb-8 max-md:border-b max-md:border-border-default max-md:px-5 sm:max-md:-mx-8 sm:max-md:px-8">
          <div className="flex gap-1 max-md:flex-wrap max-md:pb-3 md:sticky md:top-24 md:flex-col md:gap-6">
            {GROUPS.map((group) => (
              <div key={group.label} className="flex gap-1 max-md:contents md:flex-col md:gap-0.5">
                <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted max-md:hidden">{group.label}</p>
                {group.links.map((link) => {
                  const active = link.href === current;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={[
                        "whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors",
                        active ? "bg-fill-2 font-semibold text-text-primary" : "text-text-secondary hover:bg-fill-1 hover:text-text-primary",
                      ].join(" ")}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>
        {/* The pages report what an action did in a toast. */}
        <div className="min-w-0 max-w-[44rem]">
          <ToastProvider>{children}</ToastProvider>
        </div>
      </div>
    </AppPage>
  );
}

/** The title of a settings page: a serif heading and one line under it. */
export function SettingsTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-2xl font-medium tracking-[-0.02em] sm:text-[1.75rem]">{title}</h1>
      {children ? <p className="mt-2 text-sm leading-relaxed text-text-secondary">{children}</p> : null}
    </div>
  );
}

/** A titled group of rows in one bordered card. `tone="danger"` is for what cannot be undone. */
export function SettingsSection({ title, hint, tone, children }: { title: string; hint?: ReactNode; tone?: "danger"; children: ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className={`text-[0.9375rem] font-semibold ${tone === "danger" ? "text-danger" : "text-text-primary"}`}>{title}</h2>
      {hint ? <p className="mt-1 text-sm leading-relaxed text-text-secondary">{hint}</p> : null}
      <div className={`mt-3 divide-y overflow-hidden rounded-xl border bg-bg-elevated ${tone === "danger" ? "divide-danger/20 border-danger/40" : "divide-border-default border-border-default"}`}>
        {children}
      </div>
    </section>
  );
}

/** One row of a section: what it is on the left, what you can do about it on the right. */
export function SettingsRow({ label, detail, action }: { label: ReactNode; detail?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3.5 sm:px-5">
      <div className="min-w-0 flex-1 basis-56">
        <div className="text-sm font-medium text-text-primary">{label}</div>
        {detail ? <div className="mt-0.5 text-sm leading-relaxed text-text-secondary">{detail}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

/** A small label for a state: confirmed, connected, not set. */
export function StatusChip({ tone = "neutral", children }: { tone?: "neutral" | "warn"; children: ReactNode }) {
  return (
    <span
      className={`ml-2 inline-block rounded-pill border px-2 py-px align-middle text-xs font-medium ${
        tone === "warn" ? "border-warning/50 text-text-primary" : "border-border-strong text-text-secondary"
      }`}
    >
      {children}
    </span>
  );
}
