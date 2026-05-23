import { AppLogo } from "@/components/ui/AppLogo";
import { ROUTES } from "@/lib/constants";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Reference — Readable",
  description: "REST API reference for publishing and managing Readable pages programmatically.",
};

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded px-1.5 py-0.5 text-[0.8em] font-mono bg-fill-2 text-accent-soft">
      {children}
    </code>
  );
}

function MethodBadge({ method }: { method: "GET" | "POST" | "PATCH" | "DELETE" }) {
  const colors: Record<string, string> = {
    GET: "bg-emerald-500/15 text-emerald-400",
    POST: "bg-blue-500/15 text-blue-400",
    PATCH: "bg-amber-500/15 text-amber-400",
    DELETE: "bg-red-500/15 text-red-400",
  };
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[0.7rem] font-bold font-mono uppercase tracking-wide ${colors[method]}`}>
      {method}
    </span>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-base font-semibold text-text-primary mb-4 pb-2 border-b border-outline">{title}</h2>
      {children}
    </section>
  );
}

function Endpoint({ method, path, description, children }: { method: "GET" | "POST" | "PATCH" | "DELETE"; path: string; description: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-1.5">
        <MethodBadge method={method} />
        <code className="text-sm font-mono text-text-primary">{path}</code>
      </div>
      <p className="text-sm text-text-secondary mb-3">{description}</p>
      {children}
    </div>
  );
}

function Pre({ children }: { children: string }) {
  return (
    <pre className="rounded-xl bg-bg-soft border border-outline p-4 text-xs font-mono text-text-secondary overflow-x-auto leading-relaxed whitespace-pre">
      {children}
    </pre>
  );
}

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-outline text-left">
            <th className="pb-2 pr-8 text-xs font-semibold text-text-muted uppercase tracking-wide">Status</th>
            <th className="pb-2 text-xs font-semibold text-text-muted uppercase tracking-wide">Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([status, reason]) => (
            <tr key={status} className="border-b border-outline/50">
              <td className="py-2 pr-8 font-mono text-xs text-amber-400">{status}</td>
              <td className="py-2 text-xs text-text-secondary">{reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-5xl px-4 h-12 flex items-center justify-between gap-4">
          <Link href={ROUTES.home}>
            <AppLogo onlyIcon={false} />
          </Link>
          <nav className="flex items-center gap-3">
            <Link
              href={ROUTES.app}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-pill border border-outline px-3.5 py-1.5 text-xs font-medium text-text-secondary transition hover:border-accent-soft/50 hover:text-text-primary"
            >
              Open editor
            </Link>
          </nav>
        </div>
      </header>

      <div className="flex-1 mx-auto w-full max-w-5xl px-4 py-10 flex gap-10">
        {/* Sidebar nav */}
        <aside className="hidden lg:block shrink-0 w-44 sticky top-20 self-start">
          <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-text-muted mb-3">On this page</p>
          <nav className="flex flex-col gap-1 text-xs">
            {[
              ["#overview", "Overview"],
              ["#authentication", "Authentication"],
              ["#publish", "Publish a page"],
              ["#frontmatter", "Frontmatter"],
              ["#update", "Update a page"],
              ["#list", "List pages"],
              ["#patch-slug", "Update slug / visibility"],
              ["#delete", "Delete a page"],
              ["#webhooks", "Webhooks"],
              ["#errors", "Error format"],
              ["#rate-limits", "Rate limits"],
              ["#github-actions", "GitHub Actions"],
              ["#mcp", "Use with Claude"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="text-text-muted hover:text-text-primary transition py-0.5">
                {label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 flex flex-col gap-10">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">API Reference</h1>
            <p className="text-sm text-text-secondary max-w-prose">
              Publish and manage Readable pages programmatically. All endpoints require an API key obtainable from{" "}
              <Link href="/my-pages" className="text-accent hover:underline">My Pages</Link>.
            </p>
          </div>

          <Section id="overview" title="Base URL">
            <Pre>{`https://readable.app/api/v1`}</Pre>
            <p className="mt-3 text-sm text-text-secondary">All requests and responses use JSON. Timestamps are ISO 8601 UTC.</p>
          </Section>

          <Section id="authentication" title="Authentication">
            <p className="text-sm text-text-secondary mb-3">
              Pass your API key in the <Code>Authorization</Code> header:
            </p>
            <Pre>{`Authorization: Bearer rdbl_live_<your-key>`}</Pre>
            <p className="mt-3 text-sm text-text-secondary">
              Generate keys at <Link href="/my-pages" className="text-accent hover:underline">/my-pages</Link>. Keys are scoped to your account and never expire (delete and regenerate to rotate).
            </p>
            <p className="mt-3 text-sm text-text-secondary">
              Each key is rate-limited to <strong className="text-text-primary">60 requests per minute</strong>. Exceeding the limit returns HTTP{" "}
              <Code>429</Code>. The limit resets at the start of the next minute. See <a href="#rate-limits" className="text-accent hover:underline">Rate limits</a> for details.
            </p>
          </Section>

          <Section id="publish" title="Publish a page">
            <Endpoint method="POST" path="/api/v1/publish" description="Creates a new published page and returns its public URL.">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Request body</p>
              <p className="text-sm text-text-secondary mb-2">
                Supply either <Code>raw</Code> (Markdown string, parsed server-side) <em>or</em> <Code>blocks</Code> (pre-parsed block array):
              </p>
              <Pre>{`// Option A — raw Markdown (recommended for CI)
{
  "raw": "# Release Notes\\n\\nWhat changed..."
}

// Option B — pre-parsed blocks
{
  "blocks": [...],
  "settings": { "width": "normal" }
}`}</Pre>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mt-4 mb-2">Response 201</p>
              <Pre>{`{
  "id": "Ab3k91QxZp",
  "url": "https://readable.app/p/Ab3k91QxZp"
}`}</Pre>
              <div className="mt-4">
                <Table rows={[
                  ["400", "Invalid JSON, empty document, or missing raw/blocks"],
                  ["401", "Missing or invalid API key"],
                  ["413", "Document too large (>350 KB)"],
                  ["429", "Rate limit exceeded (60 req/min)"],
                  ["500", "Internal storage error"],
                ]} />
              </div>
            </Endpoint>
          </Section>

          <Section id="frontmatter" title="YAML frontmatter">
            <p className="text-sm text-text-secondary mb-3">
              When supplying <Code>raw</Code> Markdown, you can include a YAML frontmatter block at the top to configure the page metadata without extra API calls:
            </p>
            <Pre>{`---
title: Incident Report — Auth Service
visibility: unlisted
slug: incident-auth-2026-05
---

# Incident Report — Auth Service

...`}</Pre>
            <p className="mt-4 text-sm text-text-secondary mb-2">Supported fields:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-outline text-left">
                    <th className="pb-2 pr-6 text-xs font-semibold text-text-muted uppercase tracking-wide">Field</th>
                    <th className="pb-2 pr-6 text-xs font-semibold text-text-muted uppercase tracking-wide">Type</th>
                    <th className="pb-2 text-xs font-semibold text-text-muted uppercase tracking-wide">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["title", "string", "Overrides the extracted H1 title (max 200 chars)"],
                    ["visibility", '"public" | "unlisted"', "Defaults to public"],
                    ["slug", "string", "Custom URL slug — requires Pro or Teams plan"],
                    ["description", "string", "Used for SEO meta description (max 300 chars)"],
                    ["author", "string", "Stored as metadata, max 100 chars"],
                    ["date", "string", "Stored as metadata, any format"],
                  ].map(([field, type, notes]) => (
                    <tr key={field} className="border-b border-outline/50">
                      <td className="py-2 pr-6 font-mono text-xs text-amber-400">{field}</td>
                      <td className="py-2 pr-6 font-mono text-xs text-text-muted">{type}</td>
                      <td className="py-2 text-xs text-text-secondary">{notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="update" title="Update a page">
            <Endpoint method="PATCH" path="/api/v1/pages/{id}" description="Updates an existing page in place. The URL stays the same. Only the page owner can update.">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Request body</p>
              <Pre>{`{ "raw": "# Updated content\\n\\n..." }`}</Pre>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mt-4 mb-2">Response 200</p>
              <Pre>{`{
  "id": "Ab3k91QxZp",
  "url": "https://readable.app/p/Ab3k91QxZp",
  "updated_at": "2026-04-29T12:00:00.000Z"
}`}</Pre>
              <div className="mt-4">
                <Table rows={[
                  ["401", "Missing or invalid API key"],
                  ["403", "Page belongs to a different account"],
                  ["404", "Page not found"],
                  ["413", "Document too large"],
                ]} />
              </div>
            </Endpoint>
          </Section>

          <Section id="list" title="List pages">
            <Endpoint method="GET" path="/api/v1/pages" description="Returns all pages owned by the authenticated account.">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Response 200</p>
              <Pre>{`{
  "pages": [
    {
      "id": "Ab3k91QxZp",
      "title": "Release Notes v2.1",
      "slug": "release-notes-v2-1",
      "visibility": "public",
      "view_count": 42,
      "url": "https://readable.app/p/release-notes-v2-1",
      "created_at": "2026-04-29T10:00:00.000Z",
      "updated_at": "2026-04-29T10:00:00.000Z"
    }
  ]
}`}</Pre>
            </Endpoint>
          </Section>

          <Section id="patch-slug" title="Update slug or visibility">
            <Endpoint method="PATCH" path="/api/v1/pages/{id}" description="Change a page's custom slug or visibility without touching content.">
              <Pre>{`// Set a custom slug
{ "slug": "my-custom-slug" }

// Remove custom slug
{ "slug": null }

// Change visibility
{ "visibility": "unlisted" }
{ "visibility": "public" }`}</Pre>
              <p className="mt-3 text-sm text-text-secondary">
                Slug rules: 1–60 chars, lowercase letters / digits / hyphens, no consecutive hyphens, must start and end with a letter or digit.
              </p>
            </Endpoint>
          </Section>

          <Section id="delete" title="Delete a page">
            <Endpoint method="DELETE" path="/api/v1/pages/{id}" description="Permanently deletes a page. This can't be undone.">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Response 200</p>
              <Pre>{`{ "ok": true }`}</Pre>
              <div className="mt-4">
                <Table rows={[
                  ["401", "Missing or invalid API key"],
                  ["403", "Page belongs to a different account"],
                  ["404", "Page not found"],
                ]} />
              </div>
            </Endpoint>
          </Section>

          <Section id="webhooks" title="Webhooks">
            <p className="text-sm text-text-secondary mb-4">
              Register HTTP endpoints to receive a signed POST request whenever a page is published or updated. Available on Pro and Teams plans. Maximum 5 webhooks per account.
            </p>

            <Endpoint method="GET" path="/api/webhooks" description="List all registered webhooks for your account. Secrets are not returned.">
              <Pre>{`{
  "webhooks": [
    {
      "id": "Wk9xZ2mP1q",
      "url": "https://hooks.example.com/readable",
      "events": ["page.published", "page.updated"],
      "created_at": "2026-05-01T10:00:00.000Z",
      "last_triggered_at": "2026-05-15T14:32:00.000Z"
    }
  ]
}`}</Pre>
            </Endpoint>

            <Endpoint method="POST" path="/api/webhooks" description="Register a new webhook. Returns the signing secret — store it securely, it is not shown again.">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Request body</p>
              <Pre>{`{
  "url": "https://hooks.example.com/readable",
  "events": ["page.published", "page.updated"]
}`}</Pre>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mt-4 mb-2">Response 201</p>
              <Pre>{`{
  "id": "Wk9xZ2mP1q",
  "url": "https://hooks.example.com/readable",
  "events": ["page.published"],
  "secret": "rdbl_whsec_abc123..."
}`}</Pre>
            </Endpoint>

            <Endpoint method="DELETE" path="/api/webhooks/{id}" description="Remove a webhook. Returns 204 No Content.">
            </Endpoint>

            <div className="rounded-xl border border-border-subtle bg-bg-elevated p-5 text-sm">
              <p className="font-semibold text-text-primary mb-2">Verifying webhook signatures</p>
              <p className="text-text-secondary mb-3">
                Every delivery includes an <Code>X-Readable-Signature</Code> header containing <Code>sha256=&lt;HMAC-SHA256&gt;</Code> of the raw request body, computed with your webhook secret. Verify this before trusting the payload.
              </p>
              <Pre>{`// Node.js example
const crypto = require('crypto');

function verifySignature(rawBody, secret, header) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(header)
  );
}`}</Pre>
              <p className="mt-3 text-text-secondary">The payload body shape:</p>
              <Pre>{`{
  "event": "page.published",
  "page_id": "Ab3k91QxZp",
  "page_url": "https://readable.app/p/Ab3k91QxZp",
  "title": "Incident Report — Auth Service",
  "published_at": "2026-05-19T08:32:00.000Z"
}`}</Pre>
            </div>
          </Section>

          <Section id="errors" title="Error format">
            <p className="text-sm text-text-secondary mb-3">All errors use the same shape:</p>
            <Pre>{`{
  "error": "Human-readable error message"
}`}</Pre>
          </Section>

          <Section id="rate-limits" title="Rate limits">
            <p className="text-sm text-text-secondary">
              Each endpoint allows <strong className="text-text-primary">60 requests per minute</strong> per API key. Exceeding the limit returns HTTP 429. The limit resets at the start of the next minute.
            </p>
          </Section>

          <Section id="github-actions" title="GitHub Actions example">
            <p className="text-sm text-text-secondary mb-3">
              Publish or update a page on every release tag push:
            </p>
            <Pre>{`# .github/workflows/publish-release-notes.yml
name: Publish release notes

on:
  push:
    tags: ["v*"]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Publish to Readable
        env:
          READABLE_API_KEY: \${{ secrets.READABLE_API_KEY }}
          PAGE_ID: \${{ vars.READABLE_PAGE_ID }}   # optional: update in-place
        run: |
          BODY=$(jq -n --rawfile raw CHANGELOG.md '{"raw": $raw}')

          if [ -n "$PAGE_ID" ]; then
            curl -fsSL -X PATCH "https://readable.app/api/v1/pages/$PAGE_ID" \\
              -H "Authorization: Bearer $READABLE_API_KEY" \\
              -H "Content-Type: application/json" \\
              -d "$BODY"
          else
            curl -fsSL -X POST "https://readable.app/api/v1/publish" \\
              -H "Authorization: Bearer $READABLE_API_KEY" \\
              -H "Content-Type: application/json" \\
              -d "$BODY" | jq -r '.url'
          fi`}</Pre>
            <p className="mt-3 text-sm text-text-secondary">
              Add <Code>READABLE_API_KEY</Code> under Settings → Secrets → Actions. Set <Code>READABLE_PAGE_ID</Code> as a repository variable to reuse the same URL on every run.
            </p>
          </Section>

          <Section id="mcp" title="Use with Claude">
            <p className="text-sm text-text-secondary mb-4">
              Readable has an MCP server that lets Claude publish and manage pages on your behalf. Once connected, you can ask Claude to publish a document, update an existing page, or list your pages — all without leaving the conversation.
            </p>

            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Connection instructions</p>
            <ol className="list-decimal list-inside text-sm text-text-secondary space-y-1.5 mb-4 ml-1">
              <li>Go to Claude settings → Connectors</li>
              <li>
                Add a new MCP connector with URL:{" "}
                <Code>https://mcp.readable.ashwinsathian.com</Code>
              </li>
              <li>
                When prompted, enter your Readable API key (<Code>rdbl_live_...</Code>) from{" "}
                <Link href="/my-pages" className="text-accent hover:underline">/my-pages</Link>
              </li>
              <li>
                Claude will then have access to:{" "}
                <Code>publish_page</Code>, <Code>update_page</Code>, <Code>list_pages</Code>, <Code>delete_page</Code>
              </li>
            </ol>

            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Example conversation</p>
            <Pre>{`You: Publish this as a Readable page: [markdown content]
Claude: Published. Here's your link: https://readable.ashwinsathian.com/p/Ab3k91QxZp`}</Pre>

            <div className="mt-4 text-sm text-text-secondary rounded-xl border border-border-subtle bg-bg-elevated p-4 space-y-1.5">
              <p>
                Your API key is passed directly to the Readable REST API on each tool call. The MCP server acts as a thin proxy — it holds the key only for the duration of the SSE session and never writes it to persistent storage.
              </p>
              <p>
                To revoke MCP access, delete the API key from{" "}
                <Link href="/my-pages" className="text-accent hover:underline">/my-pages</Link>.
                This invalidates the key immediately across all clients including Claude.
              </p>
            </div>
          </Section>
        </main>
      </div>

      <footer className="border-t border-outline py-8">
        <div className="mx-auto max-w-5xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
          <Link href={ROUTES.home} className="hover:text-text-primary transition">
            readable
          </Link>
          <div className="flex items-center gap-4">
            <Link href={ROUTES.home} className="hover:text-text-primary transition">Home</Link>
            <Link href={ROUTES.app} className="hover:text-text-primary transition">Editor</Link>
            <Link href="/my-pages" className="hover:text-text-primary transition">My pages</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
