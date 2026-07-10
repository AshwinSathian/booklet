# Readable — Engineering Plan

> **Single source of truth for all product and engineering work.**
> Replaces `ROADMAP.md`, `IMPLEMENTATION_PLAN.md`, and `STRATEGY_EXECUTION_PLAN.md`.
> Last updated: May 2026.

> **Direction update (May 2026):** Readable is fully free. No paid plans, no upgrade prompts,
> no paywalls. All features — version history, analytics, password protection, the API,
> webhooks, MCP — are available to all signed-in users. The monetisation phases below are
> preserved for historical context but are **not the current direction**.

---

## MCP Server

Deployed at: https://readable-mcp.ashwinsathian.com  
Source: `mcp-server/` (plain Node process, `src/node-server.ts`, run under PM2 as `readable-mcp` — see `ecosystem.config.js`)  
Deploy: `npm run deploy` at the repo root (`scripts/redeploy.sh` builds and reloads both `readable-app` and `readable-mcp` via PM2)  
Last reviewed: 2026-07 (was a standalone Cloudflare Worker prior to the 2026-05-25 infra rollback, `9254448`)

### Architecture
- Plain Node HTTP server (not a Cloudflare Worker — reverse-proxied to its public hostname via the same Cloudflare Tunnel as the main app)
- HTTP+SSE transport per MCP spec (protocol version 2024-11-05)
- Auth: `extractApiKey` validates Bearer token format (prefix + 32-char minimum suffix) before forwarding to the Readable REST API — no additional auth layer
- Sessions: in-memory `Map<string, Session>`, 10-minute TTL, cleaned on each new `/sse` connection; 25-second keepalive pings prevent Cloudflare from closing idle streams
- Tools: `publish_page`, `update_page`, `list_pages`, `delete_page`
- Upstream fetch timeout: 10 seconds (`AbortSignal.timeout`) — fails fast rather than hanging the SSE session

### Protocol compliance
- Handles `notifications/*` silently (no response, per MCP spec for notifications)
- Handles `ping` with `{}` result
- `rpcError` id defaults to `null` when id is indeterminate (not `0`) — per JSON-RPC 2.0 §5.1
- `Content-Type: application/json` only sent on requests that carry a body (POST/PATCH)

### Environment
The worker reads `READABLE_API_BASE` from vars (set in `mcp-server/wrangler.jsonc`).
No secrets required — auth is delegated to the user's API key.

### Key revocation
Deleting an API key from `/my-pages` invalidates it immediately across all clients including the MCP server. There is no separate MCP credential to rotate.

---

## Why This Plan Exists

A simulated seed-round pitch surfaced four structural problems that prior roadmaps
did not address:

1. **No revenue path.** Everything is free. That is not a business.
2. **No retention data.** No accounts by default + localStorage drafts = we know nothing about our users.
3. **No forcing function to pay.** The free product is complete. There is no natural upgrade moment.
4. **No moat.** The tech stack is a commodity. The only defensible position is workflow embedding — making Readable something teams use automatically, not manually.

This plan directly addresses all four. It does not degrade the free experience.
It builds genuinely premium features that teams will pay for, and it instruments
the funnel so we can make data-driven decisions.

---

## The Flywheel

```
Write → Publish → Share link
              ↓
         Reader sees Readable page
              ↓
         "Make your own" CTA → New publisher
              ↓
         Publisher signs in (permanent pages)
              ↓
         Publisher sees analytics → Encounters lock icon → Upgrades to Pro
              ↓
         Team member joins → Team Space → Paying team account
```

Every item in this plan either powers a stage of this flywheel or supports it.
Features that don't connect to it wait.

---

## Current Build State

The following are confirmed complete and do not need rework.

| Capability | Key files |
|---|---|
| Auth (Clerk — Google, GitHub, email) | `src/app/sign-in/`, `src/middleware.ts` |
| Anonymous 30-day pages (Cloudflare KV) | `src/app/api/publish/route.ts` |
| Permanent pages for signed-in users | `src/app/api/publish/route.ts` |
| Custom slugs (UI + API) | `src/app/api/pages/check-slug/route.ts` |
| REST API v1 (publish, update, list) | `src/app/api/v1/` |
| API key management | `src/app/api/v1/keys/`, `src/app/my-pages/ApiKeysClient.tsx` |
| My Pages dashboard | `src/app/my-pages/MyPagesClient.tsx` |
| Per-page analytics + dashboard | `src/app/api/analytics/view/route.ts`, `src/app/my-pages/analytics/[id]/` |
| Version history (10 snapshots, restore) | `src/app/api/pages/[id]/versions/` |
| Collections (drag-and-drop) | `src/app/api/collections/` |
| Template picker (8 templates) | `src/components/app/TemplatesDialog.tsx` |
| Mermaid diagram rendering | `src/components/blocks/DiagramBlock.tsx` |
| Export (MD, HTML, Print) | `src/components/share/ExportMenu.tsx` |
| Reading time on share pages | `src/lib/reading-time.ts` |
| OG images with page title | `src/app/opengraph-image/route.ts` |
| API docs page | `src/app/api-docs/page.tsx` |
| HTTP security headers | `src/middleware.ts` |
| Rate limiting on v1 API | `src/app/api/v1/publish/route.ts` |
| Tab indentation in editor | `src/components/app/PasteInput.tsx` |
| Heading anchor links (unconditional) | `src/app/p/[id]/page.tsx` |
| Syntax highlighting in code blocks | `src/components/blocks/BlockRenderer.tsx` |
| JSON-LD structured data on home page | `src/app/page.tsx` |

---

## Build Status

| Capability | Status | Notes |
|---|---|---|
| Publisher funnel event tracking | ✅ Done | `publish_events` collection, `recordPublishEvent` |
| "Make your own" CTA click tracking | ✅ Done | `AnalyticsBeacon` + `data-readable-cta` attribute |
| Internal metrics dashboard (`/admin`) | ✅ Done | `/admin` page, IP-restricted via middleware |
| Quota system | ✅ Done (all open) | `src/lib/quota.ts` — all limits set to unlimited |
| Stripe billing (checkout, webhooks) | ❌ Removed | No paid plans; portal route retained for history |
| Pricing page | ✅ Converted | `/pricing` now shows "free forever" feature list |
| Attribution badge ("Made with Readable") | ✅ Done | Share page, hidden when `remove_attribution_badge = true` |
| Password-protected pages | ✅ Done | `PasswordGate`, PBKDF2-SHA256 hash in DB, signed cookie-based auth |
| YAML frontmatter support | ✅ Done | Parsed from raw Markdown; `frontmatter_meta` in DB |
| Template SEO landing pages | ✅ Done | `/templates`, `/templates/[slug]` with full content |
| Public explore page | ✅ Done | `/explore` shows recent public pages |
| Version history | ✅ Done | `/api/pages/[id]/versions`, `snapshotPageVersion` |
| Webhooks | ✅ Done | `deliverWebhooks` on publish/update, UI in My Pages |
| MCP server | ✅ Done | `mcp-server/` — plain Node process (`node-server.ts`) managed by PM2, reverse-proxied via Cloudflare Tunnel to `readable-mcp.ashwinsathian.com`. Was a Cloudflare Worker prior to 2026-05-25's infra rollback (`9254448`). |
| CLI (`@readable/cli`) | ✅ Done | `packages/cli/` — auth, publish, pages list, --watch mode |
| Team Spaces | ✅ Done | `/api/teams/`, `/t/[slug]`, `/t/[slug]/admin`, invite via JWT+Resend |
| KaTeX math rendering | ✅ Done | `remark-math` + `katex`, block + inline, CSS imported |
| Embed codes | ✅ Done | `/p/[id]/embed`, `EmbedButton`, middleware frame-ancestors |
| VS Code extension | ✅ Done | `packages/vscode/` — publish, publishSelection, setApiKey |
| GitHub Action | ✅ Done | `packages/github-action/` — publish/update pages in CI |
| Postmortem template | ✅ Done | `src/lib/templates.ts` slug `postmortem` |
| ADR alias `/templates/adr` | ✅ Done | Redirect to `architecture-decision-record` |
| Featured explore system | ✅ Done | Per-page toggle, featured section on `/explore` |
| YAML frontmatter tags+display | ✅ Done | Tags, author, date on share page; description as SEO meta |
| Webhooks UI in My Pages | ✅ Done | `WebhooksClient.tsx` — add/delete webhooks with secret reveal |

---

## Phase 0 — Measurement
**Timeline: 2 weeks. Entry: Now. Exit: All five funnel questions answerable from first-party data.**

We cannot make strategic decisions without data. We currently cannot answer any of these:

1. How many unique pages are published per week?
2. What share of publishers publishes more than once in 30 days?
3. What percentage of share page visitors clicks "Make your own"?
4. What percentage of publishers is signed in vs. anonymous?
5. What is the referrer breakdown for share page traffic?

GA4 gives us page views. The `analytics_events` collection gives us per-page read depth.
Neither answers the above. Phase 0 fixes that.

---

### P0-1 — Publisher funnel event tracking

**Files:** `src/app/api/publish/route.ts`, `src/app/api/v1/publish/route.ts`

Add a `publish_events` D1 table (edge-accessible, fast):

```sql
-- migrations/0005_publish_events.sql
CREATE TABLE IF NOT EXISTS publish_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  page_id TEXT NOT NULL,
  is_update INTEGER NOT NULL DEFAULT 0,
  content_length_bucket TEXT NOT NULL,   -- 'xs'|'sm'|'md'|'lg'|'xl'
  source TEXT NOT NULL DEFAULT 'browser', -- 'browser'|'api'|'cli'
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS publish_events_user_week ON publish_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS publish_events_created ON publish_events(created_at);
```

Content length buckets: `xs` < 500, `sm` 500–2k, `md` 2k–10k, `lg` 10k–50k, `xl` > 50k chars.

After every successful publish in both routes, fire-and-forget:

```typescript
void db.prepare(
  `INSERT INTO publish_events (id, user_id, page_id, is_update, content_length_bucket, source, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
).bind(
  crypto.randomUUID(), userId ?? null, pageId,
  isUpdate ? 1 : 0, bucketContentLength(rawLength), source,
  new Date().toISOString()
).run().catch(() => {});
```

No PII. `user_id` is Clerk's opaque internal ID. Anonymous = `NULL`.

---

### P0-2 — "Make your own" CTA click tracking

**Files:** `src/app/p/[id]/page.tsx`, `src/components/share/AnalyticsBeacon.tsx`,
`src/app/api/analytics/view/route.ts`

Add `cta_click` to the event union type in `src/lib/db/types.ts`.

Add `data-readable-cta="make-your-own"` to the CTA anchor in the share page header.

In `AnalyticsBeacon.tsx`, attach a click listener that calls `navigator.sendBeacon`
with `{ pageId, event: "cta_click" }`. This enables the CTA click rate metric:
`cta_click / view` per page and across the board.

---

### P0-3 — Internal metrics dashboard

**File:** New `src/app/admin/page.tsx`, `src/lib/db/admin-metrics.ts`

Protect `/admin` in middleware via IP allowlist:

```typescript
if (req.nextUrl.pathname.startsWith("/admin")) {
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for");
  if (!(process.env.ADMIN_IPS ?? "").split(",").includes(ip ?? "")) {
    return new Response("Forbidden", { status: 403 });
  }
}
```

Add `ADMIN_IPS=<your-ip>` to `.env.local` and Cloudflare Workers secrets.

The dashboard is a plain server-rendered page (no JavaScript, no charts) showing:

| Metric | Source |
|---|---|
| Weekly new pages | `publish_events` WHERE `is_update = 0` AND `created_at > 7 days ago` |
| Re-publish rate (30d) | Users with ≥2 events in 30 days / users with ≥1 event |
| Anonymous vs. signed-in split | `user_id IS NULL` vs. not |
| API publish share | `source = 'api'` |
| Share page views (7d) | `analytics_events` WHERE `event = 'view'` |
| CTA click rate | `cta_click` / `view` from `analytics_events` |
| Top referrers | `analytics_events` GROUP BY `referrer_bucket` |

Load target: under 200ms. This is an internal tool. No styling beyond legibility.

### Phase 0 Exit Checklist

- [ ] `publish_events` populated with ≥7 days of data
- [ ] `cta_click` events firing on share pages
- [ ] `/admin` dashboard answers all five funnel questions
- [ ] Team has reviewed numbers and formed a hypothesis about which cohort converts

---

## Phase 1 — Monetization Foundation
**Timeline: 6 weeks. Entry: Phase 0 complete. Exit: First paying customer exists.**

This is the phase prior roadmaps deliberately avoided. We are not avoiding it.
The goal is the smallest possible path from free user to paying user.

---

### P1-1 — Quota system

**File:** New `src/lib/quota.ts`, update `src/lib/db/types.ts`

```typescript
// src/lib/quota.ts
export type Plan = "anonymous" | "free" | "pro" | "teams";

export type PlanLimits = {
  pagesPerMonth: number;       // -1 = unlimited
  permanentPages: boolean;
  customSlugs: boolean;
  analytics: boolean;
  versionHistory: boolean;
  passwordProtection: boolean;
  removeAttributionBadge: boolean;
  apiAccess: boolean;
  apiKeysMax: number;          // -1 = unlimited
  teamsAccess: boolean;
  webhooks: boolean;
};

const LIMITS: Record<Plan, PlanLimits> = {
  anonymous:  { pagesPerMonth: 10, permanentPages: false, customSlugs: false, analytics: false,
                versionHistory: false, passwordProtection: false, removeAttributionBadge: false,
                apiAccess: false, apiKeysMax: 0, teamsAccess: false, webhooks: false },
  free:       { pagesPerMonth: 30, permanentPages: true, customSlugs: true, analytics: true,
                versionHistory: false, passwordProtection: false, removeAttributionBadge: false,
                apiAccess: true, apiKeysMax: 2, teamsAccess: false, webhooks: false },
  pro:        { pagesPerMonth: -1, permanentPages: true, customSlugs: true, analytics: true,
                versionHistory: true, passwordProtection: true, removeAttributionBadge: true,
                apiAccess: true, apiKeysMax: 10, teamsAccess: false, webhooks: false },
  teams:      { pagesPerMonth: -1, permanentPages: true, customSlugs: true, analytics: true,
                versionHistory: true, passwordProtection: true, removeAttributionBadge: true,
                apiAccess: true, apiKeysMax: -1, teamsAccess: true, webhooks: true },
};

export const getLimits = (plan: Plan): PlanLimits => LIMITS[plan];
export const canUseFeature = (plan: Plan, feature: keyof PlanLimits): boolean => {
  const v = getLimits(plan)[feature];
  return typeof v === "boolean" ? v : (v as number) !== 0;
};
```

Add to `DbUser` in `src/lib/db/types.ts`:
```typescript
plan: "free";
```

---

### P1-3 — Pricing page

**File:** New `src/app/pricing/page.tsx`

Three columns: Free, Pro ($7/mo), Teams ($12/user/mo). Clean comparison table —
no marketing language, just the feature list per tier (mirror the `PlanLimits` definition).

- "Get started" → `/app`
- "Upgrade to Pro" → calls `POST /api/billing/checkout`, redirects to `checkoutUrl`
- Not signed in → Clerk redirects to sign-in then returns
- Add to landing page nav, footer, and `src/app/sitemap.ts`

---

### P1-4 — Upgrade prompts ("lock icon" pattern)

**File:** New `src/components/ui/UpgradeGate.tsx`

```typescript
type UpgradeGateProps = {
  feature: string;        // "Version history"
  plan: "pro" | "teams";
  children: React.ReactNode; // shown greyed-out behind gate
};
// Renders children with overlay: "Feature  🔒  Available on Pro  [Upgrade →]"
// [Upgrade →] navigates to /pricing
```

Apply gates on:
1. Version history link in My Pages (free → show gate)
2. "Password protect" in My Pages / TopBar settings (free → gate)
3. "Remove attribution badge" in page settings (free → gate)
4. API keys beyond 2 (free → gate)
5. Team workspace creation (not teams plan → gate)

The gate component must be consistent. Do not write inline upgrade prompts —
all upgrade moments go through `UpgradeGate`.

---

### P1-5 — Attribution badge

**Files:** `src/app/p/[id]/page.tsx`, `src/app/api/publish/route.ts`,
D1 migration, `src/lib/db/types.ts`

Every share page for a free or anonymous publisher shows a small chip in the
bottom-right corner. Pro users suppress it.

```sql
-- migrations/0007_attribution_badge.sql
ALTER TABLE pages ADD COLUMN remove_attribution_badge INTEGER NOT NULL DEFAULT 0;
```

In the publish route, after determining user plan:
```typescript
const removeBadge = userId ? canUseFeature(await getUserPlan(userId), "removeAttributionBadge") : false;
// Pass to createPageRecord / updatePageRecord
```

In `src/app/p/[id]/page.tsx`:
```tsx
{!pageRecord.remove_attribution_badge && (
  <a
    href={process.env.NEXT_PUBLIC_SITE_URL}
    target="_blank" rel="noopener noreferrer"
    className="fixed bottom-5 right-5 z-30 hidden sm:inline-flex items-center gap-2
               rounded-full border border-border-subtle bg-bg/70 backdrop-blur-md
               px-3 py-1.5 text-xs text-text-muted transition-all
               hover:border-accent-soft/30 hover:text-text-primary print:hidden"
  >
    <AppLogo onlyIcon size={14} />
    Made with Readable
  </a>
)}
```

This is both a growth mechanism (every free share page is an ad) and a Pro conversion
hook (Pro removes it).

### Phase 1 Exit Checklist

- [ ] Stripe processes test payments and sets `plan = 'pro'` in D1
- [ ] Cancellation via portal sets `plan = 'free'`
- [ ] At least one user has upgraded to Pro (founder counts)
- [ ] All gated features show `UpgradeGate` to free users
- [ ] Attribution badge appears on free/anonymous share pages, absent on Pro pages
- [ ] `/pricing` is live and linked from footer and landing page nav

---

## Phase 2 — Distribution Engine
**Timeline: 8 weeks. Entry: Phase 1 complete. Exit: CLI installable from npm; template pages indexed.**

Goal: embed Readable into developer workflows so it has switching cost.

---

### P2-1 — Password-protected pages (Pro feature)

**Files:** `src/app/p/[id]/page.tsx`, new `src/app/p/[id]/password/page.tsx`,
`src/app/api/pages/[id]/route.ts`, `src/lib/db/types.ts`

```bash
npm install bcryptjs jose
npm install --save-dev @types/bcryptjs
```

Add `JWT_SECRET=<32-byte random hex>` to env vars and Workers secrets.

**Schema:**
```sql
-- migrations/0008_password_protection.sql
ALTER TABLE pages ADD COLUMN password_hash TEXT;
```

**Gate on share page** (`src/app/p/[id]/page.tsx`):
1. If `pageRecord.password_hash` is set, check for a valid `readable_auth_{pageId}` cookie
2. If missing or invalid: redirect to `/p/${id}/password`

**Password entry page** (`src/app/p/[id]/password/page.tsx`):
- Simple form, no JS required
- On submit: validate bcrypt match → on success, set `readable_auth_{pageId}` cookie
  (HttpOnly, Secure, 24h, signed JWT via `jose`) and redirect to the page
- On failure: re-render with "Incorrect password" error

**Set password via PATCH** (`src/app/api/pages/[id]/route.ts`):
```typescript
if ("password" in body) {
  if (body.password === null) {
    patch.password_hash = null;
  } else {
    const { hash } = await import("bcryptjs");
    patch.password_hash = await hash(body.password as string, 10);
  }
}
```

**Gate in UI:** In My Pages row actions and TopBar settings panel, "Protect page" option
opens a small modal. For free users: wrap in `<UpgradeGate feature="Password protection" plan="pro">`.
Show a lock icon in My Pages next to password-protected pages.

---

### P2-2 — YAML frontmatter support

**Files:** `src/lib/parse.ts`, `src/lib/blocks.ts`, `src/app/api/publish/route.ts`,
`src/app/p/[id]/page.tsx`

```bash
npm install remark-frontmatter js-yaml
npm install --save-dev @types/js-yaml
```

**Supported keys:**
```yaml
---
title: "Incident Report — Payment Gateway Down"
date: 2026-05-08
author: "Ashwin Sathian"
description: "Post-mortem for the 3-hour payment gateway outage"
tags: [incident, p1, payment]
visibility: unlisted   # only respected for signed-in users
---
```

In `parseToBlocks`, add `remarkFrontmatter` to the remark chain; strip the YAML node
from the AST before rendering; expose parsed data as a `frontmatter` field on the return.

Update return type:
```typescript
export type ParseResult = {
  blocks: Block[];
  frontmatter: {
    title?: string; date?: string; author?: string;
    description?: string; tags?: string[]; visibility?: "public" | "unlisted";
  } | null;
};
```

In the publish routes: if `frontmatter.title` is present, use it as the page title
(overriding the auto-extracted H1). If `frontmatter.visibility` is present AND the user
is signed in, apply it to the page record.

On the share page: render author below H1, date in the header, tags as pill badges.
Use frontmatter `description` for `<meta description>` when present.

Add `frontmatter: Record<string, unknown> | null` to `PublishedDoc` in `src/lib/blocks.ts`.

---

### P2-3 — Template SEO landing pages

**Files:** New `src/app/templates/page.tsx`, `src/app/templates/[slug]/page.tsx`,
update `src/lib/templates.ts`, update `src/app/sitemap.ts`

Add `slug` to the `Template` type. Template slugs:

| Template | Slug | Target query |
|---|---|---|
| Incident Report | `incident-report` | "incident report template" |
| Architecture Decision Record | `adr` | "architecture decision record template" |
| Runbook | `runbook` | "runbook template" |
| Release Notes | `release-notes` | "release notes template markdown" |
| Postmortem | `postmortem` | "postmortem template" |
| README | `readme` | "readme template markdown" |
| Meeting Notes | `meeting-notes` | "meeting notes template" |
| Weekly Update | `weekly-update` | "weekly update template" |

Each template detail page (`/templates/[slug]`):
- Template name as H1 with proper structured data
- 400–600 words of genuinely useful copy about the use case (not marketing copy — content worth reading)
- Live rendered preview via `BlockRenderer` (server-rendered — the preview IS the SEO content)
- "Use this template" CTA → `/app?template=[slug]`

Template index page (`/templates`): grid of all templates, name + one-line description + CTA.

Deep-link loading in editor: in `src/app/app/AppClient.tsx`, read `?template=` on mount,
find matching template by slug, auto-load as initial draft. Clear the query param via
`history.replaceState`.

Add all template pages to sitemap with `changeFrequency: "monthly"` and `priority: 0.8`.

**Ship in priority order** (high → low as listed above). Each page takes 1 day.
Do not ship placeholder pages — every page needs its 400–600 words of useful copy.

---

### P2-4 — Public explore page

**Files:** New `src/app/explore/page.tsx`, `src/app/api/explore/route.ts`,
update `src/lib/db/types.ts`, `src/app/my-pages/MyPagesClient.tsx`

Add `featured: boolean` (default `false`) to `DbPage`:
```sql
-- migrations/0009_featured_pages.sql
ALTER TABLE pages ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS pages_featured ON pages(featured, created_at);
```

Explore API (`GET /api/explore?limit=20&offset=0&tag=incident-report`):
Returns only `featured = 1 AND visibility = "public"` pages.
Response: `{ pages: [{ id, slug, title, view_count, created_at, tags }] }`

The `/explore` page is a server component. Cards link to actual share pages.
Cap at 50 featured pages at any time — quality over completeness.

Add opt-in toggle in My Pages: "Feature on Explore" per page row.
Calling `PATCH /api/pages/:id` with `{ featured: true }`.

Add `/explore` to landing page nav and footer. Add to sitemap.

Rules:
- Opt-in only. No page appears without the owner's explicit toggle.
- The explore page introduction section uses `BlockRenderer` (dogfooding).

---

### P2-5 — CLI (`@readable/cli`)

**Location:** New `packages/cli/` within the monorepo.
Published as `@readable/cli` on npm. Requires Node ≥ 18.

```
packages/cli/
  bin/readable.ts       # entry point
  src/commands/
    publish.ts          # readable publish <file>
    pages.ts            # readable pages list
    auth.ts             # readable auth
  src/lib/
    config.ts           # reads ~/.readable/config.json
    api.ts              # HTTP client
  package.json
  tsconfig.json
```

**`readable auth`:**
```
$ readable auth
? Paste your API key: rdbl_...
? Base URL [https://readable.ashwinsathian.com]:
✓ Authentication saved.
```
Writes to `~/.readable/config.json`. `--key rdbl_...` flag for non-interactive CI setup.

**`readable publish <file>`:**
```
readable publish INCIDENT.md
readable publish INCIDENT.md --slug q2-incident-2026
readable publish INCIDENT.md --visibility unlisted
readable publish INCIDENT.md --watch    # re-publish on file change
readable publish -                       # stdin
```
Flow: read file → POST to `POST /api/v1/publish` with `{ raw: content, source: "cli" }` →
if `--slug`, follow up with `PATCH /api/v1/pages/:id` → print URL to stdout.

**`--watch` mode** (highest-value use case for incident war rooms):
```
$ readable publish incident.md --watch
✓ Published: https://readable.ashwinsathian.com/p/q2-incident
Watching for changes... (Ctrl+C to stop)
[14:32:01] Updated: https://readable.ashwinsathian.com/p/q2-incident
```
Uses Node.js `fs.watch`. Re-publishes via PATCH on file change. The link never changes —
the team always sees the latest status.

**`readable pages list`:** calls `GET /api/v1/pages`, prints a formatted table.

**Source tracking:** The CLI must pass `source: 'cli'` in publish payloads.
Update `publish_events.source` enum to include `'cli'`.

```json
{
  "name": "@readable/cli",
  "version": "0.1.0",
  "bin": { "readable": "./dist/bin/readable.js" },
  "engines": { "node": ">=18" },
  "type": "module"
}
```

CI: `npm publish --access public` on version tag.

### Phase 2 Exit Checklist

- [ ] CLI published to npm and installable via `npm install -g @readable/cli`
- [ ] `readable publish README.md` returns a URL
- [ ] `readable publish - ` accepts stdin
- [ ] `readable publish README.md --watch` re-publishes on file save
- [ ] Template SEO pages live for all 8 priority slugs
- [ ] Explore page live with ≥5 opt-in featured pages
- [ ] Password protection live and gated behind Pro plan
- [ ] `publish_events.source` distinguishes browser / api / cli

---

## Phase 3 — The B2B Layer
**Timeline: 10 weeks. Entry: Phase 2 complete; MRR > $0 from ≥3 paying Pro users.**
**Exit: First paying team exists.**

Team Spaces is where sustainable ARR lives. A team at $12/user/month with 5 users
is $720/year — 8x the annual value of a single Pro user.

Do not start Phase 3 until Phase 1 and Phase 2 have demonstrated that individuals will pay.

---

### P3-1 — Team schema and routes

D1 migrations:
```sql
-- migrations/0010_teams.sql
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'teams',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS teams_owner ON teams(owner_id);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT,
  role TEXT NOT NULL DEFAULT 'editor',   -- 'owner'|'editor'|'viewer'
  invited_email TEXT,
  joined_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(team_id, user_id)
);
CREATE INDEX IF NOT EXISTS team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS team_members_user ON team_members(user_id);

ALTER TABLE pages ADD COLUMN team_id TEXT REFERENCES teams(id);
CREATE INDEX IF NOT EXISTS pages_team ON pages(team_id, created_at);
```

New routes:
```
src/app/api/teams/route.ts                     GET (list), POST (create)
src/app/api/teams/[id]/route.ts                PATCH (rename), DELETE
src/app/api/teams/[id]/members/route.ts        GET members, DELETE member
src/app/api/teams/[id]/invite/route.ts         POST (send invite)
src/app/t/join/page.tsx                        Accept invite link
src/app/t/[slug]/page.tsx                      Team home (public page list)
src/app/t/[slug]/admin/page.tsx                Team admin (owner only)
```

---

### P3-2 — Team invite flow

Flow:
1. Team owner POSTs to `/api/teams/:id/invite` with `{ email }`
2. Server generates a signed JWT invite token (72-hour expiry, signed with `INVITE_JWT_SECRET`)
3. Server returns the invite URL — owner copies and sends it manually
4. Recipient clicks `/t/join?token=...`
5. If not signed in: Clerk redirects to sign-in, then returns to join URL
6. Server validates JWT → creates `team_members` row with `joined_at = now()`
7. Redirect to `/t/[team-slug]`

---

### P3-3 — Team publishing from the editor

**Files:** `src/app/app/AppClient.tsx`, `src/components/app/TopBar.tsx`

When a signed-in user is a member of ≥1 teams, the Publish button gains a disclosure
arrow: `Publish ▾`. Clicking reveals:

```
Publish to:
  ○ My pages
  ○ [Team Name 1]
  ○ [Team Name 2]
```

Selecting a team publishes with `team_id` set. Pages published to a team appear in
`/t/[team-slug]` AND in the owner's My Pages (labelled with the team name).

---

### P3-4 — Webhooks (Teams feature)

**Files:** New `src/app/api/teams/[id]/webhooks/route.ts`, `src/lib/webhooks.ts`

Teams can configure webhook URLs. On every page publish or update within a team,
Readable fires a POST to all configured URLs:

```json
{
  "event": "page.published",
  "team_id": "...",
  "page": {
    "id": "Ab3k91QxZp",
    "title": "Q2 Incident Report",
    "url": "https://readable.ashwinsathian.com/p/q2-incident",
    "author": "ashwin@example.com",
    "published_at": "2026-05-18T14:32:00.000Z"
  }
}
```

Payload is signed with HMAC-SHA256. The secret is generated by Readable, shown once
to the user, and stored hashed. Consumers verify via `X-Readable-Signature` header.

Document a Slack incoming webhook configuration (no Slack App required) that
posts a message on every Readable page publish. This is the zero-code Slack integration.

### Phase 3 Exit Checklist

- [ ] Team creation, invite, and join flow works end-to-end
- [ ] Team invite email sends via Resend
- [ ] Pages publish correctly to team workspaces
- [ ] Webhook fires and signature is valid
- [ ] First paying team is on the Teams plan

---

## Phase 4 — Category Capture
**Timeline: Ongoing. Entry: First paying team; MRR > $100. Exit: None — this is steady state.**

The goal is not features. It is making Readable the recognized name for sharing written
technical communication as a link.

---

### P4-1 — First-party GitHub Action

**Repository:** New `readable-hq/publish-action` GitHub repository.
Published to the GitHub Marketplace.

```yaml
- uses: readable-hq/publish-action@v1
  id: publish
  with:
    file: CHANGELOG.md
    api-key: ${{ secrets.READABLE_API_KEY }}
    page-id: ${{ vars.CHANGELOG_PAGE_ID }}   # optional: update in-place
```

Outputs: `url`, `id`. Implementation: ~150 lines of TypeScript.
The workflow recipe in `PRODUCT.md` is a bash script. This is a real action.

---

### P4-2 — KaTeX math rendering

```bash
npm install katex remark-math
npm install --save-dev @types/katex
```

Syntax: `$inline$` and `$$display$$`.

Add `remarkMath` to the remark chain. Add `math` block type and `math` inline type
to `src/lib/blocks.ts`. In `BlockRenderer` and `InlineRenderer`, render via
`katex.renderToString(src, { displayMode: true/false, throwOnError: false })`.

`dangerouslySetInnerHTML` is safe here — KaTeX generates its own sanitised output
from LaTeX source and does not interpret arbitrary HTML.

Import `katex/dist/katex.min.css` in the editor layout and share page.
KaTeX CSS is ~280 bytes gzipped. Load globally — acceptable.

Free feature. No plan gate.

---

### P4-3 — Embed codes

**Files:** New `src/app/embed/[id]/page.tsx`, `src/components/share/EmbedDialog.tsx`

The embed route is a stripped-down share page: no sticky header, no footer, no ToC, no export.
Just the content. Query params: `?theme=dark|light`, `?width=normal|wide`, `?padding=0|1`.

Override `X-Frame-Options` for `/embed/*` in middleware (the site-wide `DENY` must be
lifted for this path only):
```typescript
if (req.nextUrl.pathname.startsWith("/embed/")) {
  response.headers.set("Content-Security-Policy", "frame-ancestors *;");
  response.headers.delete("X-Frame-Options");
}
```

Embed dialog on share page header: shows live preview, lets user configure height and theme,
generates and copies `<iframe>` code. No PrimeReact.

Free feature. No plan gate.

---

### P4-4 — VS Code extension

**Repository:** New `readable-hq/vscode-readable` GitHub repository.
Published to the VS Code Marketplace.

Extension ID: `readable-hq.readable`.

Commands:
- `readable.publish` — publish the active Markdown file
- `readable.publishSelection` — publish selected text
- `readable.setApiKey` — prompt for API key, store in VS Code settings

On `readable.publish`:
1. `vscode.window.activeTextEditor.document.getText()`
2. POST to `POST /api/v1/publish` with `{ raw: content }`
3. On success: VS Code notification with "Copy URL" and "Open" buttons

Settings contributed:
```json
{
  "readable.apiKey": { "type": "string" },
  "readable.defaultVisibility": { "type": "string", "enum": ["public", "unlisted"], "default": "public" }
}
```

Depends on v1 API (done) and CLI auth pattern (done in Phase 2).

---

### P4-5 — Content flywheel

Every major use case gets a piece of content that is itself a Readable page.
Published via the API. Linked from the blog.

- "How to write a P1 incident postmortem" → links to `/templates/incident-report`
- "The ADR format that actually gets read" → links to `/templates/adr`
- "Why your runbooks don't work" → links to `/templates/runbook`
- "Publish your CHANGELOG as a Readable page in 60 seconds" → links to `/api-docs`

Each piece of content is written in Readable and published on Readable.
This is dogfooding at scale.

---

## Anti-Goals

Things we will not build. These are decided. Do not re-litigate them.

| Item | Reason |
|---|---|
| Real-time collaboration | That is Notion or Google Docs. We are a publishing surface, not a co-editing surface. |
| Rich text / WYSIWYG | Markdown-only is a product decision. Removing it requires replacing the entire editor. |
| Comments or reactions | Read-only for recipients. Moderation infrastructure is out of scope. |
| Mobile app | The web editor is the app. A mobile app is a separate team. |
| Custom Markdown extensions / plugin API | CommonMark + GFM covers 99% of technical writing. A plugin system requires a compatibility layer forever. |
| Real-time preview sync via WebSocket | The 120ms debounce is fast enough. WebSockets add infrastructure cost. |
| Collaborative editing | Requires WebSocket infrastructure. Not this year. |
| Vercel deployment | App runs as a single PM2 process on a personal Mac behind a Cloudflare Tunnel (Cloudflare Workers/OpenNext was tried and removed 2026-05-25, see docs/OPERATIONS.md). Vercel adds cost and complexity. |
| HTML rendering in Markdown | Security policy. Raw HTML in Markdown is intentionally blocked. |

---

## Metrics

Review weekly from `/admin`.

| Metric | Month 3 target | Month 6 target | Month 12 target |
|---|---|---|---|
| Weekly new pages (unique) | 200 | 500 | 2,000 |
| Re-publish rate (30d) | 15% | 25% | 35% |
| "Make your own" CTR | 3% | 5% | 7% |
| API key activations | 20 | 100 | 500 |
| CLI installs (npm downloads) | — | 50 | 500 |
| MRR | $0 | $100 | $1,000 |
| Paying users (Pro) | 0 | 5 | 50 |
| Paying teams | 0 | 0 | 3 |
| Template page organic sessions | 500 | 2,000 | 10,000 |

Month 3 targets are conservative — Phase 0 will have completed only recently.
Month 12 targets are the seed-round targets: what makes Readable fundable.

---

## Dependency Graph

```
Phase 0 (Measurement)
  └── Required before: Everything else
      Reason: No data → no decisions

Phase 1 (Monetization)
  └── Required before: Phase 3 (Teams plan needs billing infrastructure)
  └── Parallel work available: P2-2 frontmatter, P2-3 templates (no revenue gate)

Phase 2 (Distribution)
  └── Required before: P4-1 GitHub Action (action uses CLI auth pattern)
  └── Parallel with: Phase 1 (frontmatter, template pages can ship while billing builds)

Phase 3 (B2B)
  └── Requires: Phase 1 (billing), Phase 0 data showing a paying cohort
  └── Required before: Enterprise features (Phase 4+)

Phase 4 (Category)
  └── No hard dependencies
  └── P4-2 KaTeX and P4-3 Embeds can ship any time after Phase 1
  └── P4-4 VS Code requires Phase 2 CLI (auth pattern)
```

Items that can ship in parallel with any phase:
- Frontmatter support (P2-2)
- KaTeX math (P4-2)
- Embed codes (P4-3)
- One template SEO page per week (ongoing)

---

## New Dependencies Reference

| Package | Phase | Purpose |
|---|---|---|
| `stripe` | 1 | Billing |
| `remark-frontmatter` | 2 | Parse YAML frontmatter |
| `js-yaml` | 2 | Parse YAML values |
| `bcryptjs` | 2 | Hash viewer passwords |
| `jose` | 2 | Sign/verify password auth JWT cookies |
| `remark-math` | 4 | Parse `$...$` and `$$...$$` |
| `katex` | 4 | Render LaTeX to HTML |
| `resend` | 3 | Team invite emails |
| `commander` | CLI | CLI argument parsing (in `@readable/cli`) |

---

## D1 Migrations Sequence

```
0005_publish_events.sql        Phase 0 — publisher funnel tracking
0006_add_plan_to_users.sql     Phase 1 — plan, stripe columns
0007_attribution_badge.sql     Phase 1 — remove_attribution_badge flag
0008_password_protection.sql   Phase 2 — password_hash on pages
0009_featured_pages.sql        Phase 2 — featured flag for explore
0010_teams.sql                 Phase 3 — teams and team_members tables
```

Apply migrations in sequence. Never skip one. Test each against the remote D1
instance before merging.

---

*This document supersedes `ROADMAP.md`, `IMPLEMENTATION_PLAN.md`, and
`STRATEGY_EXECUTION_PLAN.md`. Those files have been deleted. When this document
conflicts with anything in `PRODUCT.md` or `BRAND.md`, this document takes precedence
on engineering decisions; `PRODUCT.md` takes precedence on what the product does;
`BRAND.md` takes precedence on visual and copy decisions.*

*Update this document as phases complete. Mark items done inline. Add deviations
from the plan with a note explaining why.*
