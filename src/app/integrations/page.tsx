import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Button } from "@/components/ui/Button";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { APP_NAME, ROUTES } from "@/lib/constants";
import type { Metadata } from "next";
import Link from "next/link";

// The VS Code extension is built and ready but not yet published to the
// Marketplace — flip this once `AshwinSathian.booklet-vscode` is live so
// its nav item, metadata mentions, and dedicated section reappear. Search
// this file for VSCODE_EXTENSION_PUBLISHED to find every gated spot.
const VSCODE_EXTENSION_PUBLISHED = false;

export const metadata: Metadata = {
  ...buildMetadata({
    title: `${APP_NAME} Integrations — CLI, GitHub Actions, MCP & API`,
    description:
      "Publish Markdown pages from your terminal, GitHub Actions, Claude AI, or any script — without opening a separate app.",
    pathname: "/integrations",
  }),
  openGraph: {
    type: "website",
    title: `${APP_NAME} Integrations`,
    description:
      "Publish Markdown pages from your terminal, GitHub Actions, Claude AI, or any script.",
    url: absoluteUrl("/integrations"),
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared layout components
// ─────────────────────────────────────────────────────────────────────────────

function SectionAnchor({ id }: { id: string }) {
  return <div id={id} className="scroll-mt-20" />;
}

function IntegrationBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-2xs font-semibold border ${color}`}
    >
      {label}
    </span>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="rounded-xl bg-bg-soft border border-border-default p-4 text-xs font-mono text-text-secondary overflow-x-auto leading-relaxed whitespace-pre">
      {children}
    </pre>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-7 h-7 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-xs font-semibold text-accent tabular-nums">
        {n}
      </div>
      <div className="pt-0.5">
        <p className="text-sm font-semibold text-text-primary mb-1">{title}</p>
        <div className="text-sm text-text-muted leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigation pills
// ─────────────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "#cli", label: "CLI" },
  ...(VSCODE_EXTENSION_PUBLISHED ? [{ href: "#vscode", label: "VS Code" }] : []),
  { href: "#github-actions", label: "GitHub Actions" },
  { href: "#mcp", label: "MCP / AI editors" },
  { href: "#rest-api", label: "REST API" },
  { href: "#webhooks", label: "Webhooks" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <SiteHeader ctaTrackLocation="integrations_topbar" />

      {/* Hero */}
      <section className="mx-auto w-full max-w-5xl px-4 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-pill border border-accent/30 bg-accent/8 px-3 py-1 text-xs font-semibold text-accent mb-6">
          Integrations
        </div>
        <h1 className="text-[clamp(32px,6vw,54px)] font-thin leading-[1.06] text-text-primary max-w-3xl mx-auto mb-4 font-display">
          Publish from wherever<br />
          <span className="text-accent">you already work</span>
        </h1>
        <p className="text-lg text-text-muted max-w-xl mx-auto leading-relaxed mb-10">
          {APP_NAME} plugs into your terminal, your editor, your CI pipeline, and your AI assistant. Run a command, call a tool, or push to your repo — your page goes live either way.
        </p>

        {/* Quick-jump nav */}
        <div className="flex flex-wrap justify-center gap-2">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-pill border border-border-subtle bg-bg-elevated px-3.5 py-1.5 text-sm text-text-muted transition hover:border-accent/40 hover:text-text-primary hover:bg-fill-1"
            >
              {item.label}
            </a>
          ))}
        </div>
      </section>

      {/* ─── CLI ─────────────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-4 py-14 border-t border-border-subtle">
        <SectionAnchor id="cli" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div>
            <IntegrationBadge label="Terminal" color="border-emerald-500/30 bg-emerald-500/8 text-emerald-400" />
            <h2 className="text-2xl font-light text-text-primary mt-3 mb-3">
              booklet-cli
            </h2>
            <p className="text-sm text-text-muted leading-relaxed mb-6">
              Publish any Markdown file from your terminal in one command. Supports
              watch mode for live updates, custom slugs, unlisted or public
              visibility, and reading from stdin — so it pipes cleanly into any
              shell workflow.
            </p>

            <div className="flex flex-col gap-5">
              <Step n={1} title="Install or run with npx">
                No install required — use <code className="rounded bg-fill-2 px-1 py-0.5 text-xs font-mono text-accent-soft">npx</code> for a one-off publish, or install globally for repeated use.
              </Step>
              <Step n={2} title="Set your API key">
                Run <code className="rounded bg-fill-2 px-1 py-0.5 text-xs font-mono text-accent-soft">npx booklet-cli login --key bklt_YOUR_KEY</code> — stored in your home directory, never committed to source.
              </Step>
              <Step n={3} title="Publish">
                Run the publish command. You get a shareable URL back immediately.
              </Step>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <a
                href="https://www.npmjs.com/package/booklet-cli"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition hover:text-accent-soft"
              >
                View on npm
                <svg width="11" height="11" fill="none" viewBox="0 0 12 12" aria-hidden>
                  <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <Link
                href="/api-docs#authentication"
                className="text-sm text-text-muted transition hover:text-text-primary"
              >
                Get an API key →
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <CodeBlock>{`# One-off publish (no install needed)
npx booklet-cli publish README.md

# Publish with a custom slug + public visibility
npx booklet-cli publish docs/runbook.md \\
  --slug ops-runbook \\
  --visibility public

# Watch mode — updates the page on every file save
npx booklet-cli publish INCIDENT.md \\
  --watch --slug live-incident

# Update an existing page by ID
npx booklet-cli publish CHANGELOG.md \\
  --update Ab3k91QxZp

# Pipe from stdin
cat README.md | npx booklet-cli publish -`}</CodeBlock>
            <p className="text-xs text-text-muted">
              Flags: <code className="font-mono">--slug</code>, <code className="font-mono">--visibility</code>, <code className="font-mono">--update</code>, <code className="font-mono">--watch</code>, <code className="font-mono">--open</code>
            </p>
          </div>
        </div>
      </section>

      {/* ─── VS Code ─────────────────────────────────────────────────────────── */}
      {VSCODE_EXTENSION_PUBLISHED && (
        <section className="mx-auto w-full max-w-5xl px-4 py-14 border-t border-border-subtle">
          <SectionAnchor id="vscode" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            <div>
              <IntegrationBadge label="VS Code" color="border-sky-500/30 bg-sky-500/8 text-sky-400" />
              <h2 className="text-2xl font-light text-text-primary mt-3 mb-3">
                Booklet for VS Code
              </h2>
              <p className="text-sm text-text-muted leading-relaxed mb-6">
                Publish the current Markdown file — or just your current selection —
                without leaving VS Code. The extension adds three commands to the
                command palette and can store your API key in VS Code&apos;s
                secret storage so it never touches your filesystem.
              </p>

              <div className="flex flex-col gap-5">
                <Step n={1} title="Install the extension">
                  Search for <em>Booklet</em> in the VS Code Extensions panel, or install from the marketplace.
                </Step>
                <Step n={2} title="Set your API key">
                  Run <strong>Booklet: Set API Key</strong> from the command palette. Stored securely in VS Code secret storage.
                </Step>
                <Step n={3} title="Publish with one command">
                  Open any <code className="rounded bg-fill-2 px-1 py-0.5 text-xs font-mono text-accent-soft">.md</code> file and run <strong>Booklet: Publish Current File</strong>. The URL is copied to your clipboard.
                </Step>
              </div>

              <div className="mt-6">
                <a
                  href="https://marketplace.visualstudio.com/items?itemName=AshwinSathian.booklet-vscode"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition hover:text-accent-soft"
                >
                  View on VS Code Marketplace
                  <svg width="11" height="11" fill="none" viewBox="0 0 12 12" aria-hidden>
                    <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-border-subtle bg-bg-elevated p-5 flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">Command palette</p>
                {[
                  { cmd: "Booklet: Publish Current File", desc: "Publish the current file as a new page" },
                  { cmd: "Booklet: Publish Selection", desc: "Publish only the highlighted text" },
                  { cmd: "Booklet: Set API Key", desc: "Save your key to VS Code secret storage" },
                ].map((item) => (
                  <div key={item.cmd} className="flex items-start gap-3 rounded-lg border border-border-subtle bg-bg-soft px-3.5 py-3">
                    <code className="shrink-0 rounded bg-accent/10 border border-accent/20 px-1.5 py-0.5 text-xs font-mono text-accent">
                      {item.cmd}
                    </code>
                    <span className="text-xs text-text-muted leading-relaxed">{item.desc}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-text-muted">
                The extension works in VS Code, VS Code Insiders, and any fork that supports the VS Code extension API.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ─── GitHub Actions ──────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-4 py-14 border-t border-border-subtle">
        <SectionAnchor id="github-actions" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div>
            <IntegrationBadge label="CI/CD" color="border-violet-500/30 bg-violet-500/8 text-violet-400" />
            <h2 className="text-2xl font-light text-text-primary mt-3 mb-3">
              GitHub Actions
            </h2>
            <p className="text-sm text-text-muted leading-relaxed mb-6">
              Publish release notes, runbooks, ADRs, or changelogs automatically
              on every push or release. The action outputs the page URL so
              downstream steps can post it to Slack, add it to a PR comment, or
              update a status page.
            </p>

            <div className="flex flex-col gap-5">
              <Step n={1} title="Add your API key as a secret">
                In your repo settings, add a secret named <code className="rounded bg-fill-2 px-1 py-0.5 text-xs font-mono text-accent-soft">READABLE_API_KEY</code> with your Booklet API key.
              </Step>
              <Step n={2} title="Add the workflow step">
                Call the REST API directly with <code className="rounded bg-fill-2 px-1 py-0.5 text-xs font-mono text-accent-soft">curl</code> in a run step, pointing it at your Markdown file.
              </Step>
              <Step n={3} title="Use the output URL">
                Parse the JSON response with <code className="rounded bg-fill-2 px-1 py-0.5 text-xs font-mono text-accent-soft">jq</code> to get the page URL — pipe it to a Slack notification, a PR comment, or anywhere else.
              </Step>
            </div>

            <div className="mt-6">
              <Link
                href="/api-docs#github-actions"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition hover:text-accent-soft"
              >
                Full API docs
                <svg width="11" height="11" fill="none" viewBox="0 0 12 12" aria-hidden>
                  <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <CodeBlock>{`# .github/workflows/publish-docs.yml
name: Publish docs

on:
  push:
    branches: [main]
    paths: ["docs/**/*.md", "CHANGELOG.md"]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Publish to Booklet
        id: publish
        env:
          READABLE_API_KEY: \${{ secrets.READABLE_API_KEY }}
        run: |
          BODY=$(jq -n --rawfile raw CHANGELOG.md '{"raw": $raw, "visibility": "public"}')
          URL=$(curl -fsSL -X POST https://booklet-api.ashwinsathian.com/api/v1/publish \\
            -H "Authorization: Bearer $READABLE_API_KEY" \\
            -H "Content-Type: application/json" \\
            -d "$BODY" | jq -r '.url')
          echo "url=$URL" >> "$GITHUB_OUTPUT"

      - name: Post URL to Slack
        run: |
          curl -X POST \${{ secrets.SLACK_WEBHOOK }} \\
            -d '{"text":"Docs live: \${{ steps.publish.outputs.url }}"}'`}</CodeBlock>
          </div>
        </div>
      </section>

      {/* ─── MCP ─────────────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-4 py-14 border-t border-border-subtle">
        <SectionAnchor id="mcp" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div>
            <IntegrationBadge label="AI editors" color="border-[#D97757]/30 bg-[#D97757]/8 text-[#D97757]" />
            <h2 className="text-2xl font-light text-text-primary mt-3 mb-3">
              MCP server
            </h2>
            <p className="text-sm text-text-muted leading-relaxed mb-6">
              The {APP_NAME} Model Context Protocol server gives Claude, Cursor,
              Windsurf, Zed, and any other MCP-enabled AI tool a direct line to
              publish and manage pages. Ask in plain language — the AI handles
              the tool call.
            </p>

            <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4 mb-5 flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-1">Available MCP tools</p>
              {[
                { name: "publish_page", desc: "Create a new page from Markdown" },
                { name: "update_page", desc: "Update an existing page by ID or slug" },
                { name: "get_page", desc: "Retrieve the raw content of any page" },
                { name: "list_pages", desc: "List all pages in your account" },
                { name: "delete_page", desc: "Permanently delete a page" },
              ].map((t) => (
                <div key={t.name} className="flex items-start gap-3 rounded-lg border border-border-subtle bg-bg-soft px-3.5 py-2.5">
                  <code className="shrink-0 rounded bg-accent/10 border border-accent/20 px-1.5 py-0.5 text-xs font-mono text-accent">
                    {t.name}
                  </code>
                  <span className="text-xs text-text-muted leading-relaxed">{t.desc}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Button variant="primary" size="md" href="/mcp-setup">
                Setup guide
              </Button>
              <Link
                href="/mcp"
                className="text-sm text-text-muted transition hover:text-text-primary"
              >
                Learn more →
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <CodeBlock>{`// claude_desktop_config.json
{
  "mcpServers": {
    "readable": {
      "url": "https://booklet-mcp.ashwinsathian.com/mcp",
      "headers": { "Authorization": "Bearer bklt_YOUR_KEY" }
    }
  }
}

// Zed uses a stdio bridge instead — see /mcp-setup for its exact config`}</CodeBlock>

            <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">Works with</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { name: "Claude Desktop", color: "bg-[#D97757]/10 text-[#D97757]" },
                  { name: "Claude.ai", color: "bg-[#D97757]/10 text-[#D97757]" },
                  { name: "Cursor", color: "bg-blue-500/10 text-blue-400" },
                  { name: "Windsurf", color: "bg-teal-500/10 text-teal-400" },
                  { name: "VS Code (MCP)", color: "bg-sky-500/10 text-sky-400" },
                  { name: "Zed", color: "bg-purple-500/10 text-purple-400" },
                ].map((e) => (
                  <span
                    key={e.name}
                    className={`rounded-pill px-2.5 py-1 text-xs font-medium ${e.color}`}
                  >
                    {e.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── REST API ────────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-4 py-14 border-t border-border-subtle">
        <SectionAnchor id="rest-api" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div>
            <IntegrationBadge label="REST API" color="border-blue-500/30 bg-blue-500/8 text-blue-400" />
            <h2 className="text-2xl font-light text-text-primary mt-3 mb-3">
              REST API
            </h2>
            <p className="text-sm text-text-muted leading-relaxed mb-6">
              Full programmatic control over your pages. Publish, update, delete,
              manage slugs and visibility, retrieve page content, and handle the
              full page lifecycle from any language or environment using a simple
              REST API.
            </p>

            <div className="flex flex-col gap-3 mb-6">
              {[
                { method: "POST", path: "/api/v1/publish", desc: "Publish a new page" },
                { method: "GET", path: "/api/v1/pages", desc: "List all your pages" },
                { method: "GET", path: "/api/v1/pages/:id", desc: "Get page content and metadata" },
                { method: "PATCH", path: "/api/v1/pages/:id", desc: "Update content, slug, or visibility" },
                { method: "DELETE", path: "/api/v1/pages/:id", desc: "Permanently delete a page" },
              ].map((ep) => (
                <div key={`${ep.method} ${ep.path}`} className="flex items-start gap-3 rounded-lg border border-border-subtle bg-bg-elevated px-3.5 py-3">
                  <span className={[
                    "shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[0.65rem] font-bold font-mono uppercase tracking-wide",
                    ep.method === "GET" ? "bg-emerald-500/15 text-emerald-400" :
                    ep.method === "POST" ? "bg-blue-500/15 text-blue-400" :
                    ep.method === "PATCH" ? "bg-amber-500/15 text-amber-400" :
                    "bg-red-500/15 text-red-400",
                  ].join(" ")}>
                    {ep.method}
                  </span>
                  <div>
                    <code className="text-xs font-mono text-accent-soft">{ep.path}</code>
                    <p className="text-xs text-text-muted mt-0.5">{ep.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/api-docs"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition hover:text-accent-soft"
            >
              Full API reference
              <svg width="11" height="11" fill="none" viewBox="0 0 12 12" aria-hidden>
                <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>

          <div className="flex flex-col gap-4">
            <CodeBlock>{`# Publish a page
curl -X POST https://booklet-api.ashwinsathian.com/api/v1/publish \\
  -H "Authorization: Bearer bklt_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "raw": "# Hello\\n\\nThis is my page.",
    "slug": "my-page",
    "visibility": "public"
  }'

# Response
{
  "id": "page_abc123",
  "url": "https://booklet.ashwinsathian.com/p/my-page",
  "slug": "my-page"
}

# Update existing page
curl -X PATCH https://booklet-api.ashwinsathian.com/api/v1/pages/page_abc123 \\
  -H "Authorization: Bearer bklt_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"raw": "# Updated content"}'`}</CodeBlock>
          </div>
        </div>
      </section>

      {/* ─── Webhooks ────────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-4 py-14 border-t border-border-subtle">
        <SectionAnchor id="webhooks" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div>
            <IntegrationBadge label="Webhooks" color="border-rose-500/30 bg-rose-500/8 text-rose-400" />
            <h2 className="text-2xl font-light text-text-primary mt-3 mb-3">
              Webhooks
            </h2>
            <p className="text-sm text-text-muted leading-relaxed mb-6">
              Register an endpoint URL and {APP_NAME} will POST a signed JSON
              payload to it every time a page is published or updated. Use
              webhooks to trigger Slack notifications, update a CMS, invalidate
              caches, or build event-driven pipelines.
            </p>

            <div className="flex flex-col gap-5 mb-6">
              <Step n={1} title="Register a webhook endpoint">
                Call <code className="rounded bg-fill-2 px-1 py-0.5 text-xs font-mono text-accent-soft">POST /api/v1/webhooks</code> with your endpoint URL and the events you care about.
              </Step>
              <Step n={2} title="Verify the signature">
                Every request includes an <code className="rounded bg-fill-2 px-1 py-0.5 text-xs font-mono text-accent-soft">X-Booklet-Signature</code> HMAC-SHA256 header. Verify it against your webhook secret before processing.
              </Step>
              <Step n={3} title="Respond with 200">
                Return a <code className="rounded bg-fill-2 px-1 py-0.5 text-xs font-mono text-accent-soft">200</code> status within 5 seconds. {APP_NAME} retries on failure with exponential backoff.
              </Step>
            </div>

            <Link
              href="/api-docs#webhooks"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition hover:text-accent-soft"
            >
              Webhook reference
              <svg width="11" height="11" fill="none" viewBox="0 0 12 12" aria-hidden>
                <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>

          <div className="flex flex-col gap-4">
            <CodeBlock>{`// Webhook payload (page.published event)
{
  "event": "page.published",
  "page_id": "page_abc123",
  "url": "https://booklet.ashwinsathian.com/p/my-page",
  "slug": "my-page",
  "title": "My Page Title",
  "visibility": "public",
  "created_at": "2026-06-09T10:30:00Z"
}

// Verify HMAC-SHA256 signature (Node.js example)
import crypto from "crypto";

const sig = req.headers["x-booklet-signature"];
const expected = crypto
  .createHmac("sha256", process.env.BOOKLET_WEBHOOK_SECRET)
  .update(rawBody)
  .digest("hex");

if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
  return res.status(401).end();
}`}</CodeBlock>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-5xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-border-subtle bg-bg-elevated px-8 py-12">
          <h2 className="text-[clamp(20px,2.5vw,26px)] font-light text-text-primary mb-3">
            Ready to connect?
          </h2>
          <p className="text-sm text-text-muted mb-8 max-w-md mx-auto leading-relaxed">
            Generate an API key, pick your integration, and start publishing from wherever you work.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button variant="primary" size="lg" href="/api-docs#authentication">
              Get an API key
              <svg width="11" height="11" fill="none" viewBox="0 0 11 11" aria-hidden>
                <path d="M2 9 9 2M9 2H4.5M9 2v4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
            <Button variant="secondary" size="lg" href={ROUTES.app}>
              Try the editor
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
