# Booklet MCP server modernization — design

**Date:** 2026-08-04
**Status:** Approved (see "Decisions" below — confirmed with user before planning)

## Problem

`mcp-server/` hand-rolls its own JSON-RPC/MCP dispatcher (`src/index.ts`, ~280 lines) against
protocol version `2025-03-26`. Two concrete defects:

1. **Protocol version is hardcoded, not negotiated.** `INITIALIZE_RESULT.protocolVersion` is a
   constant; the server never looks at what the client requested. This is a spec violation and
   means the server can never claim compliance with anything past 2025-03-26.
2. **No modern tool metadata.** No `annotations` (readOnlyHint/destructiveHint/idempotentHint/
   openWorldHint), no `title`, no `outputSchema`/`structuredContent`, no `resource_link` content
   items — all standard since the 2025-06-18 and 2025-11-25 revisions and expected by MCP clients
   built against the current spec.

The rest of the implementation is sound: genuinely stateless (no session state, auth re-validated
per request — which is *ahead* of where the spec was already heading), a clean app-level error
taxonomy (`errors.ts`), and Tool Execution Error semantics for validation failures (already
matches SEP-1303 guidance — input validation errors surface as `isError: true` tool results, not
JSON-RPC protocol errors).

This server is live and used by real MCP clients (Claude Desktop, Claude.ai, Cursor, Windsurf,
VS Code, Zed — see `/mcp-setup`) publishing to real user accounts. Any change here has immediate
blast radius.

## Research grounding

Current MCP spec landscape (checked 2026-08-04, official `modelcontextprotocol.io` +
`@modelcontextprotocol/typescript-sdk` source):

- **2026-07-28** is the *current* spec revision — a large rewrite removing the `initialize`
  handshake and sessions entirely in favor of per-request `_meta` version/capability fields, plus
  a new `server/discover` RPC. **No mainstream client speaks this yet** (it's about a week old);
  the spec itself defines this as "modern" vs. "legacy" (handshake-based, 2025-11-25 and earlier)
  and explicitly documents a **dual-era** server pattern for supporting both.
- The stable, published `@modelcontextprotocol/sdk` (npm, v1.30.0) implements the **legacy**
  line only: `SUPPORTED_PROTOCOL_VERSIONS = [2025-11-25, 2025-06-18, 2025-03-26, 2024-11-05,
  2024-10-07]`, negotiated correctly per-request. This matches every real client in our setup
  docs. A 2026-07-28-aware stable SDK release doesn't exist yet (only an alpha `v2` package
  split) — chasing it by hand now would mean maintaining protocol negotiation logic the SDK
  will supersede within months, disproportionate to a five-tool server.
- Decision: **migrate to the stable SDK, targeting the legacy line it supports.** This is
  strictly better than what we have today (real negotiation up to 2025-11-25 vs. a hardcoded
  2025-03-26), matches actual deployed clients, and any future 2026-07-28 dual-era support
  arrives via a dependency bump rather than a hand-written rewrite.
- Tool annotations, `title`, `outputSchema`/`structuredContent`, and `resource_link` content
  items are documented, stable features of the SDK's `registerTool`/`registerResource` API and
  directly expressible without protocol-version risk.
- MCP Security Best Practices (2025-11-25, current): Streamable HTTP transport servers **MUST**
  validate the `Origin` header to guard against DNS-rebinding-style abuse; token passthrough to
  upstream APIs without audience validation is called out as an anti-pattern (N/A here — we
  don't proxy third-party tokens, we forward Booklet's own API key to Booklet's own API, which
  is the intended design, not passthrough in the spec's sense).
- Token-efficiency research (Anthropic "Code execution with MCP", Nov 2025; community SEP-1576/
  SEP-1624 on schema and structured-content redundancy): (a) MCP tool schemas are already
  materially more token-expensive than minimal equivalents, so schema text should carry only
  disambiguating information; (b) duplicating the same data in both `content` and
  `structuredContent` wastes tokens for no benefit — apply structured content only where the
  data is small and the chaining value is real; (c) inlining large intermediate results (e.g. a
  full document body) into a tool result is the single biggest avoidable context cost, called
  out explicitly as a design smell.

## Decisions (confirmed with user)

1. **Migrate the hand-rolled dispatcher to `@modelcontextprotocol/sdk`** (stable, v1.30.x) rather
   than patching the existing dispatcher in place.
2. **Keep Bearer API-key auth**, harden it; do not build OAuth 2.1 / Protected Resource Metadata
   / dynamic client registration. Documented as a deliberate scope decision, not an oversight —
   full OAuth is a separate, multi-week infra project disproportionate to this pass.
3. **Deploy to production** once implemented, reviewed, and locally verified — not just
   commit/push.

## Architecture

Replace the JSON-RPC `switch` in `handleMcpPost` with the SDK's `McpServer` +
`WebStandardStreamableHTTPServerTransport` (`@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js`),
built fresh per request in stateless mode (`sessionIdGenerator: undefined`) — this matches the
current stateless-per-call design exactly, no session state introduced.

`WebStandardStreamableHTTPServerTransport.handleRequest(request: Request): Promise<Response>` is
a Web-standard `fetch`-shaped API, so `index.ts` keeps its existing
`fetch(request, env): Promise<Response>` export and `node-server.ts` (the Node↔Web-Request bridge
that runs this under PM2) needs **no changes at all**.

```
node-server.ts (unchanged)
   → index.ts fetch(request, env)
       → extract API key (unchanged extractApiKey())
       → build McpServer, register tools/resources/prompts
       → new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })
       → server.connect(transport)
       → transport.handleRequest(request, { authInfo: { token: apiKey, ... } })
       → wrap response with CORS headers (unchanged pattern)
```

Auth stays exactly as today (`extractApiKey()` unchanged, still validates the `bklt_`/`rdbl_`
key shape before doing anything else, still a hard 401 on failure). The extracted key is threaded
through as a synthetic `authInfo` (`{ token: apiKey, clientId: apiKey, scopes: [], expiresAt:
undefined }`) via `transport.handleRequest`'s options, so tool callbacks read
`extra.authInfo.token` instead of receiving `apiKey` as a plain function argument — an SDK-
idiomatic wiring change, not a behavior change.

## Tools

Migrate `TOOL_DEFINITIONS` + handlers to `server.registerTool(name, config, callback)`:

- **`title`** on every tool (human display name, e.g. "Publish Page") — SEP-986 guidance.
- **`annotations`**:
  | Tool | readOnlyHint | destructiveHint | idempotentHint | openWorldHint |
  |---|---|---|---|---|
  | `publish_page` | false | false | false | false |
  | `update_page` | false | true (overwrites content irrecoverably — no version history) | true | false |
  | `get_page` | true | false | true | false |
  | `list_pages` | true | false | true | false |
  | `delete_page` | false | true | true | false |
- **`outputSchema` + `structuredContent`** on `publish_page`, `update_page`, `get_page`,
  `delete_page` only — small field sets (id/url/slug/visibility/timestamps), additive alongside
  the existing text summary. **Not** on `list_pages`: an N-row table duplicated as a JSON array
  scales with data size for no clear win here (nothing downstream chains off a bare page list),
  so it stays text-only, per the token-efficiency research above.
- **`resource_link`** content item pointing at `booklet://pages/<id>` on `publish_page`/
  `update_page`/`get_page`, so a client can follow up via `resources/read` instead of another
  `get_page` round trip.
- Text (`content[].text`) output stays **byte-identical in shape** to today for all five tools —
  `scripts/production-verify/cli-mcp-verify.mjs` regex-parses `content[0].text` (URL, `ID:` line,
  title substring) against production and is the primary safety net for this change; breaking its
  parsing would mean flying blind on the one real end-to-end check this server has.
- **Large-document elision on `get_page`**: below a size threshold (proposal: 8,000 characters,
  tunable), embed `raw` inline as today. Above it, omit the inline body, return metadata +
  `resource_link` only, and note in the text response that the full content is available via
  `resources/read` on the same URI. Avoids dumping up to 350,000 characters (~90K+ tokens) into
  a conversation that only needed to check a page's metadata.
- Light pass over tool/parameter `description` strings: trim explanatory text that doesn't change
  tool-selection or argument-construction behavior (e.g. spelling out every GFM feature Markdown
  already implies), keep everything that prevents a failed call (char limits, the slug regex
  rule, the `confirm: true` requirement on delete). Not a rewrite — a trim.

## Resources & prompts

Migrate `resources/list`+`resources/read` and `prompts/list`+`prompts/get` to
`registerResource`/`registerPrompt` with equivalent behavior. `booklet://pages/:id` stays the URI
scheme. Prompt templates (`incident_report`, `adr`, `release_notes`, `rfc`, `runbook`) are pure
functions today and move over unchanged.

## Security hardening

- **Origin validation** (external check, ahead of the SDK's own deprecated built-in option, per
  the SDK's own guidance to use external middleware): reject requests carrying a foreign `Origin`
  header with `403`; allow requests with no `Origin` (every native client in our setup docs —
  Claude Desktop, Cursor, Windsurf, VS Code, Zed — makes plain HTTP calls with no browser Origin)
  or an `Origin` on a small allowlist (`https://claude.ai`, `https://booklet.ashwinsathian.com`).
  Satisfies the Streamable HTTP transport's "MUST validate Origin" requirement.
- CORS response header changes from a blanket `Access-Control-Allow-Origin: *` to echoing the
  validated `Origin` (or `*` when absent) — cosmetic tightening now that Origin is actually
  checked upstream of it.
- No change to the auth model itself (static API keys, forwarded to Booklet's own REST API,
  which performs the actual authentication) — this is not "token passthrough" in the spec's
  anti-pattern sense, since there's no third-party token audience being bypassed; it's a single
  first-party credential used exactly as designed elsewhere in the product (CLI, GitHub Action,
  VS Code extension all use the same key scheme against the same API).

## Out of scope

OAuth 2.1 / Protected Resource Metadata / Dynamic Client Registration / consent UI — confirmed
with user as a deliberate exclusion, not an oversight. Full 2026-07-28 dual-era (modern +
legacy) protocol support — no stable SDK support exists yet and no real client speaks it.

## Docs

Update `mcp-server/package.json` (new SDK dependency), `README.md`'s MCP section if it makes a
protocol-version claim, `SECURITY.md` if it describes the MCP server's auth/transport model.

## Verification

1. `tsc --noEmit` in `mcp-server` (and root, since it's an npm workspace).
2. Local smoke test: `npm run dev` (tsx) against a local Booklet API
   (`BOOKLET_API_BASE=http://localhost:3100`), exercising `initialize`/`tools/list`/`tools/call`
   for all five tools plus `resources/list`/`resources/read` and `prompts/list`/`prompts/get`.
3. Per the confirmed deploy decision: push, deploy via `scripts/redeploy.sh`, then run
   `scripts/production-verify/cli-mcp-verify.mjs` against the real production MCP endpoint (it
   self-cleans the account and pages it creates).
