import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import Link from "next/link";
import { schemaExamples, type OpenApiSchemaName } from "booklet-api-client";
import type { Metadata } from "next";

export const metadata: Metadata = buildMetadata({
  title: "REST API Reference",
  description:
    "Complete REST API reference for Booklet — publish pages, update content, manage slugs, and set up webhooks programmatically. Includes GitHub Actions integration examples.",
  pathname: "/api-docs",
});

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  name: "Booklet REST API Reference",
  description:
    "Complete REST API reference for Booklet — publish pages, update content, manage slugs, and set up webhooks programmatically.",
  url: absoluteUrl("/api-docs"),
  author: { "@type": "Organization", name: "Booklet" },
  proficiencyLevel: "Expert",
  articleSection: "API Documentation",
  keywords: "REST API, markdown, publish pages, webhooks, GitHub Actions",
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
      <h2 className="text-base text-text-primary mb-4 pb-2 border-b border-border-default font-display">{title}</h2>
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
    <pre tabIndex={0} className="rounded-xl bg-bg-soft border border-border-default p-4 text-xs font-mono text-text-secondary overflow-x-auto leading-relaxed whitespace-pre">
      {children}
    </pre>
  );
}

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border-default text-left">
            <th className="pb-2 pr-8 text-xs font-semibold text-text-muted uppercase tracking-wide">Status</th>
            <th className="pb-2 text-xs font-semibold text-text-muted uppercase tracking-wide">Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([status, reason]) => (
            <tr key={status} className="border-b border-border-default/50">
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
  const base = absoluteUrl("").replace(/\/$/, "");
  const mcpBase = "https://booklet-mcp.ashwinsathian.com";
  // Every request and response example on this page comes from the schemas
  // behind /api/v1/openapi.json, so the page cannot disagree with the API.
  const ex = (name: OpenApiSchemaName, i = 0) =>
    JSON.stringify(schemaExamples(name)[i], null, 2).replaceAll("https://booklet.ashwinsathian.com", base);

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />

      <div className="flex-1 mx-auto w-full max-w-5xl px-4 py-10 flex gap-10">
        {/* Sidebar nav */}
        <aside className="hidden lg:block shrink-0 w-44 sticky top-24 self-start">
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
              ["#idempotency", "Safe retries"],
              ["#conditional", "Conditional requests"],
              ["#webhooks", "Webhooks"],
              ["#errors", "Error format"],
              ["#rate-limits", "Rate limits"],
              ["#github-actions", "GitHub Actions"],
              ["#mcp", "Use with Claude"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="text-text-muted hover:text-text-primary transition py-1">
                {label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 flex flex-col gap-10">
          <div>
            <h1 className="text-[clamp(22px,3vw,28px)] mb-2 font-display">API Reference</h1>
            <p className="text-sm text-text-secondary max-w-prose">
              Publish and manage Booklet pages programmatically. All endpoints require an API key obtainable from{" "}
              <Link href="/settings/api-keys" className="text-accent underline underline-offset-2">Settings, API keys</Link>.
            </p>
          </div>

          <Section id="overview" title="Base URL">
            <Pre>{`${base}/api/v1`}</Pre>
            <p className="mt-3 text-sm text-text-secondary">All requests and responses use JSON. Timestamps are ISO 8601 UTC.</p>
            <p className="mt-3 text-sm text-text-secondary">
              The whole API is described in OpenAPI 3.1 at{" "}
              <a href="/api/v1/openapi.json" className="text-accent underline underline-offset-2"><Code>/api/v1/openapi.json</Code></a>.
            </p>
          </Section>

          <Section id="authentication" title="Authentication">
            <p className="text-sm text-text-secondary mb-3">
              Pass your API key in the <Code>Authorization</Code> header:
            </p>
            <Pre>{`Authorization: Bearer bklt_<your-key>`}</Pre>
            <p className="mt-3 text-sm text-text-secondary">
              Generate keys at <Link href="/settings/api-keys" className="text-accent underline underline-offset-2">/settings/api-keys</Link>. Keys are scoped to your account and never expire (delete and regenerate to rotate).
            </p>
            <p className="mt-3 text-sm text-text-secondary">
              Each key is rate-limited to <strong className="text-text-primary">60 requests per minute</strong>. Exceeding the limit returns HTTP{" "}
              <Code>429</Code>. The limit resets at the start of the next minute. See <a href="#rate-limits" className="text-accent underline underline-offset-2">Rate limits</a> for details.
            </p>
          </Section>

          <Section id="publish" title="Publish a page">
            <Endpoint method="POST" path="/api/v1/publish" description="Creates a new published page and returns its public URL.">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Request body</p>
              <p className="text-sm text-text-secondary mb-2">
                Supply <Code>raw</Code> Markdown — always parsed server-side:
              </p>
              <Pre>{ex("PublishRequest")}</Pre>
              <p className="mt-3 text-sm text-text-secondary">
                <Code>visibility</Code> is optional. A new page is <Code>unlisted</Code> unless you set{" "}
                <Code>public</Code> here or in frontmatter: anyone with the link can read it, and it stays out of
                Explore, the sitemap and search engines. <Code>raw</Code> can be up to 200,000 characters.
              </p>
              <p className="mt-3 text-sm text-text-secondary">
                <Code>space</Code> is the slug of a team space you can write to (the last part of{" "}
                <Code>/t/&lt;slug&gt;</Code>). The page is created in it. With <Code>visibility: &quot;team&quot;</Code>,
                only members of that space can open the page and everyone else gets a 404.{" "}
                <Code>team</Code> without a space is a 422.
              </p>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mt-4 mb-2">Response 201</p>
              <Pre>{ex("PublishResponse")}</Pre>
              <div className="mt-4">
                <Table rows={[
                  ["400", "Invalid JSON, empty document, or missing raw"],
                  ["401", "Missing or invalid API key"],
                  ["403", "You can read the team space but not publish to it"],
                  ["404", "No team space with that slug, or you are not in it"],
                  ["409", "The frontmatter slug is taken"],
                  ["413", "Document too large: over 200,000 characters, or over 600,000 bytes once parsed"],
                  ["422", "Invalid slug, visibility team without a space, or an Idempotency-Key reused with a different body"],
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
                  <tr className="border-b border-border-default text-left">
                    <th className="pb-2 pr-6 text-xs font-semibold text-text-muted uppercase tracking-wide">Field</th>
                    <th className="pb-2 pr-6 text-xs font-semibold text-text-muted uppercase tracking-wide">Type</th>
                    <th className="pb-2 text-xs font-semibold text-text-muted uppercase tracking-wide">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["title", "string", "Overrides the extracted H1 title (max 200 chars)"],
                    ["visibility", '"public" | "unlisted" | "team"', "Defaults to unlisted (link only, not listed or indexed). team needs space"],
                    ["space", "string", "Slug of a team space to publish into"],
                    ["type", "string", "incident, postmortem, adr, rfc, runbook or release-notes. Shown above the page and used to group a team space"],
                    ["status", "string", "Shown above the page, e.g. Proposed, Accepted, Resolved (max 40 chars)"],
                    ["severity", "string", "Shown above the page, e.g. P1 (max 20 chars)"],
                    ["owners", "string[]", "People or teams responsible, shown above the page"],
                    ["supersedes", "string", "Title of the document this one replaces"],
                    ["slug", "string", "Custom URL slug — available to all signed-in accounts (max 60 chars)"],
                    ["description", "string", "Used for SEO meta description (max 300 chars)"],
                    ["author", "string", "Stored as metadata, max 100 chars"],
                    ["date", "string", "Shown above the page. YYYY-MM-DD is formatted; anything else is shown as written"],
                  ].map(([field, type, notes]) => (
                    <tr key={field} className="border-b border-border-default/50">
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
              <Pre>{ex("PatchPageRequest")}</Pre>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mt-4 mb-2">Response 200</p>
              <Pre>{ex("PatchPageResponse")}</Pre>
              <div className="mt-4">
                <Table rows={[
                  ["401", "Missing or invalid API key"],
                  ["403", "Page belongs to a different account"],
                  ["404", "Page not found"],
                  ["412", "If-Match did not match the page's current ETag"],
                  ["413", "Document too large"],
                ]} />
              </div>
            </Endpoint>
          </Section>

          <Section id="list" title="List pages">
            <Endpoint method="GET" path="/api/v1/pages" description="Returns the pages owned by the authenticated account, newest first.">
              <p className="text-sm text-text-secondary mb-3">
                Query parameters: <Code>limit</Code> (1 to 100, default 20), <Code>cursor</Code>, <Code>q</Code>{" "}
                (title contains), <Code>tag</Code>, <Code>type</Code> (a document type) and <Code>space</Code> (the
                slug of a team space you belong to: the list is then every page in that space, not only yours). To
                read every page, pass each response&apos;s{" "}
                <Code>next_cursor</Code> as <Code>cursor</Code> until it is <Code>null</Code>. Pages published or
                deleted while you walk the list are never repeated or skipped. <Code>offset</Code> still works.
              </p>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Response 200</p>
              <Pre>{ex("ListPagesResponse")}</Pre>
            </Endpoint>
            <Endpoint method="GET" path="/api/v1/pages/{id}" description="Returns one page with its raw Markdown. The id can be the page ID or its custom slug.">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Response 200</p>
              <Pre>{ex("PageDetail")}</Pre>
            </Endpoint>
          </Section>

          <Section id="patch-slug" title="Update slug or visibility">
            <Endpoint method="PATCH" path="/api/v1/pages/{id}" description="Change a page's custom slug or visibility without touching content.">
              <p className="text-sm text-text-secondary mb-2">Set a custom slug, remove it, or change visibility:</p>
              <Pre>{[1, 2, 3].map((i) => ex("PatchPageRequest", i)).join("\n\n")}</Pre>
              <p className="mt-3 text-sm text-text-secondary">
                Slug rules: 3–60 chars, lowercase letters / digits / hyphens, no consecutive hyphens, must start and end with a letter or digit.
              </p>
            </Endpoint>
          </Section>

          <Section id="delete" title="Delete a page">
            <Endpoint method="DELETE" path="/api/v1/pages/{id}" description="Permanently deletes a page. This can't be undone.">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Response 200</p>
              <Pre>{ex("DeletePageResponse")}</Pre>
              <div className="mt-4">
                <Table rows={[
                  ["401", "Missing or invalid API key"],
                  ["403", "Page belongs to a different account"],
                  ["404", "Page not found"],
                ]} />
              </div>
            </Endpoint>
          </Section>

          <Section id="idempotency" title="Safe retries">
            <p className="text-sm text-text-secondary mb-3">
              Send an <Code>Idempotency-Key</Code> header with <Code>POST /api/v1/publish</Code> when a retry must
              not publish twice, for example in a CI job that can be re-run. Any unique string up to 255 characters
              works. For 24 hours, a repeat with the same key and body returns the first response (with{" "}
              <Code>Idempotent-Replayed: true</Code>) and creates nothing. The same key with a different body
              returns <Code>422</Code>. A request that failed does not use up its key.
            </p>
            <Pre>{`curl -X POST "${base}/api/v1/publish" \\
  -H "Authorization: Bearer $BOOKLET_API_KEY" \\
  -H "Idempotency-Key: $GITHUB_RUN_ID-CHANGELOG.md" \\
  -H "Content-Type: application/json" \\
  -d "$BODY"`}</Pre>
          </Section>

          <Section id="conditional" title="Conditional requests">
            <p className="text-sm text-text-secondary">
              <Code>GET /api/v1/pages/{"{id}"}</Code> returns an <Code>ETag</Code> header. Send it back as{" "}
              <Code>If-Match</Code> on <Code>PATCH</Code> or <Code>DELETE</Code> to change the page only if nobody
              else changed it first; a stale tag returns <Code>412</Code> and changes nothing. Without{" "}
              <Code>If-Match</Code> the write always applies. <Code>If-None-Match</Code> on a read returns{" "}
              <Code>304</Code> when the page is unchanged.
            </p>
          </Section>

          <Section id="webhooks" title="Webhooks">
            <p className="text-sm text-text-secondary mb-4">
              Register HTTP endpoints to receive a signed POST request whenever a page is published or updated. Available to all signed-in accounts. Maximum 5 webhooks per account.
            </p>

            <Endpoint method="GET" path="/api/webhooks" description="List all registered webhooks for your account. Secrets are not returned.">
              <Pre>{ex("WebhookList")}</Pre>
            </Endpoint>

            <Endpoint method="POST" path="/api/webhooks" description="Register a new webhook. Returns the signing secret — store it securely, it is not shown again.">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Request body</p>
              <Pre>{ex("CreateWebhookRequest")}</Pre>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mt-4 mb-2">Response 201</p>
              <Pre>{ex("CreateWebhookResponse")}</Pre>
            </Endpoint>

            <Endpoint method="DELETE" path="/api/webhooks/{id}" description="Remove a webhook. Returns 204 No Content.">
            </Endpoint>

            <div className="rounded-xl border border-border-subtle bg-bg-elevated p-5 text-sm">
              <p className="font-semibold text-text-primary mb-2">Verifying webhook signatures</p>
              <p className="text-text-secondary mb-3">
                Every delivery includes an <Code>X-Booklet-Signature</Code> header containing <Code>sha256=&lt;HMAC-SHA256&gt;</Code> of the raw request body, computed with your webhook secret. Verify this before trusting the payload.
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
              <Pre>{ex("WebhookDelivery")}</Pre>
            </div>
          </Section>

          <Section id="errors" title="Error format">
            <p className="text-sm text-text-secondary mb-3">
              Errors are RFC 9457 problem details, sent as <Code>application/problem+json</Code>.{" "}
              <Code>detail</Code> is the message to show a person. <Code>error</Code> repeats it and is kept for
              clients written before problem details. A <Code>413</Code> also says which limit was hit:{" "}
              <Code>limit</Code> is <Code>characters</Code> or <Code>stored_bytes</Code>, with <Code>max</Code> and{" "}
              <Code>actual</Code>.
            </p>
            <Pre>{ex("Problem")}</Pre>
          </Section>

          <Section id="rate-limits" title="Rate limits">
            <p className="text-sm text-text-secondary mb-3">
              Each endpoint allows <strong className="text-text-primary">60 requests per minute</strong> per account
              (120 for reading a single page). Every response says where you stand:
            </p>
            <Pre>{`RateLimit-Policy: "default";q=60;w=60
RateLimit: "default";r=59;t=42`}</Pre>
            <p className="mt-3 text-sm text-text-secondary">
              <Code>r</Code> is the number of requests left and <Code>t</Code> the seconds until the count resets.
              Past the limit the API returns <Code>429</Code> with a <Code>Retry-After</Code> header in seconds.
              The <Code>RateLimit</Code> headers follow an IETF draft that may still change;{" "}
              <Code>Retry-After</Code> will not.
            </p>
          </Section>

          <Section id="github-actions" title="GitHub Actions">
            <p className="text-sm text-text-secondary mb-3">
              Use the dedicated <Code>booklet-cli</Code> action, or call the REST API directly with <Code>curl</Code>:
            </p>

            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Option A — CLI (recommended)</p>
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

      - name: Publish to Booklet
        env:
          BOOKLET_API_KEY: \${{ secrets.BOOKLET_API_KEY }}
        run: |
          if [ -n "\${{ vars.BOOKLET_PAGE_ID }}" ]; then
            npx booklet-cli publish CHANGELOG.md \\
              --update \${{ vars.BOOKLET_PAGE_ID }}
          else
            npx booklet-cli publish CHANGELOG.md \\
              --slug release-notes --visibility public
          fi`}</Pre>

            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mt-5 mb-2">Option B — raw curl</p>
            <Pre>{`      - name: Publish to Booklet
        env:
          BOOKLET_API_KEY: \${{ secrets.BOOKLET_API_KEY }}
          PAGE_ID: \${{ vars.BOOKLET_PAGE_ID }}   # optional: update in-place
        run: |
          BODY=$(jq -n --rawfile raw CHANGELOG.md '{"raw": $raw}')

          if [ -n "$PAGE_ID" ]; then
            curl -fsSL -X PATCH "${base}/api/v1/pages/$PAGE_ID" \\
              -H "Authorization: Bearer $BOOKLET_API_KEY" \\
              -H "Content-Type: application/json" \\
              -d "$BODY"
          else
            curl -fsSL -X POST "${base}/api/v1/publish" \\
              -H "Authorization: Bearer $BOOKLET_API_KEY" \\
              -H "Content-Type: application/json" \\
              -d "$BODY" | jq -r '.url'
          fi`}</Pre>
            <p className="mt-3 text-sm text-text-secondary">
              Add <Code>BOOKLET_API_KEY</Code> under Settings → Secrets → Actions. Set <Code>BOOKLET_PAGE_ID</Code> as a repository variable to reuse the same URL on every run.
            </p>
          </Section>

          <Section id="mcp" title="Use with Claude (MCP)">
            <p className="text-sm text-text-secondary mb-4">
              Booklet has an MCP server that lets Claude, Cursor, Windsurf, VS Code, and Zed
              publish and manage pages on your behalf — entirely through conversation.
            </p>

            <div className="rounded-xl border border-border-default bg-bg-elevated p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary mb-0.5">Full setup guide →</p>
                <p className="text-xs text-text-secondary">
                  Step-by-step instructions for every platform — Claude Desktop, Claude.ai, Cursor,
                  Windsurf, VS Code, Zed.
                </p>
              </div>
              <Link
                href="/mcp-setup"
                className="shrink-0 inline-flex items-center gap-1.5 rounded-pill bg-accent px-4 py-2 text-xs font-semibold text-accent-contrast hover:bg-accent-soft transition"
              >
                Add to Claude
                <svg width="10" height="10" fill="none" viewBox="0 0 12 12" aria-hidden>
                  <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>

            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Quick reference</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg border border-border-default p-3">
                <p className="text-xs font-semibold text-text-primary mb-1">MCP endpoint</p>
                <Code>{mcpBase}/mcp</Code>
              </div>
              <div className="rounded-lg border border-border-default p-3">
                <p className="text-xs font-semibold text-text-primary mb-1">Auth header</p>
                <Code>Authorization: Bearer bklt_YOUR_KEY</Code>
              </div>
            </div>

            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Available tools</p>
            <p className="text-sm text-text-secondary mb-1">
              <Code>publish_page</Code>, <Code>update_page</Code>, <Code>get_page</Code>,{" "}
              <Code>list_pages</Code>, <Code>delete_page</Code>
            </p>
            <p className="text-sm text-text-secondary">
              Templates: <Code>incident_report</Code>, <Code>adr</Code>,{" "}
              <Code>release_notes</Code>, <Code>rfc</Code>, <Code>runbook</Code>
            </p>
          </Section>
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}
