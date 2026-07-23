import { AppLogo } from "@/components/ui/AppLogo";
import { Button } from "@/components/ui/Button";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { APP_NAME, ROUTES } from "@/lib/constants";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  ...buildMetadata({
    title: `${APP_NAME} MCP — Publish Pages from Claude, Cursor & Windsurf`,
    description:
      "The Booklet MCP server lets Claude, Cursor, Windsurf, VS Code, and Zed publish and manage Booklet pages directly through conversation. Zero context-switching.",
    pathname: "/mcp",
  }),
  openGraph: {
    type: "website",
    title: `${APP_NAME} MCP — Publish from Claude`,
    description:
      "Let Claude publish documentation for you. One tool call — your page is live.",
    url: absoluteUrl("/mcp"),
  },
};

const EDITORS = [
  { name: "Claude Desktop", icon: "C", color: "bg-amber-500/15 text-amber-400" },
  { name: "Claude.ai", icon: "C", color: "bg-amber-500/15 text-amber-400" },
  { name: "Cursor", icon: "⌥", color: "bg-blue-500/15 text-blue-400" },
  { name: "Windsurf", icon: "W", color: "bg-teal-500/15 text-teal-400" },
  { name: "VS Code", icon: "⬡", color: "bg-sky-500/15 text-sky-400" },
  { name: "Zed", icon: "Z", color: "bg-purple-500/15 text-purple-400" },
] as const;

const TOOLS = [
  { name: "publish_page", desc: "Create a new page from markdown content" },
  { name: "update_page", desc: "Update an existing page by ID or slug" },
  { name: "get_page", desc: "Retrieve the raw content of any page" },
  { name: "list_pages", desc: "List all pages in your account" },
  { name: "delete_page", desc: "Permanently delete a page" },
] as const;

const USE_CASES = [
  {
    title: "Incident reports on autopilot",
    body: "Ask Claude to write and publish a post-mortem after you paste in the alert timeline. Done in 30 seconds.",
    tag: "SRE",
  },
  {
    title: "Living ADRs from code review",
    body: "Paste a diff, ask Claude to document the decision, and it publishes an ADR directly to your team space.",
    tag: "Engineering",
  },
  {
    title: "Release notes from a changelog",
    body: "Feed Claude your git log; it drafts and publishes polished release notes with one tool call.",
    tag: "Product",
  },
  {
    title: "Documentation from source code",
    body: "Point Cursor at a module, ask it to document the public API — the page is live before you switch tabs.",
    tag: "Docs",
  },
] as const;

function FeatureCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-elevated p-5">
      <div className="text-2xl mb-3">{icon}</div>
      <p className="text-sm font-semibold text-text-primary mb-1">{title}</p>
      <p className="text-sm text-text-muted leading-relaxed">{body}</p>
    </div>
  );
}

export default function McpPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
          <AppLogo onlyIcon={false} />
          <div className="flex items-center gap-2">
            <Link
              href="/api-docs#mcp"
              className="hidden sm:inline text-sm text-text-muted transition hover:text-text-primary"
            >
              API docs
            </Link>
            <Button variant="primary" size="md" href="/mcp-setup">
              Get started
              <svg width="11" height="11" fill="none" viewBox="0 0 11 11" aria-hidden>
                <path d="M2 9 9 2M9 2H4.5M9 2v4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-5xl px-4 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-pill border border-accent/30 bg-accent/8 px-3 py-1 text-xs font-semibold text-accent mb-6">
          Model Context Protocol
        </div>

        <h1 className="text-[clamp(34px,6vw,56px)] font-thin leading-[1.04] text-text-primary max-w-2xl mx-auto mb-4">
          Publish pages from<br />
          <span className="text-accent">any AI editor</span>
        </h1>
        <p className="text-lg text-text-muted max-w-xl mx-auto leading-relaxed mb-8">
          The {APP_NAME} MCP server gives Claude, Cursor, Windsurf, and other AI tools a direct line to publish and manage your pages — with a single tool call, no context-switching.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button variant="primary" size="lg" href="/mcp-setup">
            Set up in 2 minutes
            <svg width="11" height="11" fill="none" viewBox="0 0 11 11" aria-hidden>
              <path d="M2 9 9 2M9 2H4.5M9 2v4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
          <Button variant="secondary" size="lg" href="/api-docs">
            REST API docs
          </Button>
        </div>

        <p className="mt-6 text-xs text-text-muted">
          Permanent URL · Not locked in a chat thread · Works with any MCP client, not one vendor&apos;s
        </p>
      </section>

      {/* Supported editors */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-12">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-text-muted mb-6">
          Works with
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {EDITORS.map((e) => (
            <div
              key={e.name}
              className="flex items-center gap-2 rounded-pill border border-border-subtle bg-bg-elevated px-4 py-2"
            >
              <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${e.color}`}>
                {e.icon}
              </span>
              <span className="text-sm font-medium text-text-primary">{e.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto w-full max-w-5xl px-4 py-12 border-t border-border-subtle">
        <h2 className="text-xl text-text-primary text-center mb-10">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard
            icon="🔑"
            title="1. Connect your API key"
            body="Generate an API key in your Booklet account, then add the MCP endpoint to your editor's config. One-time setup."
          />
          <FeatureCard
            icon="💬"
            title="2. Ask in natural language"
            body={'Say "publish this as an incident report" or "update the release notes page." Your editor handles the rest.'}
          />
          <FeatureCard
            icon="🔗"
            title="3. Get a shareable link"
            body="Your page is live immediately — with a clean URL you can send to anyone. No accounts needed to read."
          />
        </div>
      </section>

      {/* MCP tools */}
      <section className="mx-auto w-full max-w-5xl px-4 py-12 border-t border-border-subtle">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div>
            <h2 className="text-xl text-text-primary mb-3">Available MCP tools</h2>
            <p className="text-sm text-text-muted leading-relaxed mb-6">
              Five tools cover the full page lifecycle. Your AI editor can discover and use them autonomously or on request.
            </p>
            <div className="flex flex-col gap-2">
              {TOOLS.map((t) => (
                <div
                  key={t.name}
                  className="flex items-start gap-3 rounded-lg border border-border-subtle bg-bg-elevated px-4 py-3"
                >
                  <code className="shrink-0 rounded bg-accent/10 border border-accent/20 px-1.5 py-0.5 text-xs font-mono text-accent">
                    {t.name}
                  </code>
                  <span className="text-sm text-text-secondary">{t.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl text-text-primary mb-3">Quick config</h2>
            <p className="text-sm text-text-muted mb-4">
              Paste this into your editor&apos;s MCP configuration. Replace{" "}
              <code className="rounded bg-fill-2 px-1 py-0.5 text-xs font-mono text-accent-soft">rdbl_YOUR_KEY</code> with your API key.
            </p>
            <pre className="rounded-xl bg-bg-soft border border-outline p-4 text-xs font-mono text-text-secondary overflow-x-auto leading-relaxed whitespace-pre">{`{
  "mcpServers": {
    "readable": {
      "url": "https://booklet-mcp.ashwinsathian.com/mcp",
      "headers": { "Authorization": "Bearer rdbl_YOUR_KEY" }
    }
  }
}`}</pre>
            <Link
              href="/mcp-setup"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent transition hover:text-accent-soft"
            >
              Platform-specific instructions
              <svg width="11" height="11" fill="none" viewBox="0 0 12 12" aria-hidden>
                <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="mx-auto w-full max-w-5xl px-4 py-12 border-t border-border-subtle">
        <h2 className="text-xl text-text-primary text-center mb-8">What teams use it for</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {USE_CASES.map((uc) => (
            <div
              key={uc.title}
              className="rounded-xl border border-border-subtle bg-bg-elevated p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded-pill border border-outline px-2 py-0.5 text-2xs font-semibold text-text-muted">
                  {uc.tag}
                </span>
              </div>
              <p className="text-sm font-semibold text-text-primary mb-1">{uc.title}</p>
              <p className="text-sm text-text-muted leading-relaxed">{uc.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-5xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-border-subtle bg-bg-elevated px-8 py-12">
          <h2 className="text-[clamp(20px,2.5vw,26px)] text-text-primary mb-3">
            Ready to connect?
          </h2>
          <p className="text-sm text-text-muted mb-8 max-w-md mx-auto">
            Takes less than 2 minutes. Get an API key, add the config, and start publishing from your next Claude conversation.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button variant="primary" size="lg" href="/mcp-setup">
              Set up MCP
              <svg width="11" height="11" fill="none" viewBox="0 0 11 11" aria-hidden>
                <path d="M2 9 9 2M9 2H4.5M9 2v4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
            <Button variant="secondary" size="lg" href={ROUTES.app}>
              Try the editor first
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-subtle">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <AppLogo onlyIcon={false} />
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <Link href="/api-docs" className="transition hover:text-text-primary">API docs</Link>
            <Link href="/mcp-setup" className="transition hover:text-text-primary">Setup guide</Link>
            <Link href="/explore" className="transition hover:text-text-primary">Explore</Link>
            <Link href={ROUTES.app} className="transition hover:text-text-primary">Editor</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
