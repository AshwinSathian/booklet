# Booklet MCP Server Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `mcp-server/` from a hand-rolled JSON-RPC dispatcher hardcoded to protocol
`2025-03-26` onto the official `@modelcontextprotocol/sdk`, add tool annotations, structured
output, resource links, and Origin validation — while cutting (not growing) token cost per call,
and preserving the production-verify script's text-parsing contract and the stateless-per-request
design.

**Architecture:** `McpServer` (SDK) + `WebStandardStreamableHTTPServerTransport` in stateless
mode (`sessionIdGenerator: undefined`), built fresh per HTTP request inside the existing
`fetch(request, env): Promise<Response>` handler. `node-server.ts` (the Node↔Web-Request bridge
that runs this under PM2) is untouched — the transport's `handleRequest(request)` is
Web-`Request`-in/`Response`-out, a drop-in for what `handleMcpPost` does today. Zod schemas own
input validation (replacing hand-written `validate*` functions); the SDK surfaces Zod validation
failures as Tool Execution Errors automatically, matching the existing (and spec-correct)
convention.

**Tech Stack:** `@modelcontextprotocol/sdk` (^1.30.0, stable), `zod` (^4.4.3, matches root and
`booklet-api-client`'s existing version), TypeScript, `tsx` (unchanged runtime), `@playwright/test`
(root's existing plain-Node unit test runner, for the two new pure-function modules that fit it).

## Global Constraints

- Text (`content[].text`) output of all five tools must stay **byte-identical in shape** to
  today — `scripts/production-verify/cli-mcp-verify.mjs` regex-parses it against production
  (`URL: `, `^ID:\s*(\S+)`, title substring, Markdown table for `list_pages`) and is the only
  real end-to-end safety net this server has. Additive changes only (structured content,
  resource links) — never remove or reshape an existing text line.
- No OAuth 2.1 / Protected Resource Metadata / Dynamic Client Registration — confirmed out of
  scope (see design doc, "Decisions").
- No changes to `mcp-server/src/node-server.ts` or `mcp-server/src/auth.ts` (`extractApiKey`
  stays exactly as-is — same regex, same 401 behavior).
- `mcp-server/package.json`'s `dev`/`serve:node` scripts, and PM2's `ecosystem.config.js` entry
  for `booklet-mcp` (`npx tsx src/node-server.ts`), are unchanged — the compiled entry point
  shape doesn't change, only what's inside `index.ts` and its new imports.
- Do not touch unrelated in-progress changes already in the working tree (`src/app/app/
  AppClient.tsx`, `src/components/app/TopBar.tsx`, `src/components/marketing/Landing.tsx`,
  `src/components/share/ExportMenu.tsx`, `src/lib/export/html.ts`,
  `tests/unit/export-html.spec.ts`) — these are pre-existing uncommitted work, not part of this
  plan. Never `git add` them.
- Design doc: `docs/superpowers/specs/2026-08-04-mcp-server-modernization-design.md`.
- No dedicated docs task in this plan: `README.md`'s MCP section makes no protocol-version claim
  to correct, and `SECURITY.md` doesn't describe the MCP server's transport/auth model — the
  design doc conditioned doc updates on one of those making a claim this work invalidates, and
  neither does. Not an oversight; intentionally out of scope.

---

### Task 1: Add SDK and Zod dependencies to the `mcp-server` workspace

**Files:**
- Modify: `mcp-server/package.json`

**Interfaces:**
- Produces: `@modelcontextprotocol/sdk` and `zod` importable from any file under `mcp-server/src`.

- [ ] **Step 1: Add the dependencies**

Edit `mcp-server/package.json`'s `dependencies` block to:

```json
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.30.0",
    "booklet-api-client": "^0.1.0",
    "zod": "^4.4.3"
  },
```

- [ ] **Step 2: Install and verify the workspace resolves**

Run: `npm install` (from the repo root — this is an npm workspace)
Expected: completes with no `ERESOLVE` errors; `node_modules/@modelcontextprotocol/sdk` and a
`zod` resolvable from `mcp-server/` both exist (workspaces hoist to the root `node_modules`
unless a version conflict forces a nested copy — either is fine).

Run: `cd mcp-server && npx tsc --noEmit`
Expected: passes (no source changes yet, so this just confirms the dependency install didn't
break the existing typecheck).

- [ ] **Step 3: Commit**

```bash
git add mcp-server/package.json package-lock.json
git commit -m "$(cat <<'EOF'
build(mcp-server): add @modelcontextprotocol/sdk and zod dependencies

First step of migrating mcp-server off its hand-rolled JSON-RPC dispatcher
(hardcoded to protocol 2025-03-26) onto the official SDK, which negotiates
correctly up to 2025-11-25 and adds tool annotations / structured output.
EOF
)"
```

---

### Task 2: Zod input/output schemas (`schemas.ts`)

Replaces the hand-written `validatePublishArgs`/`validateUpdateArgs`/`validateGetArgs`/
`validateListArgs`/`validateDeleteArgs` functions in `tools.ts` (deleted in Task 4) with Zod
schemas the SDK validates automatically before invoking a tool callback — same rules, less code,
and validation failures already surface as Tool Execution Errors (SEP-1303-correct) without any
hand-written try/catch for a validation-specific exception type.

**Files:**
- Create: `mcp-server/src/schemas.ts`
- Test: `tests/unit/mcp-slug.spec.ts`

**Interfaces:**
- Produces: `SLUG_PATTERN` (RegExp), `PublishPageInputSchema`, `UpdatePageInputSchema`,
  `GetPageInputSchema`, `ListPagesInputSchema`, `DeletePageInputSchema` (Zod object schemas,
  consumed by Task 6's `registerTool` calls), `PublishPageOutputSchema`,
  `UpdatePageOutputSchema`, `GetPageOutputSchema`, `DeletePageOutputSchema` (Zod object schemas
  for `structuredContent`, consumed by Task 4's handlers and Task 6's `registerTool` calls).

- [ ] **Step 1: Write the failing test for slug validation**

The existing `SLUG_PATTERN` regex has a documented history of drift (see the comment being moved
in Task 4) — worth locking down with a real test since it's never had one.

Create `tests/unit/mcp-slug.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { PublishPageInputSchema } from "../../mcp-server/src/schemas.js";

test.describe("PublishPageInputSchema slug validation", () => {
  const base = { raw: "# Hello" };

  test("accepts a valid 3-char slug", () => {
    expect(PublishPageInputSchema.safeParse({ ...base, slug: "abc" }).success).toBe(true);
  });

  test("accepts a valid hyphenated slug", () => {
    expect(PublishPageInputSchema.safeParse({ ...base, slug: "my-release-notes" }).success).toBe(true);
  });

  test("rejects a 2-char slug", () => {
    expect(PublishPageInputSchema.safeParse({ ...base, slug: "ab" }).success).toBe(false);
  });

  test("rejects consecutive hyphens", () => {
    expect(PublishPageInputSchema.safeParse({ ...base, slug: "my--slug" }).success).toBe(false);
  });

  test("rejects a leading hyphen", () => {
    expect(PublishPageInputSchema.safeParse({ ...base, slug: "-my-slug" }).success).toBe(false);
  });

  test("rejects a trailing hyphen", () => {
    expect(PublishPageInputSchema.safeParse({ ...base, slug: "my-slug-" }).success).toBe(false);
  });

  test("rejects uppercase", () => {
    expect(PublishPageInputSchema.safeParse({ ...base, slug: "MySlug" }).success).toBe(false);
  });

  test("rejects raw over 350,000 characters", () => {
    expect(PublishPageInputSchema.safeParse({ raw: "a".repeat(350_001) }).success).toBe(false);
  });

  test("rejects an empty raw", () => {
    expect(PublishPageInputSchema.safeParse({ raw: "" }).success).toBe(false);
  });

  test("accepts omitted optional fields", () => {
    expect(PublishPageInputSchema.safeParse(base).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test --config=playwright.unit.config.ts mcp-slug`
Expected: FAIL — `mcp-server/src/schemas.ts` doesn't exist yet (module not found).

- [ ] **Step 3: Write `schemas.ts`**

Create `mcp-server/src/schemas.ts`:

```ts
import { z } from "zod";
import { VisibilitySchema } from "booklet-api-client";

// Mirrors src/lib/slug.ts's canonical rule in the main app (3-60 chars,
// no leading/trailing/consecutive hyphens) — this package is a standalone
// npm workspace with no shared build step with the main app, so the rule
// is duplicated here rather than imported. Keep in sync if that file
// changes: the two previously drifted (this used to allow 1-2 char slugs,
// which the REST API's v1/publish and v1/pages routes now reject with a
// 422 after the slug-validation unification), causing a wasted round trip
// for anything shorter than 3 characters.
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$|^[a-z0-9]{3,60}$/;

function isValidSlug(s: string): boolean {
  return SLUG_PATTERN.test(s) && !s.includes("--");
}

// Each .describe() below is the ONLY place these constraints are visible to
// the model (they end up in the tool's JSON Schema, sent on every
// tools/list) — so they're trimmed to exactly what prevents a failed call
// (char limits, the slug rule, what `confirm` does), not a feature tour of
// Markdown. Per the design doc's token-efficiency section: MCP tool schemas
// already cost materially more tokens than a minimal equivalent, and
// tools/list is loaded into every session.
const slugSchema = z
  .string()
  .refine(isValidSlug, "`slug` must be 3-60 lowercase letters, numbers, or hyphens (no leading/trailing/consecutive hyphens)")
  .describe(
    'Custom URL slug, e.g. "my-release-notes". 3-60 lowercase letters/numbers/hyphens, no leading, trailing, or consecutive hyphens. Results in a URL like /p/my-release-notes.',
  );

export const PublishPageInputSchema = z.object({
  raw: z
    .string()
    .min(1, "`raw` must be a non-empty string")
    .max(350_000, "`raw` exceeds 350,000 character limit")
    .describe("Markdown content to publish (GFM + Mermaid diagrams). Max 350,000 characters."),
  title: z.string().optional().describe("Overrides the page title. Defaults to the first H1 in `raw`."),
  slug: slugSchema.optional(),
  visibility: VisibilitySchema.optional().describe(
    '"public" (default, listed) or "unlisted" (hidden from listings, still reachable by URL).',
  ),
});

export const UpdatePageInputSchema = z
  .object({
    id: z.string().min(1, "`id` must be a non-empty string").describe("The page ID or custom slug to update."),
    raw: z
      .string()
      .min(1, "`raw` must be a non-empty string if provided")
      .max(350_000, "`raw` exceeds 350,000 character limit")
      .optional()
      .describe("New Markdown content. Replaces the existing content entirely."),
    slug: slugSchema
      .nullable()
      .optional()
      .describe("New custom slug, or null to remove it and revert to the page ID."),
    visibility: VisibilitySchema.optional().describe('Change visibility to "public" or "unlisted".'),
  })
  .refine(
    (v) => v.raw !== undefined || v.slug !== undefined || v.visibility !== undefined,
    "Provide at least one of: `raw`, `slug`, `visibility`",
  );

export const GetPageInputSchema = z.object({
  id: z.string().min(1, "`id` must be a non-empty string").describe("The page ID or custom slug to retrieve."),
});

export const ListPagesInputSchema = z.object({
  limit: z.number().int().positive().max(100).optional().describe("Max pages to return. Default 20, max 100."),
  offset: z.number().int().nonnegative().optional().describe("Pages to skip, for pagination. Default 0."),
});

export const DeletePageInputSchema = z.object({
  id: z.string().min(1, "`id` must be a non-empty string").describe("The page ID to delete."),
  confirm: z
    .boolean()
    .refine((v) => v === true, "`confirm` must be true to delete a page. This action cannot be undone.")
    .describe("Must be true to proceed. Prevents accidental deletion — this cannot be undone."),
});

export const PublishPageOutputSchema = z.object({
  id: z.string(),
  url: z.string(),
});

export const UpdatePageOutputSchema = z.object({
  id: z.string(),
  url: z.string(),
  updated_at: z.string().optional(),
});

export const GetPageOutputSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  slug: z.string().nullable(),
  visibility: VisibilitySchema,
  view_count: z.number(),
  url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  content_omitted: z.boolean(),
  content_length: z.number().optional(),
});

export const DeletePageOutputSchema = z.object({
  id: z.string(),
  deleted: z.literal(true),
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx playwright test --config=playwright.unit.config.ts mcp-slug`
Expected: PASS, all 10 assertions.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/schemas.ts tests/unit/mcp-slug.spec.ts
git commit -m "$(cat <<'EOF'
feat(mcp-server): add Zod input/output schemas

Replaces the hand-written validate* functions (deleted in a follow-up
commit) with Zod schemas the SDK validates before invoking a tool
callback. Locks the slug regex down with real tests — it's drifted from
the REST API's rule before with no test coverage to catch it.
EOF
)"
```

---

### Task 3: Origin validation (`origin.ts`)

The MCP Streamable HTTP transport spec requires servers to validate the `Origin` header
(rejecting unrecognized ones with `403`) to guard against DNS-rebinding-style abuse. Every native
MCP client in `/mcp-setup` (Claude Desktop, Cursor, Windsurf, VS Code, Zed) makes plain HTTP calls
with no browser `Origin` header at all; only a browser-hosted client (Claude.ai) sends one.

**Files:**
- Create: `mcp-server/src/origin.ts`
- Test: `tests/unit/mcp-origin.spec.ts`

**Interfaces:**
- Produces: `isAllowedOrigin(origin: string | null): boolean` (consumed by Task 7's `index.ts`).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/mcp-origin.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { isAllowedOrigin } from "../../mcp-server/src/origin.js";

test.describe("isAllowedOrigin", () => {
  test("allows requests with no Origin header (every native MCP client)", () => {
    expect(isAllowedOrigin(null)).toBe(true);
  });

  test("allows claude.ai", () => {
    expect(isAllowedOrigin("https://claude.ai")).toBe(true);
  });

  test("allows the Booklet app origin", () => {
    expect(isAllowedOrigin("https://booklet.ashwinsathian.com")).toBe(true);
  });

  test("rejects an unrecognized origin", () => {
    expect(isAllowedOrigin("https://evil.example.com")).toBe(false);
  });

  test("rejects a look-alike subdomain impersonating claude.ai", () => {
    expect(isAllowedOrigin("https://claude.ai.evil.example.com")).toBe(false);
  });

  test("rejects a plain-http variant of an allowed origin", () => {
    expect(isAllowedOrigin("http://claude.ai")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test --config=playwright.unit.config.ts mcp-origin`
Expected: FAIL — `mcp-server/src/origin.ts` doesn't exist yet.

- [ ] **Step 3: Write `origin.ts`**

Create `mcp-server/src/origin.ts`:

```ts
// MCP Streamable HTTP transport security requirement: servers MUST validate
// the Origin header to guard against DNS-rebinding-style abuse. Every native
// MCP client (Claude Desktop, Cursor, Windsurf, VS Code, Zed — see
// /mcp-setup) issues plain HTTP calls with no browser Origin header at all;
// those pass through unchecked. Only a present-and-unrecognized Origin is
// rejected. Exact string match — no wildcards, no subdomain matching.
const ALLOWED_ORIGINS = new Set(["https://claude.ai", "https://booklet.ashwinsathian.com"]);

export function isAllowedOrigin(origin: string | null): boolean {
  if (origin === null) return true;
  return ALLOWED_ORIGINS.has(origin);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx playwright test --config=playwright.unit.config.ts mcp-origin`
Expected: PASS, all 6 assertions.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/origin.ts tests/unit/mcp-origin.spec.ts
git commit -m "$(cat <<'EOF'
feat(mcp-server): add Origin header validation

Closes a gap against the MCP Streamable HTTP transport's Origin
validation requirement. Wired into index.ts in a follow-up commit.
EOF
)"
```

---

### Task 4: Rewrite `tools.ts` — typed handlers, structured content, resource links, large-document elision

Removes `TOOL_DEFINITIONS` (JSON Schema array — schemas now live in `schemas.ts` as Zod, wired up
in Task 6) and all `validate*`/`McpValidationError` code (superseded by Task 2's Zod schemas,
enforced by the SDK before a handler ever runs). Handlers now take already-validated, typed args.
Adds `structuredContent` to the four single-item tools (not `list_pages` — seeing an N-row table
duplicated as JSON scales with data size for no chaining benefit here, per the design doc's
token-efficiency section) and a `resource_link` content item on `publish_page`/`update_page`/
`get_page`. Adds large-document elision to `get_page`: below 8,000 characters, `raw` is embedded
inline as today; above it, the response omits the inline body and points at `resources/read`
instead — avoiding dumping up to 350,000 characters (~90K+ tokens) into a conversation that only
needed metadata.

**Files:**
- Modify: `mcp-server/src/tools.ts` (full rewrite of the sections below `TOOL_DEFINITIONS` through
  the five `handleXPage` functions; the `client()`/`mapUpstreamError()`/`handleResourcesList()`/
  `handleResourcesRead()` sections stay conceptually the same, shown in full for clarity)
- Modify: `mcp-server/src/errors.ts:32-37` (delete `McpValidationError` — nothing throws it
  anymore)

**Interfaces:**
- Consumes: `PublishPageInputSchema`, `UpdatePageInputSchema`, `GetPageInputSchema`,
  `ListPagesInputSchema`, `DeletePageInputSchema`, `PublishPageOutputSchema`,
  `UpdatePageOutputSchema`, `GetPageOutputSchema`, `DeletePageOutputSchema` (Task 2, `z.infer`
  gives the exact arg types below).
- Produces: `handlePublishPage(args: z.infer<typeof PublishPageInputSchema>, apiKey: string,
  apiBase: string): Promise<CallToolResult>`, `handleUpdatePage(args: z.infer<typeof
  UpdatePageInputSchema>, apiKey: string, apiBase: string): Promise<CallToolResult>`,
  `handleGetPage(args: z.infer<typeof GetPageInputSchema>, apiKey: string, apiBase: string):
  Promise<CallToolResult>`, `handleListPages(args: z.infer<typeof ListPagesInputSchema>, apiKey:
  string, apiBase: string): Promise<CallToolResult>`, `handleDeletePage(args: z.infer<typeof
  DeletePageInputSchema>, apiKey: string, apiBase: string): Promise<CallToolResult>`,
  `handleResourcesList(apiKey: string, apiBase: string): Promise<unknown>`,
  `handleResourcesRead(uri: string, apiKey: string, apiBase: string): Promise<unknown>` — all
  consumed by Task 6's `registerTool`/`registerResource` callbacks.

- [ ] **Step 1: Replace the file's validation/definitions section and rewrite the handlers**

Replace `mcp-server/src/tools.ts` entirely with:

```ts
import type { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ERRORS, type McpErrorShape } from "./errors.js";
import { createClient, BookletApiError, type PageListItem, type PatchPageRequest } from "booklet-api-client";
import type {
  PublishPageInputSchema,
  UpdatePageInputSchema,
  GetPageInputSchema,
  ListPagesInputSchema,
  DeletePageInputSchema,
} from "./schemas.js";

// ─────────────────────────────────────────────────────────────────────────────
// Booklet API client — one instance per MCP call (stateless server; apiKey
// and apiBase both vary per incoming request). Delegates the actual
// HTTP/auth/JSON-parsing work to booklet-api-client, shared with
// packages/cli, packages/github-action, and packages/vscode.
// ─────────────────────────────────────────────────────────────────────────────

const UPSTREAM_TIMEOUT_MS = 10_000;

function client(apiKey: string, apiBase: string) {
  return createClient({ baseUrl: apiBase, apiKey, source: "mcp", fetchTimeoutMs: UPSTREAM_TIMEOUT_MS });
}

/**
 * For 400/409/422 the REST API already returns a specific, human-readable
 * message (e.g. "Invalid slug. Use 3-60 lowercase letters..." or "Slug is
 * already taken.") — BookletApiError.message carries that verbatim, so
 * surfacing it directly keeps MCP clients (Claude, Cursor, etc.) able to act
 * on the failure instead of seeing a generic "HTTP <status>".
 */
function mapUpstreamError(err: BookletApiError): McpErrorShape {
  const { status, message } = err;
  if (status === 401) return ERRORS.UNAUTHORIZED();
  if (status === 403) return ERRORS.FORBIDDEN();
  if (status === 404) return ERRORS.NOT_FOUND("Page");
  if (status === 413) return ERRORS.DOCUMENT_TOO_LARGE();
  if (status === 429) return ERRORS.RATE_LIMITED();
  if (status === 400 || status === 409 || status === 422) return ERRORS.VALIDATION(message);
  return ERRORS.UPSTREAM(status);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool result helpers
// ─────────────────────────────────────────────────────────────────────────────

type ResultContentItem = CallToolResult["content"][number];

function resourceLink(id: string, name: string): ResultContentItem {
  return { type: "resource_link", uri: `booklet://pages/${id}`, name, mimeType: "text/markdown" };
}

function toolResult(
  text: string,
  opts?: { link?: ResultContentItem; structuredContent?: Record<string, unknown> },
): CallToolResult {
  const content: ResultContentItem[] = [{ type: "text", text }];
  if (opts?.link) content.push(opts.link);
  return { content, ...(opts?.structuredContent ? { structuredContent: opts.structuredContent } : {}) };
}

function errorResult(text: string): CallToolResult {
  return { content: [{ type: "text", text: `Error: ${text}` }], isError: true };
}

function escapeMdCell(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
}

function unexpectedError(toolName: string, e: unknown): CallToolResult {
  if (e instanceof BookletApiError) return errorResult(mapUpstreamError(e).message);
  if (e instanceof DOMException && e.name === "TimeoutError") {
    return errorResult("Request to Booklet API timed out. Try again.");
  }
  console.error(`${toolName} unexpected error:`, e);
  return errorResult("An unexpected error occurred");
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool handlers — args are already validated by the SDK against the Zod
// schemas in schemas.ts before any of these run.
// ─────────────────────────────────────────────────────────────────────────────

export async function handlePublishPage(
  args: z.infer<typeof PublishPageInputSchema>,
  apiKey: string,
  apiBase: string,
): Promise<CallToolResult> {
  try {
    const { raw, title, slug, visibility } = args;

    // The v1/publish endpoint reads slug/visibility from YAML frontmatter.
    let finalRaw = raw;
    if (slug !== undefined || visibility !== undefined || title !== undefined) {
      const fmLines = ["---"];
      if (title !== undefined) fmLines.push(`title: "${title.replace(/"/g, '\\"')}"`);
      if (slug !== undefined) fmLines.push(`slug: ${slug}`);
      if (visibility !== undefined) fmLines.push(`visibility: ${visibility}`);
      fmLines.push("---");
      finalRaw = fmLines.join("\n") + "\n" + raw;
    }

    const r = await client(apiKey, apiBase).publishPage(finalRaw);
    return toolResult(
      `Page published.\n\nURL: ${r.url}\nID: ${r.id}\n\nShare this link. The page is live and permanent.`,
      { link: resourceLink(r.id, title ?? r.id), structuredContent: { id: r.id, url: r.url } },
    );
  } catch (e) {
    return unexpectedError("publish_page", e);
  }
}

export async function handleUpdatePage(
  args: z.infer<typeof UpdatePageInputSchema>,
  apiKey: string,
  apiBase: string,
): Promise<CallToolResult> {
  try {
    const { id, raw, slug, visibility } = args;

    const patch: PatchPageRequest = {};
    if (raw !== undefined) patch.raw = raw;
    if (slug !== undefined) patch.slug = slug;
    if (visibility !== undefined) patch.visibility = visibility;

    const r = await client(apiKey, apiBase).updatePage(id, patch);
    const lines = [`Page updated.\n\nURL: ${r.url}`];
    if (r.updated_at) lines.push(`Updated: ${r.updated_at}`);
    lines.push("\nVisitors who already have the link will see the new content.");
    return toolResult(lines.join("\n"), {
      link: resourceLink(r.id, r.id),
      structuredContent: { id: r.id, url: r.url, ...(r.updated_at ? { updated_at: r.updated_at } : {}) },
    });
  } catch (e) {
    return unexpectedError("update_page", e);
  }
}

// Above this many characters, get_page omits the inline body and points at
// resources/read instead. Booklet pages can be up to 350,000 characters —
// inlining that on every metadata check would be ~90K+ tokens of context for
// no reason. 8,000 chars comfortably covers the vast majority of real pages
// (incident reports, ADRs, release notes) without ever truncating them.
const INLINE_CONTENT_THRESHOLD = 8_000;

export async function handleGetPage(
  args: z.infer<typeof GetPageInputSchema>,
  apiKey: string,
  apiBase: string,
): Promise<CallToolResult> {
  try {
    const { id } = args;

    const r = await client(apiKey, apiBase).getPage(id);
    const sections: string[] = [
      `**${r.title ?? "(untitled)"}**`,
      `ID: ${r.id}${r.slug ? ` · Slug: ${r.slug}` : ""}`,
      `URL: ${r.url}`,
      `Visibility: ${r.visibility} · Views: ${r.view_count}`,
      `Created: ${r.created_at} · Updated: ${r.updated_at}`,
    ];

    const rawLength = r.raw?.length ?? 0;
    const inline = r.raw !== null && rawLength <= INLINE_CONTENT_THRESHOLD;

    if (inline) {
      sections.push("\n---\n");
      sections.push(r.raw as string);
    } else if (r.raw === null) {
      sections.push("\n*(No raw Markdown stored for this page)*");
    } else {
      sections.push(
        `\n*(Content omitted: ${rawLength.toLocaleString()} characters, over the ${INLINE_CONTENT_THRESHOLD.toLocaleString()}-character inline limit. Fetch it via resources/read on booklet://pages/${r.id}, or open the URL above.)*`,
      );
    }

    return toolResult(sections.join("\n"), {
      link: resourceLink(r.id, r.title ?? r.id),
      structuredContent: {
        id: r.id,
        title: r.title,
        slug: r.slug,
        visibility: r.visibility,
        view_count: r.view_count,
        url: r.url,
        created_at: r.created_at,
        updated_at: r.updated_at,
        content_omitted: !inline,
        ...(r.raw !== null ? { content_length: rawLength } : {}),
      },
    });
  } catch (e) {
    return unexpectedError("get_page", e);
  }
}

export async function handleListPages(
  args: z.infer<typeof ListPagesInputSchema>,
  apiKey: string,
  apiBase: string,
): Promise<CallToolResult> {
  try {
    const limit = args.limit ?? 20;
    const offset = args.offset ?? 0;

    const result = await client(apiKey, apiBase).listPages({ limit, offset });
    const pages = result.pages ?? [];
    const total = result.total ?? pages.length;

    if (pages.length === 0) {
      return toolResult("No pages found. Publish your first page with publish_page.");
    }

    const header = "| Title | ID | URL | Views | Visibility |\n|---|---|---|---|---|";
    const rows = pages
      .map(
        (p: PageListItem) =>
          `| ${escapeMdCell(p.title ?? "(untitled)")} | ${p.id} | ${p.url} | ${p.view_count} | ${p.visibility} |`,
      )
      .join("\n");

    const shown = offset + pages.length;
    const paginationNote = total > shown
      ? `\n\n*(Showing ${offset + 1}–${shown} of ${total} total. Use \`offset: ${shown}\` to fetch the next page.)*`
      : total > pages.length
      ? `\n\n*(Showing ${offset + 1}–${shown} of ${total} total.)*`
      : "";

    // No structuredContent here, deliberately: an N-row table duplicated as
    // a JSON array scales token cost with data size for no chaining benefit
    // — nothing in this server's tool surface consumes a list_pages result
    // programmatically. See the design doc's token-efficiency section.
    return toolResult(`Your Booklet pages (${pages.length}):\n\n${header}\n${rows}${paginationNote}`);
  } catch (e) {
    return unexpectedError("list_pages", e);
  }
}

export async function handleDeletePage(
  args: z.infer<typeof DeletePageInputSchema>,
  apiKey: string,
  apiBase: string,
): Promise<CallToolResult> {
  try {
    const { id } = args;

    await client(apiKey, apiBase).deletePage(id);
    return toolResult(`Page ${id} deleted. The URL is no longer accessible.`, {
      structuredContent: { id, deleted: true },
    });
  } catch (e) {
    return unexpectedError("delete_page", e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Resources handler (MCP Resources capability)
// Exposes user's pages as browsable, readable MCP resources.
// ─────────────────────────────────────────────────────────────────────────────

export async function handleResourcesList(apiKey: string, apiBase: string): Promise<unknown> {
  let result: { pages: PageListItem[] };
  try {
    result = await client(apiKey, apiBase).listPages({ limit: 100, offset: 0 });
  } catch {
    return { resources: [] };
  }

  const resources = (result.pages ?? []).map((p) => ({
    uri: `booklet://pages/${p.id}`,
    name: p.title ?? p.id,
    description: `${p.visibility} · ${p.view_count} views · ${p.url}`,
    mimeType: "text/markdown",
  }));

  return { resources };
}

export async function handleResourcesRead(uri: string, apiKey: string, apiBase: string): Promise<unknown> {
  const match = uri.match(/^booklet:\/\/pages\/(.+)$/);
  if (!match) {
    return {
      contents: [{ uri, mimeType: "text/plain", text: `Error: Invalid resource URI: ${uri}` }],
    };
  }

  const id = match[1] ?? "";
  let r;
  try {
    r = await client(apiKey, apiBase).getPage(id);
  } catch {
    return {
      contents: [{ uri, mimeType: "text/plain", text: `Error: Page not found or access denied.` }],
    };
  }

  const text = r.raw ?? `*(No raw Markdown stored for page ${id})*`;

  return {
    contents: [{ uri, mimeType: "text/markdown", text }],
  };
}
```

- [ ] **Step 2: Delete `McpValidationError` from `errors.ts`**

In `mcp-server/src/errors.ts`, delete lines 32-37 (the `McpValidationError` class) — nothing
throws it anymore; Zod validation failures never reach handler code.

- [ ] **Step 3: Typecheck**

Run: `cd mcp-server && npx tsc --noEmit`
Expected: FAILS at this point — `mcp-server.ts` and `index.ts` still reference the old
`TOOL_DEFINITIONS`/`McpValidationError` exports removed here. That's expected; Tasks 5-7 finish
the migration. Confirm the *only* errors reported are in `mcp-server/src/index.ts` (referencing
`TOOL_DEFINITIONS`, `PROMPT_DEFINITIONS` as before) — not new errors inside `tools.ts` itself.

- [ ] **Step 4: Commit**

```bash
git add mcp-server/src/tools.ts mcp-server/src/errors.ts
git commit -m "$(cat <<'EOF'
refactor(mcp-server): typed tool handlers, structured content, resource links

Drops the hand-written validate* functions and McpValidationError (Zod
schemas from the previous commit now own input validation, enforced by
the SDK before a handler runs). Adds structuredContent to the four
single-item tools and a resource_link content item on publish/update/get.
Adds large-document elision to get_page: raw content over 8,000 characters
is no longer inlined, avoiding a 350KB dump into every conversation that
only wanted metadata.

This intentionally leaves the repo mid-migration (index.ts and
mcp-server.ts still reference the old TOOL_DEFINITIONS/PROMPT_DEFINITIONS
wiring) — Tasks 5-7 finish it. tsc --noEmit fails on those two files until
then, by design.
EOF
)"
```

---

### Task 5: Prune dead types

**Files:**
- Modify: `mcp-server/src/types.ts`

**Interfaces:**
- Produces: `Env` (unchanged, still consumed by `index.ts`).

- [ ] **Step 1: Replace the file**

The hand-rolled JSON-RPC types (`JsonRpcRequest`, `JsonRpcResponse`, `ToolCallParams`,
`ResourceReadParams`, `PromptGetParams`) are superseded by the SDK's own types once Tasks 6-7 land
— nothing in the codebase will construct or consume them anymore. Only `Env` (the Worker/Node
env-binding shape) survives.

Replace `mcp-server/src/types.ts` entirely with:

```ts
// Worker env bindings
export interface Env {
  BOOKLET_API_BASE: string;
  MCP_SERVER_NAME: string;
  MCP_SERVER_VERSION: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add mcp-server/src/types.ts
git commit -m "$(cat <<'EOF'
refactor(mcp-server): drop hand-rolled JSON-RPC types

Superseded by @modelcontextprotocol/sdk's own types once index.ts and
mcp-server.ts (next two commits) stop hand-dispatching JSON-RPC. Only Env
(the Worker/Node env-binding shape) is still used by anything.
EOF
)"
```

---

### Task 6: `mcp-server.ts` — SDK server construction and registration

New file: the single place that builds an `McpServer` and registers every tool, resource, and
prompt. Kept separate from `index.ts` (HTTP/transport plumbing) and `tools.ts`/`prompts.ts`
(business logic) — this file's only job is "what does this server offer and how is it wired to
the SDK," matching the design doc's file-responsibility split.

**Files:**
- Create: `mcp-server/src/mcp-server.ts`

**Interfaces:**
- Consumes: everything exported by `tools.ts` (Task 4), `schemas.ts` (Task 2), and the existing
  `PROMPT_DEFINITIONS`/`renderPrompt` from `prompts.ts` (unchanged).
- Produces: `createMcpServer(apiBase: string, apiKey: string): McpServer` (consumed by Task 7's
  `index.ts`), `TOOL_NAMES: readonly string[]`, `PROMPT_NAMES: readonly string[]` (consumed by
  Task 7's `GET /` manifest endpoint).

- [ ] **Step 1: Write `mcp-server.ts`**

Create `mcp-server/src/mcp-server.ts`:

```ts
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  PublishPageInputSchema,
  UpdatePageInputSchema,
  GetPageInputSchema,
  ListPagesInputSchema,
  DeletePageInputSchema,
  PublishPageOutputSchema,
  UpdatePageOutputSchema,
  GetPageOutputSchema,
  DeletePageOutputSchema,
} from "./schemas.js";
import {
  handlePublishPage,
  handleUpdatePage,
  handleGetPage,
  handleListPages,
  handleDeletePage,
  handleResourcesList,
  handleResourcesRead,
} from "./tools.js";
import { PROMPT_DEFINITIONS, renderPrompt } from "./prompts.js";

const SERVER_VERSION = "2.0.0";

export const TOOL_NAMES = [
  "publish_page",
  "update_page",
  "get_page",
  "list_pages",
  "delete_page",
] as const;

export const PROMPT_NAMES = PROMPT_DEFINITIONS.map((p) => p.name);

/**
 * Builds a fresh, fully-wired McpServer for a single request. Stateless by
 * design (no session, no state kept between calls) — matches the
 * WebStandardStreamableHTTPServerTransport's stateless mode used in
 * index.ts, and the server's pre-existing per-request auth model.
 */
export function createMcpServer(apiBase: string, apiKey: string): McpServer {
  const server = new McpServer({ name: "booklet", version: SERVER_VERSION });

  server.registerTool(
    "publish_page",
    {
      title: "Publish Page",
      description: "Publish a new Booklet page from Markdown. Returns a permanent, public URL.",
      inputSchema: PublishPageInputSchema,
      outputSchema: PublishPageOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => handlePublishPage(args, apiKey, apiBase),
  );

  server.registerTool(
    "update_page",
    {
      title: "Update Page",
      description:
        "Update an existing Booklet page's content or metadata. The URL stays the same. Use list_pages to find page IDs.",
      inputSchema: UpdatePageInputSchema,
      outputSchema: UpdatePageOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args) => handleUpdatePage(args, apiKey, apiBase),
  );

  server.registerTool(
    "get_page",
    {
      title: "Get Page",
      description:
        "Retrieve metadata and (for pages under 8,000 characters) the raw Markdown of a specific page you own. Larger pages return metadata plus a resource link instead of the full body — follow up with resources/read to fetch it.",
      inputSchema: GetPageInputSchema,
      outputSchema: GetPageOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => handleGetPage(args, apiKey, apiBase),
  );

  server.registerTool(
    "list_pages",
    {
      title: "List Pages",
      description: "List Booklet pages owned by your account, with pagination via limit/offset.",
      inputSchema: ListPagesInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => handleListPages(args, apiKey, apiBase),
  );

  server.registerTool(
    "delete_page",
    {
      title: "Delete Page",
      description:
        "Permanently delete a Booklet page. Cannot be undone — the URL stops working immediately. Use list_pages to confirm the ID first.",
      inputSchema: DeletePageInputSchema,
      outputSchema: DeletePageOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args) => handleDeletePage(args, apiKey, apiBase),
  );

  server.registerResource(
    "pages",
    new ResourceTemplate("booklet://pages/{id}", {
      list: async () => (await handleResourcesList(apiKey, apiBase)) as { resources: never[] },
    }),
    { title: "Booklet Pages", mimeType: "text/markdown" },
    async (uri) => (await handleResourcesRead(uri.href, apiKey, apiBase)) as { contents: never[] },
  );

  for (const prompt of PROMPT_DEFINITIONS) {
    const argsSchemaShape = Object.fromEntries(
      prompt.arguments.map((a) => [a.name, { description: a.description }]),
    );
    server.registerPrompt(
      prompt.name,
      { title: prompt.name, description: prompt.description, argsSchema: argsSchemaShape as never },
      async (args) => {
        const template = renderPrompt(prompt.name, (args ?? {}) as Record<string, string>);
        return {
          description: prompt.description,
          messages: [{ role: "user" as const, content: { type: "text" as const, text: template ?? "" } }],
        };
      },
    );
  }

  return server;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd mcp-server && npx tsc --noEmit`
Expected: still fails, but now *only* on `mcp-server/src/index.ts` (Task 7 fixes it). If this
step reports errors inside `mcp-server.ts` itself, stop and fix them here before continuing —
common ones: `registerPrompt`'s `argsSchema` needs zod schemas as values, not plain
`{ description }` objects, if the installed SDK version's `argsSchema` typing requires
`z.ZodType` — if so, change the `argsSchemaShape` line to
`Object.fromEntries(prompt.arguments.map((a) => [a.name, z.string().optional().describe(a.description)]))`
(add `import { z } from "zod";` at the top) instead of the plain-object version above.

- [ ] **Step 3: Commit**

```bash
git add mcp-server/src/mcp-server.ts
git commit -m "$(cat <<'EOF'
feat(mcp-server): wire tools, resources, and prompts onto McpServer

New file, single responsibility: build a fully-registered McpServer per
request. Tool annotations (readOnlyHint/destructiveHint/idempotentHint/
openWorldHint) declared per the design doc's table. index.ts (next commit)
is the only remaining piece of the migration.
EOF
)"
```

---

### Task 7: Rewrite `index.ts` — SDK transport, Origin validation, updated CORS

Replaces the entire hand-rolled JSON-RPC `switch` in `handleMcpPost` with the SDK transport.
Keeps `/health`, `GET /`, and `OPTIONS` handling exactly as before (the SDK only owns `/mcp`
POST/GET/DELETE). Adds the Origin check from Task 3 ahead of everything else.

**Files:**
- Modify: `mcp-server/src/index.ts` (full rewrite)

**Interfaces:**
- Consumes: `extractApiKey` (`auth.ts`, unchanged), `isAllowedOrigin` (Task 3), `createMcpServer`,
  `TOOL_NAMES`, `PROMPT_NAMES` (Task 6), `Env` (Task 5).

- [ ] **Step 1: Replace the file**

Replace `mcp-server/src/index.ts` entirely with:

```ts
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { extractApiKey } from "./auth.js";
import { isAllowedOrigin } from "./origin.js";
import { createMcpServer, TOOL_NAMES, PROMPT_NAMES } from "./mcp-server.js";
import { ERRORS } from "./errors.js";
import type { Env } from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// MCP Streamable HTTP transport, via @modelcontextprotocol/sdk.
// Fully stateless: one POST per request, auth re-validated each time, a
// fresh McpServer+transport built per call — matches the SDK's documented
// stateless deployment pattern for horizontally-scaled remote servers.
// ─────────────────────────────────────────────────────────────────────────────

const SERVER_MANIFEST = {
  name: "booklet",
  version: "2.0.0",
  description:
    "Publish, update, read, list, and delete Booklet pages from your AI conversation. Includes pre-built templates for incident reports, ADRs, release notes, RFCs, and runbooks.",
};

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Mcp-Protocol-Version",
  };
}

function jsonResponse(data: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

async function handleMcp(request: Request, env: Env, origin: string | null): Promise<Response> {
  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return jsonResponse({ jsonrpc: "2.0", id: null, error: ERRORS.UNAUTHORIZED() }, 401, origin);
  }

  const server = createMcpServer(env.BOOKLET_API_BASE, apiKey);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);

  const response = await transport.handleRequest(request, {
    authInfo: { token: apiKey, clientId: apiKey, scopes: [], expiresAt: undefined },
  });

  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders(origin))) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker entry point
// ─────────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const method = request.method.toUpperCase();
      const origin = request.headers.get("Origin");

      if (!isAllowedOrigin(origin)) {
        return new Response(null, { status: 403 });
      }

      if (method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders(origin) });
      }

      if (method === "GET" && url.pathname === "/health") {
        return jsonResponse({ ok: true, service: "booklet-mcp", version: "2.0.0" }, 200, origin);
      }

      if (method === "GET" && url.pathname === "/") {
        return jsonResponse(
          { ...SERVER_MANIFEST, endpoint: "/mcp", tools: TOOL_NAMES, prompts: PROMPT_NAMES },
          200,
          origin,
        );
      }

      if (url.pathname === "/mcp") {
        if (method === "POST" || method === "GET" || method === "DELETE") {
          return handleMcp(request, env, origin);
        }
        return jsonResponse({ error: "Use POST, GET, or DELETE on /mcp" }, 405, origin);
      }

      return jsonResponse({ error: "Not found" }, 404, origin);
    } catch (e) {
      console.error("Worker unhandled error:", e);
      return jsonResponse({ error: "Internal server error" }, 500, null);
    }
  },
};
```

- [ ] **Step 2: Typecheck**

Run: `cd mcp-server && npx tsc --noEmit`
Expected: PASS — this is the final file in the migration; no more references to the deleted
`TOOL_DEFINITIONS`/`McpValidationError`/JSON-RPC types should remain anywhere.

Run (repo root, confirms nothing else in the workspace broke): `npm run test`
Expected: PASS (root's `tsc --noEmit`, which excludes `mcp-server` per its own `tsconfig.json`
but will catch anything in `tests/unit/` that doesn't compile).

Run: `npx playwright test --config=playwright.unit.config.ts`
Expected: PASS — all existing root unit tests plus the two new ones from Tasks 2-3.

- [ ] **Step 3: Commit**

```bash
git add mcp-server/src/index.ts
git commit -m "$(cat <<'EOF'
refactor(mcp-server): migrate transport to @modelcontextprotocol/sdk

Replaces the hand-rolled JSON-RPC dispatcher (hardcoded to protocol
2025-03-26, never actually negotiated) with McpServer +
WebStandardStreamableHTTPServerTransport in stateless mode. The SDK
negotiates correctly against whatever the client sent, up to 2025-11-25 —
matching what Claude Desktop, Claude.ai, Cursor, Windsurf, VS Code, and
Zed actually speak today. Adds the Origin-header check from the previous
Origin-validation commit ahead of all request handling.

node-server.ts (the Node<->Web-Request bridge running this under PM2) is
untouched: WebStandardStreamableHTTPServerTransport.handleRequest is a
drop-in Request-in/Response-out replacement for the old handleMcpPost.

This completes the migration started across the last several commits —
tsc --noEmit now passes clean across mcp-server/.
EOF
)"
```

---

### Task 8: Local verification (manual smoke test, not production)

No code changes — confirms the migrated server actually works end-to-end against a local Booklet
API before anything touches production. Requires a local MongoDB instance and Next.js dev server
already runnable (pre-existing project setup, not part of this plan) — see the "Local
development" section of `README.md` if these aren't already configured.

**Files:** none

- [ ] **Step 1: Start the main app locally**

Run (repo root, separate terminal): `npm run dev`
Expected: Next.js dev server listening on `http://localhost:3000`.

- [ ] **Step 2: Sign up and generate an API key**

In a browser, go to `http://localhost:3000`, sign up for a throwaway local account, go to
My Pages → API Keys, generate a key. Copy it (starts with `bklt_`).

- [ ] **Step 3: Start the MCP server locally, pointed at the local app**

Run (separate terminal): `cd mcp-server && BOOKLET_API_BASE=http://localhost:3000 npm run dev`
Expected: `[booklet-mcp] Node bridge listening on :8788 → http://localhost:3000`

- [ ] **Step 4: `tools/list` — confirm annotations and deterministic ordering**

Run (replace `$KEY` with the key from Step 2):

```bash
curl -s http://127.0.0.1:8788/mcp \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | python3 -m json.tool
```

Expected: `result.tools` is an array of 5 objects in the order `publish_page`, `update_page`,
`get_page`, `list_pages`, `delete_page`, each with a `title`, an `annotations` object
(`readOnlyHint`/`destructiveHint`/`idempotentHint`/`openWorldHint`), and `publish_page`/
`update_page`/`get_page`/`delete_page` (not `list_pages`) carrying an `outputSchema`.

- [ ] **Step 5: `publish_page` — confirm structuredContent and resource_link, and invalid-slug rejection**

```bash
curl -s http://127.0.0.1:8788/mcp \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"publish_page","arguments":{"raw":"# Local verify\n\nHello.","slug":"ab"}}}' | python3 -m json.tool
```

Expected: `result.isError: true`, text mentions the slug rule (3-60 chars) — confirms Zod
validation surfaces as a Tool Execution Error, not a JSON-RPC protocol error.

```bash
curl -s http://127.0.0.1:8788/mcp \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"publish_page","arguments":{"raw":"# Local verify\n\nHello."}}}' | python3 -m json.tool
```

Expected: `result.content[0].text` contains `URL:` and `ID:` lines (unchanged shape).
`result.content[1]` is a `resource_link` with a `booklet://pages/<id>` URI.
`result.structuredContent` is `{"id": "<id>", "url": "<url>"}`. Save the `id` for later steps.

- [ ] **Step 6: `get_page` — confirm inline content below the threshold**

```bash
curl -s http://127.0.0.1:8788/mcp \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_page","arguments":{"id":"<id from step 5>"}}}' | python3 -m json.tool
```

Expected: `result.content[0].text` includes the full `# Local verify\n\nHello.` body (under 8,000
chars, so inlined). `result.structuredContent.content_omitted` is `false`.

- [ ] **Step 7: `get_page` — confirm elision above the threshold**

```bash
curl -s http://127.0.0.1:8788/mcp \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":5,\"method\":\"tools/call\",\"params\":{\"name\":\"publish_page\",\"arguments\":{\"raw\":\"# Big\\n\\n$(python3 -c 'print("x " * 5000)')\"}}}" | python3 -m json.tool
```

Take the returned `id`, then:

```bash
curl -s http://127.0.0.1:8788/mcp \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"get_page","arguments":{"id":"<big page id>"}}}' | python3 -m json.tool
```

Expected: `result.content[0].text` does **not** contain the `x x x...` body — instead a
`*(Content omitted: ... characters ...)*` note. `result.structuredContent.content_omitted` is
`true` and `content_length` matches the actual size.

- [ ] **Step 8: `resources/read` — confirm the full body is still fetchable for the elided page**

```bash
curl -s http://127.0.0.1:8788/mcp \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":7,"method":"resources/read","params":{"uri":"booklet://pages/<big page id>"}}' | python3 -m json.tool
```

Expected: `result.contents[0].text` contains the full body — confirms elision only affects
`get_page`'s inline convenience, not actual data availability.

- [ ] **Step 9: Origin validation**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8788/mcp \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -H "Origin: https://evil.example.com" \
  -d '{"jsonrpc":"2.0","id":8,"method":"tools/list","params":{}}'
```

Expected: `403`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8788/mcp \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -H "Origin: https://claude.ai" \
  -d '{"jsonrpc":"2.0","id":9,"method":"tools/list","params":{}}'
```

Expected: `200`.

- [ ] **Step 10: Delete the pages created in this task, then stop both dev servers**

```bash
curl -s http://127.0.0.1:8788/mcp \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":10,"method":"tools/call","params":{"name":"delete_page","arguments":{"id":"<id from step 5>","confirm":true}}}' | python3 -m json.tool
curl -s http://127.0.0.1:8788/mcp \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":11,"method":"tools/call","params":{"name":"delete_page","arguments":{"id":"<big page id>","confirm":true}}}' | python3 -m json.tool
```

Expected: both `result.structuredContent` is `{"id": "<id>", "deleted": true}`. Stop both `npm
run dev` processes (Ctrl-C).

No commit — this task is verification only.

---

### Task 9: Push, deploy, and verify against production

Everything through Task 8 is local. This task is the one the user explicitly asked for beyond
commit/push: deploy the migrated server and confirm it against the real production endpoint.

**Files:** none (operational task)

- [ ] **Step 1: Confirm the working tree is clean except for what this plan changed**

Run: `git status --short`
Expected: no output (everything from Tasks 1-7 already committed), or only the pre-existing
unrelated modifications listed in "Global Constraints" — never anything under `mcp-server/` or
`tests/unit/mcp-*.spec.ts` left uncommitted.

- [ ] **Step 2: Push**

Run: `git push`

- [ ] **Step 3: Deploy**

Run: `npm run deploy` (root `package.json`'s `deploy` script, `bash scripts/redeploy.sh` — rebuilds
and restarts the PM2-managed app and MCP server per `docs/OPERATIONS.md`)

Watch the output for the `booklet-mcp` PM2 process restarting cleanly (no crash-loop). If using
PM2 directly instead: `pm2 logs booklet-mcp --lines 50` right after the restart, confirm the
`[booklet-mcp] Node bridge listening on :8788 → ...` line appears with no stack trace after it.

- [ ] **Step 4: Run the production verification script**

Run:
```bash
MONGODB_URI="mongodb://127.0.0.1:27017/readable?directConnection=true" \
  node scripts/production-verify/cli-mcp-verify.mjs
```

Expected: every check passes, ending in `N passed, 0 failed` (exit code 0). This exercises
`initialize`, `tools/list` (all 5 tools present), `publish_page`, `list_pages`, `get_page`,
`update_page`, `delete_page`, and the no-API-key-rejected-with-401 case — against the real,
now-migrated production MCP endpoint (`https://booklet-mcp.ashwinsathian.com`). It self-cleans
the throwaway account and pages it creates.

- [ ] **Step 5: Manual spot-check of the modernization-specific behavior against production**

The verify script above doesn't check annotations/structuredContent/resource_link/Origin
validation (it predates this work and only asserts the pre-existing text-parsing contract).
Re-run Task 8's Steps 4, 5, and 9 curl commands once more, pointed at
`https://booklet-mcp.ashwinsathian.com/mcp` instead of `127.0.0.1:8788`, using a real production
API key. Confirm the same expected results (annotations present, structuredContent present,
Origin `403`/`200` as expected). Delete any page created during this spot-check via `delete_page`
afterward.

If any check in Steps 4 or 5 fails: this is a live production incident (the server was already
serving real users before this deploy). Do not proceed silently — stop and report exactly what
failed before taking any further action; do not attempt a rollback or additional fixes without
explicit confirmation of the failure and next step.

No commit — this task is operational (push/deploy/verify), not a code change.
