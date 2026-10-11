# Booklet

**Publish Markdown incident reports, ADRs, RFCs and runbooks as web pages, with team spaces.**

[![License: AGPL-3.0](https://img.shields.io/github/license/AshwinSathian/booklet)](LICENSE)
[![npm version](https://img.shields.io/npm/v/booklet-cli?label=booklet-cli)](https://www.npmjs.com/package/booklet-cli)
[![npm downloads](https://img.shields.io/npm/dw/booklet-cli)](https://www.npmjs.com/package/booklet-cli)
[![CI](https://img.shields.io/github/actions/workflow/status/AshwinSathian/booklet/ci.yml?branch=main&label=CI)](https://github.com/AshwinSathian/booklet/actions/workflows/ci.yml)

You write Markdown, and Booklet gives you a page with a link. The page is typeset, has a table of contents when it's long enough to need one, and opens for anyone you send it to.

It's built for the documents engineering teams pass around. Put `type: incident` (or `adr`, `rfc`, `runbook`, `postmortem`, `release-notes`) in the frontmatter and the page shows status, severity, date and owners in a strip under the title. `[[ADR-012 Queue retries]]` in an incident report links to that ADR, and the ADR lists the incident under "Referenced by". A team space keeps a team's documents together, grouped by type, and a page in one can be restricted to its members.

There are five ways to publish, and all of them produce the same page: the web editor, the REST API, the `booklet-cli` npm package, a GitHub Action, and an MCP server for Claude and other MCP clients.

**Live:** [booklet.ashwinsathian.com](https://booklet.ashwinsathian.com) · **API docs:** [/docs/reference/api](https://booklet.ashwinsathian.com/docs/reference/api) · **MCP setup:** [/docs/guides/mcp](https://booklet.ashwinsathian.com/docs/guides/mcp)

---

## Quick start

```bash
npm install -g booklet-cli
booklet login                            # opens your browser to authorize
booklet publish README.md --open         # publish this file, open it in your browser
```

You get back the page's URL. The editor works without an account, up to 10 pages a month, each kept for 90 days. An account (free, and there is no paid plan) removes both limits, and you need one for an API key and so for the CLI.

---

## Features

- **Editor**: live preview, drafts saved in the browser and synced to your account, import from a file or a GitHub URL
- **Document types**: frontmatter `type`, `status`, `severity`, `date`, `owners` and `supersedes`, shown in a header strip
- **Links between pages**: `[[Title]]` resolves to a published page in the same team space, or among your own pages
- **Team spaces**: `/t/<slug>` lists a team's pages by type, with an ADR log and an Atom feed of its public pages
- **Visibility**: unlisted (the default, not indexed), public, or team; a password on top if you want one
- **Share pages**: table of contents, reading time, dark and light themes, five document themes, `<iframe>` embeds at `/p/:id/embed`
- **Math and diagrams**: KaTeX (`$...$`, `$$...$$`), Mermaid and Graphviz in fenced code blocks
- **Export**: Markdown, self-contained HTML with diagrams and math drawn in, and Print to PDF
- **Version history**: 50 snapshots per page, a line diff between any two, restore as a new version
- **Analytics**: per-page views, how many readers reached 50% and 100%, referrers
- **Custom slugs**: a URL such as `/p/my-release-notes`
- **Webhooks**: `page.published` and `page.updated`, signed, with a log of the last 50 deliveries
- **REST API**: publish, update, list and delete pages; OpenAPI 3.1 at `/api/v1/openapi.json`
- **CLI**: `booklet-cli` on npm, with `--json` output and exit codes for scripts
- **GitHub Action**: [`AshwinSathian/publish-to-booklet`](https://github.com/AshwinSathian/publish-to-booklet)
- **MCP server**: seven tools and five prompts, with OAuth sign-in or an API key
- **Accounts**: email and password, passkeys, and GitHub or Google sign-in where the host has configured them

---

## CLI

```bash
npm install -g booklet-cli

booklet login                          # save your API key
booklet publish README.md              # publish a file
booklet publish README.md --watch      # watch + auto-republish on save
booklet publish - < NOTES.md           # from stdin
booklet pages list                     # list your pages
```

See [packages/cli/README.md](packages/cli/README.md) for full docs (all flags, CI/non-interactive auth via `--key` or `BOOKLET_API_KEY`, `pages open`, etc.).

---

## REST API

All endpoints are under `/api/v1/` and authenticated with `Authorization: Bearer <bklt_...>`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/publish` | Create a new page |
| `GET` | `/api/v1/pages` | List your pages |
| `GET` | `/api/v1/pages/:id` | Read a page's metadata and raw content |
| `PATCH` | `/api/v1/pages/:id` | Update content, slug, or visibility |
| `DELETE` | `/api/v1/pages/:id` | Delete a page |
| `GET` | `/api/v1/keys` | List API keys |
| `POST` | `/api/v1/keys` | Create an API key |
| `DELETE` | `/api/v1/keys/:id` | Revoke an API key |

**Publish example:**

```bash
curl -X POST https://booklet-api.ashwinsathian.com/api/v1/publish \
  -H "Authorization: Bearer bklt_..." \
  -H "Content-Type: application/json" \
  -d '{"raw": "# Hello\n\nThis is my page."}'
```

`booklet-api.ashwinsathian.com` is a dedicated hostname for the API surface (same app/process as the main site, just scoped; see `docs/OPERATIONS.md`). `booklet.ashwinsathian.com` serves `/api/v1/*` too, so either works.

Full endpoint reference with request/response shapes: [booklet.ashwinsathian.com/docs/reference/api](https://booklet.ashwinsathian.com/docs/reference/api).

---

## MCP Server

A Node process (`mcp-server/`) that gives [Model Context Protocol](https://modelcontextprotocol.io) clients Booklet's API. It runs under PM2 beside the main app and speaks protocol 2026-07-28 over Streamable HTTP.

**Endpoint:** `https://booklet-mcp.ashwinsathian.com/mcp`
**Auth:** OAuth sign-in with your Booklet account, or an `Authorization: Bearer <bklt_...>` header (the same API keys as the REST API)
**Tools:** `publish_page`, `update_page`, `get_page`, `list_pages`, `delete_page`, `create_document`, `search_pages`
**Resources:** your published pages, as `booklet://pages/:id`
**Prompts:** five document templates the assistant can fill in and publish: `incident_report`, `adr`, `release_notes`, `rfc` and `runbook`

Point an MCP client at the endpoint above. A client that supports OAuth (a Claude.ai custom connector, for one) signs in with your Booklet account; the rest send your API key in the `Authorization` header. [booklet.ashwinsathian.com/docs/guides/mcp](https://booklet.ashwinsathian.com/docs/guides/mcp) has copy-paste config for Claude Desktop, Claude.ai, Cursor, Windsurf, VS Code, and Zed.

To run the server itself locally:

```bash
cd mcp-server && npm run dev
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS v4 |
| Auth | In-house (email + password with argon2id, passkeys, optional GitHub and Google sign-in, DB-backed sessions) |
| Database | Self-hosted MongoDB (pages, users, API keys, webhooks, rendered documents) |
| Deployment | PM2 on one Mac behind a Cloudflare Tunnel (why: `docs/adr/0001-hosting-platform.md`) |
| Markdown | unified + remark-parse + remark-gfm + remark-math |
| Math | KaTeX |
| Diagrams | Mermaid, Graphviz (`@viz-js/viz`) |
| Analytics | Page views and read depth, counted by the app itself (MongoDB) |

---

## Local development

### Prerequisites

- Node.js 24 (see `.nvmrc`)
- MongoDB connection string (a local `mongod`, or any self-hosted/managed instance)

### Install & run

```bash
npm install
npm run dev        # Next.js dev server at http://localhost:3000
```

### Environment variables

Create `.env.local`:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/booklet

# Required: dedicated secret that signs/verifies team-invite JWT tokens.
# Must be its own random value; there is no fallback, and invite creation
# and joining fail closed if this is unset. Generate with: openssl rand -base64 32
INVITE_JWT_SECRET=<random-secret>
```

See `.env.example` for the full list of required secrets (session auth, API keys, page-password tokens, etc.). Each documents its own generation command and fail-closed behavior.

### Deploy

```bash
npm run deploy     # rebuilds and restarts the PM2-managed app + MCP server (scripts/redeploy.sh)
```

---

## Project structure

```
src/
  app/
    app/            # Editor (client)
    p/[id]/         # Share page + embed
    my-pages/       # Dashboard: pages and folders, version history, analytics
    settings/       # Account, API keys, webhooks and their delivery log
    api/v1/         # REST API
    explore/        # Public page directory
    templates/      # Template landing pages
  components/
    blocks/         # BlockRenderer + InlineRenderer (custom AST renderer)
    share/          # TOC, export, embed, reading progress, analytics beacon
    ui/             # Design system components
  lib/
    blocks.ts       # Block/Inline type definitions
    parse.ts        # Markdown → Block[] (unified pipeline)
    db/             # MongoDB helpers
    storage.ts      # Document content storage (MongoDB)
    quota.ts        # Feature flags
    frontmatter.ts  # YAML frontmatter parser (js-yaml)
packages/           # npm workspaces; one root lockfile covers all of these
  shared/           # booklet-api-client: shared /api/v1 schemas + client
  cli/              # booklet-cli npm package
mcp-server/         # MCP server (plain Node process, run under PM2)
.github/
  workflows/        # ci.yml, publish-cli.yml, publish-shared.yml
  examples/         # publish-to-booklet.yml, use in your own repo
```

---

## GitHub Actions

### CI

Every push/PR to `main` runs lint, typecheck (root app + each workspace package), a production build, and the unit test suite against a real MongoDB service container. See [.github/workflows/ci.yml](.github/workflows/ci.yml).

### Auto-publish to npm

Push to `main` with a bumped version in `packages/cli/package.json` or `packages/shared/package.json` → automatically publishes `booklet-cli` or `booklet-api-client` to npm.

Required secret: `NPM_TOKEN` (Granular Access Token with publish + 2FA bypass).

### Publish docs to Booklet from your repo

Two ways: the [`AshwinSathian/publish-to-booklet`](https://github.com/AshwinSathian/publish-to-booklet) GitHub Action, or `booklet-cli` via `npx`. See [.github/examples/publish-to-booklet.yml](.github/examples/publish-to-booklet.yml) for both — copy it into your own repo's `.github/workflows/`, add a `BOOKLET_API_KEY` secret, and it publishes on every release.

## License

Booklet has two licenses, split by directory.

| Path | License |
|---|---|
| Everything not listed below (the Next.js app in `src/`, `scripts/`, `tests/`, `docs/`) | [AGPL-3.0-only](LICENSE) |
| `packages/cli` (`booklet-cli`) | [MIT](packages/cli/LICENSE) |
| `packages/shared` (`booklet-api-client`) | [MIT](packages/shared/LICENSE) |
| `mcp-server` | [MIT](mcp-server/LICENSE) |

The [`publish-to-booklet`](https://github.com/AshwinSathian/publish-to-booklet) GitHub Action lives in its own repository and is MIT.

The app was MIT up to and including commit [`1839525`](https://github.com/AshwinSathian/booklet/commit/183952540525ad2a45089aed5d88fd3f61f7f689). That commit and everything before it can still be used under MIT. Later commits to the app are AGPL-3.0-only: if you run a modified copy as a network service, section 13 requires you to offer its users the source.
