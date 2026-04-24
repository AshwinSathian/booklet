# Readable

**Paste. Preview. Share.**

Readable is a minimal Markdown-to-shareable-page tool. Paste any Markdown into the editor, see a live preview, and publish to a clean read-only URL in one click. No accounts, no setup, no friction.

Published pages expire after 30 days. Drafts are saved locally in your browser.

## What it does

- **Live preview** — Markdown is parsed and rendered as you type (200 ms debounce)
- **Draft management** — unlimited local drafts with autosave, rename, duplicate, import, and export
- **Publish** — one click creates a public URL backed by Cloudflare KV
- **Table of contents** — auto-generated for docs with 3+ headings; scroll-tracked on desktop
- **Settings** — spacing (compact / comfortable), content width, and code block collapse mode per draft
- **Export** — copy as raw Markdown or HTML fragment
- **Theming** — dark-first with a light-mode toggle

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Runtime | React 19 |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS v4 |
| UI components | PrimeReact 10 |
| Markdown parsing | unified + remark-parse + remark-gfm |
| Storage | Cloudflare KV (`READABLE_DOCS` binding) |
| Deployment | Cloudflare Workers via OpenNext |
| Analytics | Google Analytics 4 |

## Project structure

```
src/
  app/
    page.tsx              # Landing page (shell)
    app/
      AppClient.tsx       # Editor — all client state, autosave, keyboard shortcuts
      page.tsx            # Editor page
    p/[id]/
      page.tsx            # Published share page (server component, KV-backed)
    api/publish/
      route.ts            # POST /api/publish — validates, rate-limits, writes to KV
  components/
    app/                  # Editor UI: TopBar, PasteInput, PreviewPane, DraftsDialog, AppShell
    blocks/               # BlockRenderer, InlineRenderer — custom Markdown AST renderer
    marketing/            # Landing.tsx
    ui/                   # AppLogo, ThemeToggle, ToastProvider, PrimeStyles
  lib/
    blocks.ts             # Block/Inline type definitions and DocSettings
    parse.ts              # Markdown → Block[] parser (unified pipeline)
    drafts/               # localStorage draft system (CRUD, migration, autosave)
    sanitize.ts           # Input normalization
    export.ts             # Copy as Markdown / HTML
    toc.ts                # Table of contents builder
    storage.ts            # Cloudflare KV wrappers (getDoc, putDoc)
    analytics.ts          # GA4 event helpers
    constants.ts          # App-wide constants
public/
  primereact-themes/      # PrimeReact lara-indigo theme CSS (dark + light), served statically
```

## Local development

### Prerequisites

- Node.js 20+
- A Cloudflare account with a KV namespace named `READABLE_DOCS`

### Install

```bash
npm install
```

### Run locally (Next.js dev server)

```bash
npm run dev
```

Opens at `http://localhost:3000`. The editor and landing page work fully without Cloudflare. The publish flow requires the KV binding — for local testing use the Wrangler preview instead.

### Run locally (Cloudflare Workers — publish flow included)

```bash
npm run preview
```

This builds via OpenNext and starts `wrangler dev`, which emulates the full Cloudflare Workers runtime including KV.

## Environment variables

Set these in `wrangler.jsonc` under `vars` for Workers, and in `.env.local` for `next dev`:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical origin (e.g. `https://readable.ashwinsathian.com`) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics 4 measurement ID |

## Cloudflare KV setup

1. Create a KV namespace in the Cloudflare dashboard (or via `wrangler kv namespace create READABLE_DOCS`)
2. Copy the namespace ID into `wrangler.jsonc` under `kv_namespaces[0].id`
3. For local Wrangler dev, add a `--local` flag or create a preview namespace

## Deployment

```bash
npm run deploy
```

Runs `opennextjs-cloudflare build` then `wrangler deploy`. Requires `wrangler login` and the KV namespace to be configured.

## Architecture notes

**No server state in the editor.** All draft data lives in `localStorage`. The server is only involved at publish time (`POST /api/publish`) and when loading a published page (`GET /p/[id]`).

**Dark-first theming.** `:root` is the dark theme — this prevents a white flash before JavaScript hydrates. `html.light` overrides it. `next-themes` manages the class toggle.

**XSS safety.** User Markdown is never rendered as raw HTML. It is parsed into a typed `Block[]` AST and rendered through `BlockRenderer` / `InlineRenderer`. Link `href` values are validated against an `https?://` and `mailto:` allowlist.

**Rate limiting.** The publish endpoint allows 12 publishes per minute per IP, tracked in KV with a 90-second TTL. It is not atomic (no Durable Object), which is acceptable at current traffic volumes.

**30-day TTL.** Published documents expire automatically via Cloudflare KV's `expirationTtl`. There is no deletion endpoint — documents simply become inaccessible after expiry.
