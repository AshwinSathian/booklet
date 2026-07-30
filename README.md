# Booklet

**Publish clean, readable pages from Markdown.**

[![License: MIT](https://img.shields.io/github/license/AshwinSathian/booklet)](LICENSE)
[![npm version](https://img.shields.io/npm/v/booklet-cli?label=booklet-cli)](https://www.npmjs.com/package/booklet-cli)
[![CI](https://img.shields.io/github/actions/workflow/status/AshwinSathian/booklet/ci.yml?branch=main&label=CI)](https://github.com/AshwinSathian/booklet/actions/workflows/ci.yml)

Paste Markdown into the editor, preview it live, and share a polished read-only URL in one click. Sign in for pages that never expire, version history, analytics, custom slugs, password protection, collections, and a full REST API.

What makes Booklet more than an editor is the surface around it: a REST API, an npm-published CLI, a GitHub Action for publishing docs in CI, and a standalone MCP server so AI assistants like Claude can publish and manage pages directly. Markdown-to-shareable-page tools are common; shipping the same functionality as an API, a CLI, a CI action, and an MCP server on top of it is the part that isn't.

**Live:** [booklet.ashwinsathian.com](https://booklet.ashwinsathian.com) · **API docs:** [/api-docs](https://booklet.ashwinsathian.com/api-docs) · **MCP setup:** [/mcp-setup](https://booklet.ashwinsathian.com/mcp-setup)

---

## Quick start

```bash
npm install -g booklet-cli
booklet login                            # opens your browser to authorize
booklet publish README.md --open         # publish this file, open it in your browser
```

That's it: you get back a permanent, shareable URL. No account needed to try the editor itself; sign in only when you want pages that never expire, an API key, or the CLI.

---

## Features

- **Editor**: live preview (120 ms debounce), unlimited local drafts with autosave, import/export
- **Share pages**: clean read-only URLs, table of contents, reading time, dark/light mode
- **Embeds**: `<iframe>` embed codes for any page via `/p/:id/embed`
- **Export**: PDF, Markdown, HTML fragment
- **LaTeX / KaTeX**: inline `$...$` and display `$$...$$` math blocks
- **Mermaid diagrams**: fenced code blocks with `mermaid` language tag
- **Version history**: every publish is snapshotted; browse and restore past versions
- **Analytics**: per-page view counts, scroll depth, referrers
- **Collections**: group pages into a named collection with a shared URL
- **Password protection**: require a password to view any page
- **Custom slugs**: set a human-readable URL like `/p/my-release-notes`
- **Team Spaces**: invite collaborators, publish to shared `/t/:slug` spaces
- **Webhooks**: HTTP callbacks on `page.published` and `page.updated` events
- **REST API**: publish, update, list, and delete pages programmatically
- **CLI**: publish Markdown from your terminal (`npx booklet-cli`)
- **GitHub Action**: publish docs in CI via `packages/github-action/`
- **MCP server**: expose the API to AI assistants (Claude, Cursor, etc.) via the Model Context Protocol
<!-- VS Code extension: built, not yet on the Marketplace; re-add once AshwinSathian.booklet-vscode is published -->
- **Frontmatter**: YAML frontmatter sets title, slug, visibility, tags, author, date

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

Full endpoint reference with request/response shapes: [booklet.ashwinsathian.com/api-docs](https://booklet.ashwinsathian.com/api-docs).

---

## MCP Server

A plain Node process (`mcp-server/`) that exposes Booklet's API to AI assistants supporting the [Model Context Protocol](https://modelcontextprotocol.io), run under PM2 alongside the main app, not a Cloudflare Worker (that was the original design, changed when the rest of the app moved off Cloudflare Workers; see `docs/OPERATIONS.md`).

**Endpoint:** `https://booklet-mcp.ashwinsathian.com/mcp`
**Auth:** `Authorization: Bearer <bklt_...>` header (same API keys as the REST API)
**Tools:** `publish_page`, `update_page`, `get_page`, `list_pages`, `delete_page`
**Resources:** published pages are also exposed as browsable/readable MCP resources (`booklet://pages/:id`)

Point any MCP-compatible client at the endpoint above with your API key in the `Authorization` header. [booklet.ashwinsathian.com/mcp-setup](https://booklet.ashwinsathian.com/mcp-setup) has copy-paste config for Claude Desktop, Claude.ai, Cursor, Windsurf, VS Code, and Zed.

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
| Auth | In-house (email + password, argon2id, DB-backed sessions) |
| Database | Self-hosted MongoDB (pages, users, API keys, webhooks, rendered documents) |
| Deployment | PM2 process on a Mac behind a Cloudflare Tunnel (Cloudflare Workers/OpenNext was built, shipped, then deliberately rolled back 2026-05-25; see `docs/OPERATIONS.md`) |
| Markdown | unified + remark-parse + remark-gfm + remark-math |
| Math | KaTeX |
| Diagrams | Mermaid |
| Analytics | Google Analytics 4 |

---

## Local development

### Prerequisites

- Node.js 20+
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
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
MONGODB_URI=mongodb://localhost:27017/booklet

# Required: dedicated secret that signs/verifies team-invite JWT tokens.
# Must be its own random value; there is no fallback, and invite creation
# and joining fail closed if this is unset. Generate with: openssl rand -base64 32
INVITE_JWT_SECRET=<random-secret>
```

See `.env.example` for the full list of required secrets (session auth, API keys, page-unlock tokens, etc.). Each documents its own generation command and fail-closed behavior.

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
    my-pages/       # Dashboard: pages, API keys, webhooks, collections
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
  github-action/    # GitHub Action: publish Markdown in CI
  vscode/           # VS Code extension: publish from editor
mcp-server/         # MCP server (plain Node process, run under PM2)
.github/
  workflows/        # ci.yml, publish-cli.yml, publish-shared.yml, publish-vscode.yml
  examples/         # publish-to-booklet.yml, use in your own repo
```

---

## GitHub Actions

### CI

Every push/PR to `main` runs lint, typecheck (root app + each workspace package), a production build, a check that `packages/github-action/dist/` is up to date, and the unit test suite against a real MongoDB service container. See [.github/workflows/ci.yml](.github/workflows/ci.yml).

### Auto-publish to npm

Push to `main` with a bumped version in `packages/cli/package.json` or `packages/shared/package.json` → automatically publishes `booklet-cli` or `booklet-api-client` to npm.

Required secret: `NPM_TOKEN` (Granular Access Token with publish + 2FA bypass).

### Publish docs to Booklet from your repo

See [.github/examples/publish-to-booklet.yml](.github/examples/publish-to-booklet.yml). Copy it into your own repo's `.github/workflows/`, add a `BOOKLET_API_KEY` secret, and it publishes on every release.
