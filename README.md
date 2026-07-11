# Readable

**Publish clean, readable pages from Markdown.**

Paste Markdown into the editor, preview it live, and share a polished read-only URL in one click. Sign in for pages that never expire, version history, analytics, custom slugs, password protection, collections, and a full REST API.

**[readable.ashwinsathian.com](https://readable.ashwinsathian.com)**

---

## Features

- **Editor** — live preview (120 ms debounce), unlimited local drafts with autosave, import/export
- **Share pages** — clean read-only URLs, table of contents, reading time, dark/light mode
- **Embeds** — `<iframe>` embed codes for any page via `/p/:id/embed`
- **Export** — PDF, Markdown, HTML fragment
- **LaTeX / KaTeX** — inline `$...$` and display `$$...$$` math blocks
- **Mermaid diagrams** — fenced code blocks with `mermaid` language tag
- **Version history** — every publish is snapshotted; browse and restore past versions
- **Analytics** — per-page view counts, scroll depth, referrers
- **Collections** — group pages into a named collection with a shared URL
- **Password protection** — require a password to view any page
- **Custom slugs** — set a human-readable URL like `/p/my-release-notes`
- **Team Spaces** — invite collaborators, publish to shared `/t/:slug` spaces
- **Webhooks** — HTTP callbacks on `page.published` and `page.updated` events
- **REST API** — publish, update, list, and delete pages programmatically
- **MCP server** — expose the API to AI assistants (Claude, etc.) via the MCP protocol
- **CLI** — publish Markdown from your terminal (`npx readable-cli`)
<!-- VS Code extension: built, not yet on the Marketplace — re-add once AshwinSathian.readable-vscode is published -->
- **GitHub Action** — publish docs in CI via `packages/github-action/`
- **Frontmatter** — YAML frontmatter sets title, slug, visibility, tags, author, date

---

## CLI

```bash
npm install -g readable-cli

readable login                          # save your API key
readable publish README.md              # publish a file
readable publish README.md --watch      # watch + auto-republish on save
readable publish - < NOTES.md           # from stdin
readable pages list                     # list your pages
```

See [packages/cli/README.md](packages/cli/README.md) for full docs.

---

## REST API

All endpoints are under `/api/v1/` and authenticated with `Authorization: Bearer <rdbl_...>`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/publish` | Create a new page |
| `GET` | `/api/v1/pages` | List your pages |
| `PATCH` | `/api/v1/pages/:id` | Update content, slug, or visibility |
| `DELETE` | `/api/v1/pages/:id` | Delete a page |
| `GET` | `/api/v1/keys` | List API keys |
| `POST` | `/api/v1/keys` | Create an API key |
| `DELETE` | `/api/v1/keys/:id` | Revoke an API key |

**Publish example:**

```bash
curl -X POST https://readable-api.ashwinsathian.com/api/v1/publish \
  -H "Authorization: Bearer rdbl_..." \
  -H "Content-Type: application/json" \
  -d '{"raw": "# Hello\n\nThis is my page."}'
```

`readable-api.ashwinsathian.com` is a dedicated hostname for the API surface (same app/process as the main site, just scoped — see `docs/OPERATIONS.md`). `readable.ashwinsathian.com` serves `/api/v1/*` too, so either works.

---

## MCP Server

A plain Node process (`mcp-server/`) that exposes Readable's API to AI assistants supporting the [Model Context Protocol](https://modelcontextprotocol.io), run under PM2 alongside the main app — not a Cloudflare Worker (that was the original design, changed when the rest of the app moved off Cloudflare Workers; see `docs/OPERATIONS.md`).

**Endpoint:** `https://readable-mcp.ashwinsathian.com`  
**Tools:** `publish_page`, `update_page`, `list_pages`, `delete_page`

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
| Database | MongoDB (pages, users, API keys, webhooks) |
| Storage | Cloudflare KV (rendered documents) |
| Deployment | Cloudflare Workers via OpenNext |
| Markdown | unified + remark-parse + remark-gfm + remark-math |
| Math | KaTeX |
| Diagrams | Mermaid |
| Analytics | Google Analytics 4 |

---

## Local development

### Prerequisites

- Node.js 20+
- MongoDB connection string
- Cloudflare account with a KV namespace

### Install & run

```bash
npm install
npm run dev        # Next.js dev server at http://localhost:3000
npm run preview    # Full Cloudflare Workers runtime via Wrangler
```

### Environment variables

Create `.env.local`:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
MONGODB_URI=mongodb+srv://...

# Required — dedicated secret that signs/verifies team-invite JWT tokens.
# Must be its own random value; there is no fallback, and invite creation
# and joining fail closed if this is unset. Generate with: openssl rand -base64 32
INVITE_JWT_SECRET=<random-secret>
```

See `.env.example` for the full list of required secrets (session auth, API keys, page-unlock tokens, etc.) — each documents its own generation command and fail-closed behavior.

### Deploy

```bash
npm run deploy     # builds via OpenNext then wrangler deploy
```

---

## Project structure

```
src/
  app/
    app/            # Editor (client)
    p/[id]/         # Share page + embed
    my-pages/       # Dashboard — pages, API keys, webhooks, collections
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
packages/           # npm workspaces — one root lockfile covers all of these
  shared/           # readable-api-client: shared /api/v1 schemas + client
  cli/              # readable-cli npm package
  github-action/    # GitHub Action: publish Markdown in CI
  vscode/           # VS Code extension: publish from editor
mcp-server/         # MCP server (plain Node process, run under PM2)
.github/
  workflows/        # ci.yml, publish-cli.yml, publish-shared.yml
  examples/         # publish-to-readable.yml — use in your own repo
```

---

## GitHub Actions

### Auto-publish CLI to npm

Push to `main` with a bumped version in `packages/cli/package.json` → automatically publishes `readable-cli` to npm.

Required secret: `NPM_TOKEN` (Granular Access Token with publish + 2FA bypass).

### Publish docs to Readable from your repo

See [.github/examples/publish-to-readable.yml](.github/examples/publish-to-readable.yml).
