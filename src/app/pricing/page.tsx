import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Button } from "@/components/ui/Button";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = buildMetadata({
  title: "Free, with no paid plan",
  description:
    "Booklet is free and has no paid plan. An account gets team spaces, version history, analytics, the API, webhooks and the MCP server. Who pays for hosting is on the Trust page.",
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
      "Publish to a link you can share",
      "Drafts saved in your browser, synced to your account when signed in",
      "GitHub-Flavored Markdown, KaTeX math",
      "Mermaid and Graphviz diagrams",
      "Formatting toolbar and a slash menu",
      "YAML frontmatter (type, status, owners, tags, visibility)",
      "21 ready-to-use templates (incident report, postmortem, ADR, runbook, and more)",
    ],
  },
  {
    heading: "Pages & sharing",
    items: [
      "Pages without a monthly cap (10 a month with no account)",
      "Custom URL slugs (e.g. /p/my-incident-report)",
      "Unlisted pages by default, public pages when you choose, team pages in a space",
      "Password-protected pages",
      "Per-page views, and how many readers reached 50% and 100%",
      "Version history: 50 snapshots per page, line diff, restore",
      "Table of contents on long documents",
      "Team spaces, with document types and links between pages",
    ],
  },
  {
    heading: "Export & organisation",
    items: [
      "Export to Markdown or self-contained HTML, and Print to PDF",
      "Folders for your own pages",
      "My pages, with how each page was last published",
      "Download every page as a ZIP of Markdown files",
    ],
  },
  {
    heading: "API & integrations",
    items: [
      "REST API: publish, update, list and delete pages",
      "API keys you can label and revoke",
      "Webhooks on page.published and page.updated, with a delivery log",
      "MCP server for Claude and other MCP clients",
      "GitHub Action for publishing from a workflow",
      "CLI: the booklet-cli npm package",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <SiteHeader ctaLabel="Start writing" />

      <main className="mx-auto max-w-3xl px-6 py-16">
        {/* Hero */}
        <div className="mb-14 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-dim px-4 py-1.5 text-xs font-semibold tracking-wide text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Free
          </div>
          <h1 className="text-[clamp(32px,5vw,48px)] font-thin leading-[1.05] text-text-primary font-display">
            Free, and there is no paid plan.
          </h1>
          <p className="mt-4 text-base text-text-secondary max-w-lg mx-auto leading-relaxed">
            Every feature of {APP_NAME} comes with a free account: team spaces, the API, version
            history, analytics, password protection, webhooks and the MCP server. Nothing asks for a
            card. The maintainer pays for the hosting, and the{" "}
            <Link href="/trust" className="text-accent underline underline-offset-2 hover:text-accent-soft transition">
              Trust page
            </Link>{" "}
            says what that hosting is.
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
          <h2 className="text-sm font-semibold text-text-primary mb-3 font-display">
            With and without an account
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-4">
            You can publish without an account, up to 10 pages a month. An account removes the cap
            and adds editing in place, custom slugs, My pages, analytics, version history, team
            spaces and the API.
          </p>
          <p className="text-sm text-text-secondary leading-relaxed mb-4">
            A page published without an account is kept for 90 days. Sign in and claim it from the
            browser you published it in, and it doesn&apos;t expire.
          </p>
          <Button variant="secondary" size="sm" href={ROUTES.signUp}>
            Create a free account
          </Button>
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <p className="text-xs text-text-muted">
            <Link href="/explore" className="text-accent underline underline-offset-2 hover:text-accent-soft transition">
              Pages their authors made public →
            </Link>
          </p>
        </div>
      </main>

      <SiteFooter className="mt-8" />
    </div>
  );
}
