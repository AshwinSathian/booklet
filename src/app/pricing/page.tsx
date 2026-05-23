import { AppLogo } from "@/components/ui/AppLogo";
import { Button } from "@/components/ui/Button";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = buildMetadata({
  title: "Free — No paid plans",
  description:
    "Readable is completely free. Publish Markdown pages, get analytics, use the API, version history, password protection — all included. No credit card.",
  pathname: "/pricing",
});

function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
        className="mt-0.5 shrink-0 text-accent"
      >
        <path
          d="M3 8l3.5 3.5 6.5-7"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-sm text-text-secondary">{children}</span>
    </li>
  );
}

const FEATURE_GROUPS: { heading: string; items: string[] }[] = [
  {
    heading: "Writing & publishing",
    items: [
      "Live Markdown preview as you type",
      "Publish with one click — clean shareable URL",
      "Unlimited local drafts, auto-saved to your browser",
      "Full GitHub-Flavored Markdown support",
      "Mermaid diagram rendering (flowcharts, sequence, architecture)",
      "Formatting toolbar — bold, italic, headings, code, links",
      "YAML frontmatter support (title, author, date, tags, visibility)",
      "8 ready-to-use templates (incident report, ADR, runbook, and more)",
    ],
  },
  {
    heading: "Pages & sharing",
    items: [
      "Permanent pages for signed-in users",
      "Custom URL slugs (e.g. /p/my-incident-report)",
      "Unlisted pages — accessible by link, not discoverable",
      "Password-protected pages",
      "Per-page view analytics with read-depth tracking",
      "Version history — restore any of the last 10 snapshots",
      "Auto Table of Contents for long documents",
      "Reading time displayed on every shared page",
    ],
  },
  {
    heading: "Export & organisation",
    items: [
      "Export to Markdown, self-contained HTML, or PDF",
      "Collections — group related pages into organised sets",
      "My Pages dashboard to manage all your published pages",
      "Attribution badge on every page (links back to Readable)",
    ],
  },
  {
    heading: "API & integrations",
    items: [
      "REST API v1 — publish, update, list, and delete pages",
      "API key management (generate, revoke, label keys)",
      "Publish webhooks — get notified on page.published and page.updated",
      "Claude MCP server — use Readable directly from Claude",
      "GitHub Actions integration — publish from CI/CD pipelines",
      "CLI support via the REST API and any HTTP client",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <header className="border-b border-border-subtle bg-bg/85 backdrop-blur-xl sticky top-0 z-20">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 h-12">
          <Link href="/">
            <AppLogo onlyIcon={false} />
          </Link>
          <Button variant="primary" size="md" href={ROUTES.app}>
            Start writing
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        {/* Hero */}
        <div className="mb-14 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-dim px-4 py-1.5 text-xs font-semibold tracking-wide text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Free forever
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-text-primary">
            Everything included. No catch.
          </h1>
          <p className="mt-4 text-base text-text-secondary max-w-lg mx-auto leading-relaxed">
            {APP_NAME} is completely free. Every feature — the API, version history, analytics,
            password protection, webhooks, MCP — is available to everyone with an account.
            No credit card. No paid plan. No upgrade prompt.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button variant="primary" size="md" href={ROUTES.app}>
              Open the editor
              <svg width="11" height="11" fill="none" viewBox="0 0 11 11" aria-hidden>
                <path
                  d="M2 9 9 2M9 2H4.5M9 2v4.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Button>
            <Button variant="ghost" size="md" href={ROUTES.signUp}>
              Create an account
            </Button>
          </div>
        </div>

        {/* Feature groups */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {FEATURE_GROUPS.map((group) => (
            <div key={group.heading}>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-muted">
                {group.heading}
              </h2>
              <ul className="space-y-3">
                {group.items.map((item) => (
                  <FeatureItem key={item}>{item}</FeatureItem>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Anonymous vs signed-in note */}
        <div className="mt-14 rounded-xl border border-border-subtle bg-bg-elevated px-6 py-7">
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            Anonymous vs. signed-in
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-4">
            You can publish immediately without creating an account. Anonymous pages
            last 30 days and show a countdown to your reader. Creating a free account
            upgrades your pages to permanent, unlocks custom slugs, the My Pages dashboard,
            analytics, version history, the API, and all other features listed above.
          </p>
          <Button variant="secondary" size="sm" href={ROUTES.signUp}>
            Create a free account
          </Button>
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <p className="text-xs text-text-muted">
            Built for developers, writers, and teams who need to share things clearly.{" "}
            <Link href="/explore" className="text-accent hover:text-accent-soft transition">
              Browse pages people are sharing →
            </Link>
          </p>
        </div>
      </main>

      <footer className="mt-8 border-t border-border-subtle">
        <div className="mx-auto w-full max-w-3xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
          <div className="flex items-center gap-2">
            <AppLogo onlyIcon={true} />
            <span>{APP_NAME} — Beautiful markdown pages, instantly.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/templates" className="hover:text-text-primary transition">Templates</Link>
            <Link href="/explore" className="hover:text-text-primary transition">Explore</Link>
            <Link href={ROUTES.app} className="text-accent hover:text-accent-soft transition">Start writing →</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
