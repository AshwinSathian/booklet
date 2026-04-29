# Readable — Next Major Update Roadmap

> **Living document.** Update status as items ship, get skipped, or evolve.
> Last audited: April 2026. Author: Ashwin Sathian (with Claude Code).

---

## How to use this file

| Status marker | Meaning |
|---|---|
| ` ` (unchecked) | Not started |
| `~` | In progress |
| `x` | Done / shipped |
| `—` | Deliberately skipped — reason noted inline |

Headings use **Milestone N** grouping. Items inside each milestone are ordered by recommended implementation sequence. Each milestone is independently shippable — you do not need to finish one before starting the next (except where noted).

---

## Infrastructure Cost Audit

> **Current status: $0/month — confirmed as of April 2026.**

| Service | Tier in use | Free limit | Risk at current scale |
|---|---|---|---|
| Cloudflare Workers | Free | 100k req/day | Low |
| Cloudflare KV | Free | 1k writes/day · 100k reads/day · 1 GB | Writes: watch if daily publishes approach 500+ |
| Cloudflare D1 | Free | 5M row reads/day · 100k row writes/day | Comfortable |
| Clerk | Free | 10,000 MAU | Low |
| Google Analytics 4 | Free | Unlimited | n/a |
| Inter (font) | Self-hosted via next/font | n/a | $0 |

**Watchpoint:** KV write limit is 1,000/day free. Each publish costs 1–2 KV writes (doc + rate-limit counter). Fine at current scale. If daily publishes ever approach 500, monitor and consider the Workers Paid plan ($5/month) before hitting the wall.

**Constraint for every roadmap item below: zero new paid services, zero new free tiers that have meaningful limits not already in use.**

---

## Bugs Found During Audit

Confirmed defects in the current codebase. Ordered by severity. Most are addressed in the milestones below.

### [BUG-S1] v1 API has no rate limiting — HIGH
**Files:** `src/app/api/v1/publish/route.ts`, `src/app/api/v1/pages/[id]/route.ts`

The browser publish endpoint (`/api/publish`) enforces 12 publishes/min per IP via KV counter. The v1 API endpoints have no equivalent. A valid API key holder can exhaust the KV write quota or inflate D1 row count without friction.

**Fix:** Apply per-key rate limiting (e.g. 60 ops/min per key) using the same KV counter pattern already in the browser publish route. Rate-limit key: `__rl__v1__${keyId}__${bucket}`.

**→ Addressed in Milestone 1, item 1.2**

---

### [BUG-S2] No HTTP security headers on HTML responses — HIGH
**File:** `public/_headers`

Only `Cache-Control` is set for static assets. No `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, or `Referrer-Policy` headers exist on any HTML response. Exposes the app to clickjacking, MIME sniffing, and cross-origin referrer leakage.

**Fix:** Add security headers in Next.js middleware (most reliable path with Cloudflare Workers + OpenNext). CSP will need exceptions for Clerk's hosted domains, GA4 (`www.googletagmanager.com`), and Mermaid's client-side rendering.

**→ Addressed in Milestone 1, item 1.1**

---

### [BUG-S3] API key prefix mismatch between docs and code — MEDIUM
**Files:** `src/lib/api-key.ts`, `PRODUCT.md`, `src/components/marketing/Landing.tsx`

`PRODUCT.md` and the landing page API code block show keys as `rk_live_...`. The actual code generates keys with prefix `rdbl_` + 40 chars. Not a security bug, but a documentation lie that will confuse any developer trying to use the API.

**Fix:** Update `PRODUCT.md` and the landing page code block to show `rdbl_` prefix. One-pass find-and-replace.

**→ Addressed in Milestone 1, item 1.3**

---

### [BUG-S4] Dead schema columns mislead future development — LOW
**File:** `migrations/0001_initial.sql`

The D1 `users` table has `is_pro INTEGER NOT NULL DEFAULT 0` and `stripe_customer_id TEXT` that are referenced nowhere in application code. These columns signal abandoned monetization intent and will confuse anyone reading the schema. The roadmap constraint says no paywall, so they should be explicitly removed.

**Fix:** Migration `0003_drop_pro_columns.sql` — `ALTER TABLE users DROP COLUMN is_pro; ALTER TABLE users DROP COLUMN stripe_customer_id;`

**→ Addressed in Milestone 1, item 1.4**

---

### [BUG-S5] Visibility toggle uses same icon for both states — LOW
**File:** `src/app/my-pages/MyPagesClient.tsx` (line ~320)

Both the "public" and "unlisted" visibility states render `<Icon name="moon" />`. There is no visual distinction between the two states at a glance.

**Fix:** Use distinct icons — `eye` for public, `eye-off` (or `moon`) for unlisted. Add `eye-slash` or `eye-off` icon to `src/components/ui/Icon.tsx`.

**→ Addressed in Milestone 5, item 5.1**

---

### [BUG-S6] My Pages empty state uses emoji — LOW
**File:** `src/app/my-pages/MyPagesClient.tsx` (line ~393)

The empty state renders `📄` as the icon. This directly violates the locked brand rule: "Do NOT use emoji in UI copy — use SVG icons instead."

**Fix:** Replace with an inline SVG document icon matching the existing design language.

**→ Addressed in Milestone 5, item 5.2**

---

### [BUG-S7] JSON-LD structured data missing from home page — LOW
**Files:** `src/app/layout.tsx`, `src/components/marketing/Landing.tsx`

The brand spec (locked April 2026) specifies `SoftwareApplication + WebSite + WebPage` JSON-LD schema on the home page. Neither `layout.tsx` nor `Landing.tsx` include any `<script type="application/ld+json">` block. This is a direct, addressable SEO gap.

**Fix:** Add JSON-LD to the landing page component or home page route.

**→ Addressed in Milestone 4, item 4.2**

---

## Milestone 1 — Security & Reliability Hardening

> **Priority: Ship first.** These are non-negotiable safety improvements. No new dependencies or infrastructure required.

- [x] **1.1 — HTTP security headers on all HTML responses**

  Add the following headers via Next.js middleware (`src/middleware.ts`), injected before Cloudflare processes the response:

  - `X-Frame-Options: DENY` — prevents clickjacking
  - `X-Content-Type-Options: nosniff` — prevents MIME type sniffing
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Content-Security-Policy` — tightest viable policy for this stack. Requires `script-src` exceptions for Clerk (`*.clerk.accounts.dev`, `clerk.ashwinsathian.com`), GA4 (`www.googletagmanager.com`), and Mermaid (which uses `eval` for diagram rendering client-side — scope the exception to `unsafe-eval` on editor and share pages only, or accept it site-wide as a pragmatic tradeoff).

  The Clerk middleware (`clerkMiddleware`) must remain the outermost wrapper — add header injection inside or after the Clerk layer.

  *Refs: `src/middleware.ts`, `public/_headers`*

- [x] **1.2 — Rate limiting on v1 API endpoints**

  Port the KV-based rate limiter from `/api/publish/route.ts` to:
  - `src/app/api/v1/publish/route.ts`
  - `src/app/api/v1/pages/[id]/route.ts`

  Rate-limit per API key ID (not per IP — API callers are authenticated). Suggested limit: **60 operations/min per key** (generous for CI; a loop hammering the API would need > 1 req/sec to hit this). KV key pattern: `__rl__v1__${keyId}__${minuteBucket}`, TTL: 90s.

  *Refs: `src/lib/api-key-auth.ts` (key ID is `record.id` from `findApiKeyByHash`)*

- [x] **1.3 — API key prefix alignment in docs**

  Update the following to show `rdbl_` prefix (matching `src/lib/api-key.ts`):
  - `PRODUCT.md` — API key example `rk_live_YOURKEYHERE` → `rdbl_YOURKEYHERE`
  - `src/components/marketing/Landing.tsx` — API code block comment

  No functional change. One pass.

- [x] **1.4 — Remove dead pro/stripe columns from D1 schema**

  Add migration `migrations/0004_drop_pro_columns.sql`:
  ```sql
  ALTER TABLE users DROP COLUMN is_pro;
  ALTER TABLE users DROP COLUMN stripe_customer_id;
  ```
  Also remove the corresponding TypeScript type fields from `src/lib/db/types.ts` (`DbUser`).

  > **Note:** SQLite via D1 supports `DROP COLUMN` as of 2022. Verify with `wrangler d1 migrations apply` against the remote DB before merging.

---

## Milestone 2 — Design System Completion

> **Priority: High.** Executes the planned-but-not-yet-started 20-commit overhaul from April 2026 — scoped to the highest-impact items. Phase order matters: token changes (2.1) before component changes (2.3+).

- [x] **2.1 — Remove PrimeReact from non-editor pages**

  PrimeReact CSS currently loads on every page including the landing page and share pages. This bloats page weight and delays FCP on share pages (which are meant to be fast, read-only documents).

  - Move the PrimeReact CSS `@import` from `src/app/globals.css` into `src/app/app/primereact.css` (which already exists and is scoped to the editor layout).
  - Verify `src/app/app/layout.tsx` imports that file.
  - Verify landing page and share pages no longer load PrimeReact CSS.

  *Refs: `src/app/globals.css`, `src/app/app/primereact.css`, `src/app/app/layout.tsx`*

- [x] **2.2 — Replace PrimeReact SelectButton in AppShell with native segmented control**

  AppShell was already using native buttons. `SegmentedControl` extracted from `TopBar.tsx` into `src/components/ui/SegmentedControl.tsx` and imported back. `ToastProvider` still uses `primereact/toast` — full removal of PrimeReact from `package.json` requires a native Toast replacement first (deferred to Milestone 7 polish).

  *Refs: `src/components/app/AppShell.tsx`, `src/components/app/TopBar.tsx`*

- [x] **2.3 — Stray hard-coded colour sweep**

  Run `grep -rn '#[0-9a-fA-F]\{3,6\}' src/` and `grep -rn 'rgb(' src/` across all component files. Replace any values not in `globals.css` token definitions with the appropriate `--color-*` custom property. The macOS dot colours in `HeroMock` (`#ff5f57`, `#febc2e`, `#28c840`) are intentional and should be exempted — comment them as such.

- [x] **2.4 — AppLogo SVG replacement**

  Already complete — `AppLogo.tsx` already has an inline `ReadableMark` SVG using `fill="var(--color-accent)"` with a wordmark. No favicon.png reference present.

- [x] **2.5 — Focus ring audit across interactive elements**

  `globals.css` sets `focus-visible:ring-2 focus-visible:ring-accent-soft` globally on `a` and `button`. But custom interactive elements (OverflowMenu items, SegmentedControl buttons, SlugEditor inputs) may have inconsistent or redundant ring styles. Audit all focusable elements in:
  - `src/components/app/TopBar.tsx`
  - `src/components/app/DraftsDialog.tsx`
  - `src/app/my-pages/MyPagesClient.tsx`
  - `src/app/my-pages/ApiKeysClient.tsx`

  Ensure every focusable element either inherits the global ring or has an explicit `focus-visible:` class. Remove any `outline: none` without a visible replacement.

---

## Milestone 3 — Editor Power Features

> **Priority: High user value.** All client-side. Zero infrastructure cost.

- [ ] **3.1 — Markdown templates / starters**

  Add a "Templates" item to the overflow menu in `src/components/app/TopBar.tsx` that opens a picker modal. On selection, creates a new draft with the chosen template as its content.

  Templates to include (all as constant strings in a new `src/lib/templates.ts`):

  | Template name | Target use case |
  |---|---|
  | Incident Report | P1/P2 post-mortem: severity, timeline, root cause, next steps |
  | Architecture Decision Record (ADR) | Status, context, decision, consequences |
  | Release Notes | Version, highlights, changes, breaking changes |
  | README | Project name, installation, usage, contributing, licence |
  | Meeting Notes | Attendees, agenda, decisions, action items with owners |
  | Onboarding Guide | Setup, prerequisites, first steps, key contacts |
  | Runbook | Trigger, pre-conditions, steps, rollback, escalation |
  | Weekly Update | Summary, progress, blockers, next week |

  The picker UI: a simple modal (`<dialog>` native element) with a grid of cards (`rounded-card bg-bg-elevated border border-border-default`), one per template. No PrimeReact. Respects `animate-dialog-in` entrance.

- [ ] **3.2 — ⌘D keyboard shortcut to open drafts**

  The PRODUCT.md documents the "Open drafts" shortcut as "—" (not implemented). Add `⌘D` (Mac) / `Ctrl+D` (Win/Linux) in `src/app/app/AppClient.tsx`, alongside the existing `⌘↵` publish shortcut.

  - Update the overflow menu item label in `TopBar.tsx` to show the shortcut: `⌘D`
  - Update `PRODUCT.md` keyboard shortcuts table

- [ ] **3.3 — Tab key handling in the editor textarea**

  The PasteInput textarea does not intercept Tab. Pressing Tab navigates away from the editor instead of inserting indentation — a hard friction point when writing nested lists or code blocks.

  In `src/components/app/PasteInput.tsx`, add a `keydown` handler on the `<textarea>`:
  - `Tab` (no modifier): insert 2 spaces at cursor position (or indent all lines in the current selection)
  - `Shift+Tab`: remove 2 leading spaces from all selected lines (de-indent)
  - Call `e.preventDefault()` in both cases

  The handler should use the existing `applyFormat` pattern — read `selectionStart`/`selectionEnd`, mutate the value string, call `onChange`, then restore selection via `requestAnimationFrame`.

- [ ] **3.4 — Client-side syntax highlighting for code blocks**

  Code blocks in `BlockRenderer` currently render monochrome text. Syntax highlighting dramatically improves the quality of technical content — the primary use case.

  **Implementation:**
  - Add `highlight.js` (or `prismjs` with manual language imports) to `dependencies`
  - In `src/components/blocks/BlockRenderer.tsx`, inside the `CodeBlock` component, run highlighting client-side using `useEffect` after render (or `useMemo` with `highlightAuto`)
  - Apply light/dark theme-aware token colours via CSS variables (both themes need colour mappings for strings, keywords, comments, etc.)
  - Scope language set to the most common: `bash`, `python`, `javascript`, `typescript`, `yaml`, `json`, `sql`, `go`, `rust`, `css`, `html`, `dockerfile`
  - Bundle size target: < 40kB gzipped for the language subset

  The same highlighting should apply on both the editor preview pane and the published share page (BlockRenderer is shared).

- [ ] **3.5 — Reading time indicator on published share pages**

  Add a "~N min read" estimate to the share page header, between the expiry badge and the export menu. Calculated from the block content — not stored, computed at render time.

  **Algorithm** (in a new `src/lib/reading-time.ts`):
  1. Walk all blocks and accumulate text from paragraphs, list items, headings, and blockquotes (exclude code blocks — scanning code isn't reading)
  2. Split by whitespace, count words
  3. Divide by 200 (avg reading speed), round to nearest minute; minimum 1 min

  *Refs: `src/app/p/[id]/page.tsx`*

---

## Milestone 4 — Published Page Quality

> **Priority: Medium-high.** Improves reader experience and organic discoverability.

- [ ] **4.1 — Page-specific dynamic OG images**

  All share pages currently use the same generic OG image. A page titled "Q4 Incident Summary" shares an image that says nothing about its content on Slack/Twitter unfurls.

  **Implementation:**
  - Extend `src/app/opengraph-image/route.ts` and `src/app/twitter-image/route.ts` to accept a `?title=` query parameter
  - Render the title (clamped to ~50 chars, wrapped to two lines) in the branded SVG template: dark background (`#000000`), Inter-weight title in `#f5f5f7`, accent stripe or mark in `#7c5cfc`
  - In `src/app/p/[id]/page.tsx` `generateMetadata`, pass `extractTitle(doc.blocks)` as the `title` query param to both image URLs

  No WASM. Pure SVG string response. Zero cost. The existing routes already handle SVG rendering — this adds title injection only.

- [ ] **4.2 — JSON-LD structured data on home page** *(fixes BUG-S7)*

  Add a `<script type="application/ld+json">` block to `src/app/page.tsx` or `src/components/marketing/Landing.tsx`:

  ```json
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Readable",
    "applicationCategory": "UtilitiesApplication",
    "operatingSystem": "Web",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "description": "...",
    "url": "https://readable.ashwinsathian.com"
  }
  ```

  Also add `WebSite` schema with `SearchAction` stub and `WebPage` schema for the home route.

- [ ] **4.3 — Heading anchor links on all share pages, not just ToC pages**

  In `src/app/p/[id]/page.tsx`, `buildToc` and `anchorMap` are only generated when `showToc` is true (≥ 3 headings). Pages with 1–2 headings get no anchor IDs and no deep-link capability.

  **Fix:** Always call `buildToc(doc.blocks)` to get the `anchorMap`. Pass the map to `BlockRenderer` unconditionally. Keep `showToc` as the separate guard for rendering the ToC sidebar/accordion.

- [ ] **4.4 — Improved 404 / expired page**

  The current `NotFoundOrExpired` component in `src/app/p/[id]/page.tsx` is functional but minimal. It dead-ends the user.

  Improvements:
  - Show 2–3 linked example pages (reuse the same 3 URLs from the landing page `useCases` array — incident, ADR, docs examples)
  - Add a secondary CTA: "Browse examples" → scrolls to the examples section on the landing page (`/?#examples`)
  - Better empty-state layout: left-aligned on desktop, centred on mobile
  - Improve the heading: "This page has expired" (if the slug looks like a real ID) vs. "Page not found"

---

## Milestone 5 — Account & My Pages Polish

> **Priority: Medium.** Fixes visible quality issues in the signed-in experience.

- [ ] **5.1 — Visibility toggle icon fix** *(fixes BUG-S5)*

  In `src/components/ui/Icon.tsx`, add an `eye-off` (or `eye-slash`) icon variant.

  In `src/app/my-pages/MyPagesClient.tsx`, update the visibility toggle button:
  - `visibility === "public"` → render `eye` icon, title "Make unlisted"
  - `visibility === "unlisted"` → render `eye-off` icon, title "Make public"

  Also ensure the button has a proper `aria-label` that describes the *current* state and *action*, not just one of them.

- [ ] **5.2 — My Pages empty state redesign** *(fixes BUG-S6)*

  Replace the `📄` emoji in `src/app/my-pages/MyPagesClient.tsx` with:
  - An inline SVG document icon (3–4 lines suggesting text, simple rectangle with corner fold)
  - Brand-consistent copy: "No pages yet." + "Publish your first →" linking to `/app`
  - Secondary link: "See example pages" linking to `/?#examples`

- [ ] **5.3 — Post-publish continuity for signed-in users**

  After a signed-in user publishes from the editor, the toast shows "Copied" / "Open". Add a third action in the toast or in the `PublishArea` post-publish state: "View in My Pages →" (`href="/my-pages"`). Only show this when `publishedOwned === true`.

  Minor change to `src/app/app/AppClient.tsx` and the toast handling in `src/components/app/TopBar.tsx`.

---

## Milestone 6 — API & Developer Experience

> **Priority: Medium.** Completes the API surface and makes it usable from CI/CD.

- [ ] **6.1 — `raw` markdown field support in v1 API**

  The browser publish route (`/api/publish/route.ts`) accepts and stores an optional `raw` string. The v1 API publish route (`/api/v1/publish/route.ts`) does not. Pages published via API therefore cannot be downloaded as `.md` from the share page (the `ExportMenu` hides the "Download Markdown" option when `doc.raw` is absent).

  **Fix:** Add `raw?: string` to `PublishPayload` in `src/app/api/v1/publish/route.ts` and include it in the `PublishedDoc` construction (same `slice(0, STORAGE.maxInputChars)` guard already used in the browser route). Update PRODUCT.md API payload documentation.

- [ ] **6.2 — `GET /api/v1/pages` — list owned pages**

  Add a list endpoint so API users can enumerate their pages programmatically without logging into the dashboard.

  **Endpoint:** `GET /api/v1/pages?limit=50&offset=0`
  **Auth:** API key (`resolveApiKey`)
  **Response:**
  ```json
  {
    "pages": [
      {
        "id": "Ab3k91QxZp",
        "slug": "q4-incident",
        "title": "Q4 Incident Summary",
        "url": "https://readable.ashwinsathian.com/p/q4-incident",
        "visibility": "public",
        "view_count": 42,
        "created_at": "2026-04-01T10:00:00.000Z",
        "updated_at": "2026-04-15T09:30:00.000Z"
      }
    ],
    "total": 12,
    "limit": 50,
    "offset": 0
  }
  ```

  Uses existing `getPagesByUser` D1 query. Add `LIMIT`/`OFFSET` support to that query. New route file: `src/app/api/v1/pages/route.ts`.

  > **Note:** The existing `src/app/api/v1/pages/[id]/route.ts` is the `PATCH` endpoint for updating a specific page. The new `route.ts` without `[id]` is the list endpoint — no conflict.

- [ ] **6.3 — GitHub Actions workflow template in PRODUCT.md**

  Add a "CI/CD recipe" section to `PRODUCT.md` (or a separate `docs/github-action.md`) showing a ready-to-paste GitHub Actions workflow that:

  1. On push to `main`, reads a `CHANGELOG.md` (or any `.md` file) from the repo
  2. Parses it to blocks using a minimal inline script (calls the Readable parse library or ships a simple `remark` pipeline)
  3. POSTs to `POST /api/v1/publish` with the `blocks` payload and an API key stored as a GitHub secret
  4. Comments the resulting URL on the associated PR

  This is documentation/recipe work only — no new application code required.

- [ ] **6.4 — `/api-docs` reference page**

  A clean, static page at `/api-docs` showing all v1 API endpoints with:
  - Method + path
  - Auth requirements
  - Request body schema
  - Response schema
  - Error codes

  Implementation: a React Server Component at `src/app/api-docs/page.tsx` that renders a hand-authored block structure through `BlockRenderer`. Zero dynamic data. Add a footer link to this page. Add it to the sitemap (`src/app/sitemap.ts`).

---

## Milestone 7 — Landing Page & SEO

> **Priority: Medium.** Organic discovery improvements. All zero-cost.

- [ ] **7.1 — Core Web Vitals audit and fixes**

  Run a Lighthouse / PageSpeed audit on the production landing page. Target:
  - LCP < 2.5s
  - CLS < 0.1
  - FID / INP < 200ms

  Likely wins based on current code analysis:
  - Framer Motion animations on scroll sections defer gracefully with `useReducedMotion` — but the initial hero animation may block LCP if Inter font isn't loaded. Verify `font-display: swap` is in effect (it is via `next/font`).
  - GA4 script injected via `Analytics` component — ensure it's deferred and non-blocking.
  - `HeroMock` is pure CSS/HTML — should not be an LCP blocker. Confirm.
  - Largest risk: Clerk JS bundle loading on the landing page even for logged-out users. Clerk's `useUser()` hook in `Landing.tsx` forces the Clerk bundle to load eagerly. Evaluate whether the sign-in state can be deferred until interaction.

- [ ] **7.2 — Sitemap completeness**

  Review `src/app/sitemap.ts`. Ensure it includes:
  - Home page (`/`)
  - App editor (`/app`)
  - Sign in / sign up (if indexable)
  - `/api-docs` (once Milestone 6.4 ships)

  Published share pages (`/p/[id]`) should NOT be in the sitemap — they are ephemeral and link-only by design.

- [ ] **7.3 — Footer and nav link to `/api-docs`**

  Once the API docs page exists (6.4), add it to the landing page footer nav and the top nav (after "API"). Minor update to `src/components/marketing/Landing.tsx`.

---

## Feature Backlog

> **Not in scope for this roadmap.** Revisit once milestones above are complete, or if specific user demand emerges.

| Feature | Notes | Blocking reason |
|---|---|---|
| Password-protected pages | PRODUCT.md marks this intentional omission | Design + UX complexity; encryption approach not decided |
| Expiry extension for anonymous pages | "Bump" expiry +30 days via UI | Needs UI and a KV TTL-update API — low priority now |
| Syntax highlighting themes | Follow-on from M3.4 — light/dark theme-aware tokens | Depends on M3.4 shipping first |
| Notification emails before page expiry | Send email 3 days before expiry | Requires email provider (Resend/Postmark) — adds cost |
| Collaborative editing | Real-time co-editing | Requires WebSocket infra — adds cost |
| VS Code extension | Publish from editor directly | Separate project; REST API already enables it |
| Pagination in My Pages | Show 20 per page with load-more | Only needed once users exceed 20+ pages |
| Embedded diagrams (draw.io, Excalidraw) | Inline diagram editor | Major scope; explore as content-type extension later |
| Publish from GitHub App | Auto-publish on push via GitHub App install | Large scope; recipe approach (6.3) is sufficient for now |

---

## Deliberately Skipped Items

> Items considered and explicitly decided against. Documented so the reasoning isn't re-litigated.

| Item | Decision | Reason |
|---|---|---|
| Paywall / paid tier | Skip indefinitely | Explicit product constraint — keep everything free |
| Vercel deployment | Skip | App is on Cloudflare Workers via OpenNext; Vercel would add cost and complexity |
| Real-time preview sync via WebSocket | Skip | Current 120ms debounce is fast enough; WebSockets add infra cost |
| Rich text / WYSIWYG mode | Skip | Intentional omission per PRODUCT.md — Markdown-only is a feature, not a limitation |
| HTML rendering in Markdown | Skip | Security policy decision — raw HTML in Markdown is intentionally blocked |

---

## Recommended Sequencing

```
Week 1–2    Milestone 1   Security hardening — ship first, non-negotiable
Week 2–3    Milestone 2   Design system completion — clears PrimeReact debt
Week 3–5    Milestone 3   Editor power features — direct user-facing value
Week 5–6    Milestone 4   Published page quality — reader experience + SEO
Week 6–7    Milestone 5   Account polish — signed-in user quality
Week 7–8    Milestone 6   API completeness — developer experience
Week 8–9    Milestone 7   Landing + SEO — organic growth
```

Total: ~26 independently-shippable commits. All zero infrastructure cost. No paywall.

---

*Last updated: April 2026.*
