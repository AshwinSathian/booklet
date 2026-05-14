# Readable — Technical Implementation Plan

> **Purpose:** This document translates the strategic product roadmap into a fully
> detailed, engineer-ready implementation spec. Every item includes: what to build,
> which files to touch, which libraries to use, DB changes required, API contract, UI
> behaviour, and step-by-step implementation guidance.
>
> **Audience:** The engineer building Readable (currently sole contributor).
>
> **Current stack (verified from source):**
> - Next.js App Router (Node.js runtime on Cloudflare Workers via OpenNext)
> - React 19, TypeScript strict, Tailwind CSS v4
> - MongoDB Atlas — collections: `docs`, `pages`, `users`, `api_keys`
> - Cloudflare Workers + KV (rate-limit counters only — doc/metadata storage is MongoDB)
> - Clerk for auth
> - `unified`/`remark` for Markdown parsing → custom AST (Block[])
> - GA4 analytics via `@/lib/analytics`
>
> **Baseline awareness:**
> Several Phase 0 items are already partially or fully implemented:
> - Permanent pages for signed-in users → **done** (`putDoc(id, doc, isAuthenticated)` in `/api/publish/route.ts:73`)
> - OG images with page title → **done** (`?title=${titleParam}` in `/app/p/[id]/page.tsx:69–70`)
> - Reading time on share pages → **done** (`readingTimeMinutes` in `reading-time.ts`, shown in share page header)
> - Slug resolution on share pages → **infrastructure done** (`resolveSharePage`, `getPageBySlug`); **UI missing**
> - Attribution footer → **partially done** (footer exists; needs enrichment per plan)
>
> Where items are partially done, this plan documents only the missing parts.

---

## Document Structure

| Section | Phases |
|---|---|
| [Phase 0 — Foundation](#phase-0--foundation-weeks-1-4) | Custom slugs, attribution, slug PATCH API |
| [Phase 1 — Retention](#phase-1--retention-and-stickiness-months-1-3) | Publisher analytics, version history, collections, PDF export |
| [Phase 2 — Writing Surface](#phase-2--the-writing-surface-months-3-6) | Mermaid, frontmatter, KaTeX, embed codes, password protection, template SEO |
| [Phase 3 — Distribution](#phase-3--distribution-and-network-months-6-12) | Explore page, CLI, GitHub integration, Slack, Team Spaces, VS Code extension |
| [Phase 4 — Monetisation](#phase-4--monetisation-months-8-14) | Tiered pricing, billing, quota enforcement |
| [Appendix](#appendix) | MongoDB index guide, env vars reference, testing guide |

---

## Phase 0 — Foundation (Weeks 1–4)

> Highest ROI changes. Most are 1–3 day builds. Do these before anything else.

---

### P0-1 — Custom slug UI

**Status:** Infrastructure is done. The `slug` field exists in `DbPage`, `getPageBySlug` and
`resolveSharePage` handle slug-based lookups. What's missing is the UI for a user to *set*
their slug, and the API endpoint to *persist* it.

**What it enables:** URLs like `/p/my-incident-2026-05` instead of `/p/Ab3k91QxZp`.
Memorable, shareable in Slack messages and READMEs, builds brand trust.

#### Step 1 — PATCH endpoint for slug + visibility

File: `src/app/api/v1/pages/[id]/route.ts` (create — this route does not exist yet)

```
PATCH /api/v1/pages/:id
Authorization: Bearer rdbl_...
Content-Type: application/json

{ "slug": "my-incident-2026", "visibility": "public" }
```

Implementation:

```typescript
// src/app/api/v1/pages/[id]/route.ts
import { resolveApiKey } from "@/lib/api-key-auth";
import { getPageRecord, updatePageRecord } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await resolveApiKey(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(`v1__patch_page__${userId}`, 30);
  if (rl) return rl;

  const { id } = await params;
  const page = await getPageRecord(id);

  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (page.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as { slug?: string; visibility?: string };

  const patch: Parameters<typeof updatePageRecord>[1] = {
    updated_at: new Date().toISOString(),
  };

  if (body.slug !== undefined) {
    if (body.slug !== null && !SLUG_RE.test(body.slug)) {
      return NextResponse.json({ error: "Invalid slug. Use lowercase letters, numbers, and hyphens (3–60 chars)." }, { status: 422 });
    }
    // Uniqueness check
    if (body.slug) {
      const { getPageBySlug } = await import("@/lib/db");
      const existing = await getPageBySlug(body.slug);
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: "Slug already taken." }, { status: 409 });
      }
    }
    patch.slug = body.slug ?? null;
  }

  if (body.visibility === "public" || body.visibility === "unlisted") {
    patch.visibility = body.visibility;
  }

  await updatePageRecord(id, patch);
  return NextResponse.json({ ok: true }, { status: 200 });
}
```

**Slug validation rules:**
- 3–60 characters
- Lowercase letters, numbers, hyphens only
- Cannot start or end with a hyphen
- Must be globally unique (across all users)

**MongoDB index required:** Unique sparse index on `slug` in the `pages` collection (already
present if `getPageBySlug` is working, but confirm):

```javascript
db.pages.createIndex({ slug: 1 }, { unique: true, sparse: true })
```

#### Step 2 — Browser PATCH endpoint (for the My Pages UI)

File: `src/app/api/pages/[id]/route.ts` (create)

This mirrors the v1 API endpoint but uses Clerk session auth instead of API key auth.

```typescript
// src/app/api/pages/[id]/route.ts
import { auth } from "@clerk/nextjs/server";
import { getPageRecord, updatePageRecord } from "@/lib/db";
import { getPageBySlug } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const page = await getPageRecord(id);

  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (page.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as { slug?: string | null; visibility?: string };
  const patch: Parameters<typeof updatePageRecord>[1] = {
    updated_at: new Date().toISOString(),
  };

  if ("slug" in body) {
    if (body.slug && !SLUG_RE.test(body.slug)) {
      return NextResponse.json({ error: "Invalid slug." }, { status: 422 });
    }
    if (body.slug) {
      const existing = await getPageBySlug(body.slug);
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: "Slug already taken." }, { status: 409 });
      }
    }
    patch.slug = body.slug ?? null;
  }

  if (body.visibility === "public" || body.visibility === "unlisted") {
    patch.visibility = body.visibility;
  }

  await updatePageRecord(id, patch);
  return NextResponse.json({ ok: true });
}
```

#### Step 3 — Slug editor component

File: `src/components/app/SlugEditor.tsx` (create)

This is an inline editor shown after publish when the user is signed in, and also in the
My Pages row. It shows the current URL, lets the user click to edit the slug segment,
validates on blur, and calls the PATCH endpoint.

```
┌──────────────────────────────────────────────────────┐
│ readable.xyz/p/  [incident-q2-2026    ] [✓]  [✕]    │
└──────────────────────────────────────────────────────┘
```

Props:
```typescript
type SlugEditorProps = {
  pageId: string;
  currentSlug: string | null;
  onSaved: (newSlug: string | null) => void;
};
```

Behaviour:
- Shows `readable.xyz/p/[slug or id]` as a read-only display when not editing
- Click pencil icon → enter editing mode; show input pre-filled with current slug (or empty)
- On blur or Enter: send `PATCH /api/pages/{id}` with `{ slug }`, show inline error if slug
  is taken or invalid, show green tick on success
- On Escape: cancel without saving
- "Clear slug" option: send `{ slug: null }` to revert to ID-based URL
- Debounce uniqueness check: 400ms after typing stops, show inline "✓ available" or "✗ taken"
  by calling `GET /api/pages/check-slug?slug=X&exclude=pageId`

**Availability check endpoint** (add to `src/app/api/pages/check-slug/route.ts`):
```typescript
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") ?? "";
  const exclude = searchParams.get("exclude") ?? "";
  if (!slug) return Response.json({ available: false });
  const existing = await getPageBySlug(slug);
  return Response.json({ available: !existing || existing.id === exclude });
}
```

#### Step 4 — Wire SlugEditor into My Pages and post-publish

**My Pages** (`src/app/my-pages/MyPagesClient.tsx`):
- Add a slug column (or expandable row detail) showing the current slug with inline
  `SlugEditor` component
- On successful slug set, update local state so the UI reflects the new URL without a page reload

**Post-publish in TopBar** (`src/components/app/TopBar.tsx`):
- After a successful publish for a signed-in user (when `publishedOwned === true`),
  render `SlugEditor` inline below the copy-link pill, so the user can immediately
  set a human-readable slug before sharing

---

### P0-2 — Attribution link enhancement

**Status:** The share page footer already says "Published via Readable" with a "Create your
own →" link. This satisfies the acquisition loop partially. The enhancement adds:

1. A small "Made with Readable" badge in the bottom-right corner of the page (fixed position,
   not in the footer — visible as a persistent chip during scroll, disappears on print)
2. The footer link text changes to a proper brand statement

**File:** `src/app/p/[id]/page.tsx`

Add above the closing `</div>` of the share page, outside the footer:

```tsx
{/* Floating attribution — acquisition loop anchor */}
<a
  href="https://readable.ashwinsathian.com"
  target="_blank"
  rel="noopener"
  className="fixed bottom-4 right-4 z-10 hidden sm:flex items-center gap-1.5 rounded-pill border border-border-subtle bg-bg/80 backdrop-blur-md px-3 py-1.5 text-2xs text-text-muted transition hover:border-accent-soft/40 hover:text-text-primary print:hidden"
  aria-label="Made with Readable"
>
  <AppLogo onlyIcon={true} size={12} />
  Made with Readable
</a>
```

**Paid tier override (Phase 4):** When `isPermanent && pageRecord.user_tier === "pro"`,
conditionally suppress this badge. For now, always show it.

---

### P0-3 — Slug-aware ROUTES helper

**File:** `src/lib/constants.ts`

Update `ROUTES.publish` to prefer slug when available:

```typescript
export const ROUTES = {
  // ...existing...
  publish: (idOrSlug: string) => `/p/${idOrSlug}`,
} as const;
```

This is already correct — the function just takes a string. The caller is responsible for
passing `page.slug ?? page.id`. Update all callers in `MyPagesClient.tsx`, `TopBar.tsx`,
and API response handlers to use `page.slug ?? page.id` when constructing share URLs.

---

## Phase 1 — Retention and Stickiness (Months 1–3)

---

### P1-1 — Publisher analytics

**Status:** Implemented in this repo. Share pages now emit privacy-safe `view`,
`read_50`, and `read_100` events into `analytics_events`; My Pages links to the
owner-only dashboard at `/my-pages/analytics/:pageId`.

**Goal:** Show each page owner: unique views, referrers (bucketed), reading completion
(scroll depth), geographic distribution. Make the data feel rewarding so authors
come back.

**Architecture decision:** Store analytics events in a dedicated MongoDB collection
(`analytics_events`). Do NOT use a third-party analytics provider — this data is the
product feature, not just an operational metric.

#### Step 1 — Analytics event schema

New collection: `analytics_events`

```typescript
// src/lib/db/types.ts — add:
export type AnalyticsEvent = {
  id: string;            // UUID v4
  page_id: string;       // FK → pages._id
  event: "view" | "read_50" | "read_100" | "exit";
  referrer_bucket: "slack" | "twitter" | "github" | "email" | "direct" | "other";
  country: string | null; // ISO 3166-1 alpha-2
  session_hash: string;  // SHA-256 of (IP + user-agent + date) — privacy-safe fingerprint
  created_at: string;
};
```

**MongoDB indexes:**
```javascript
db.analytics_events.createIndex({ page_id: 1, created_at: -1 })
db.analytics_events.createIndex({ created_at: 1 }, { expireAfterSeconds: 7776000 }) // 90-day TTL
db.analytics_events.createIndex({ session_hash: 1, page_id: 1 }, { unique: true, sparse: true })
// The session_hash+page_id unique index deduplicates views per session
```

#### Step 2 — Analytics ingest endpoint

File: `src/app/api/analytics/view/route.ts` (create)

This endpoint is called client-side from the share page on load and on scroll events.
It must be fast (fire-and-forget from the client) and not block page rendering.

```typescript
// POST /api/analytics/view
// Body: { pageId, event, referrer, scrollDepth }
// No auth required.

export async function POST(req: Request) {
  const body = await req.json();
  const { pageId, event, referrer } = body as {
    pageId: string;
    event: "view" | "read_50" | "read_100";
    referrer?: string;
  };

  if (!pageId || !event) return new Response(null, { status: 204 });

  // Rate-limit: max 100 events per IP per hour
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = await checkRateLimit(`analytics__${ip}`, 100);
  if (rl) return new Response(null, { status: 204 }); // silently drop, don't 429

  const country = req.headers.get("cf-ipcountry") ?? null;

  // Privacy-safe session fingerprint (not stored raw)
  const raw = `${ip}|${req.headers.get("user-agent") ?? ""}|${new Date().toDateString()}`;
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const sessionHash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  const referrerBucket = bucketReferrer(referrer ?? "");

  const db = await getDb();
  await db.collection("analytics_events").updateOne(
    { session_hash: sessionHash, page_id: pageId, event },
    {
      $setOnInsert: {
        id: crypto.randomUUID(),
        page_id: pageId,
        event,
        referrer_bucket: referrerBucket,
        country,
        session_hash: sessionHash,
        created_at: new Date().toISOString(),
      },
    },
    { upsert: true }, // idempotent: one event per session per page
  );

  return new Response(null, { status: 204 });
}

function bucketReferrer(ref: string): AnalyticsEvent["referrer_bucket"] {
  if (!ref || ref === "") return "direct";
  if (ref.includes("slack.com") || ref.includes("slack-edge.com")) return "slack";
  if (ref.includes("twitter.com") || ref.includes("t.co") || ref.includes("x.com")) return "twitter";
  if (ref.includes("github.com") || ref.includes("github.io")) return "github";
  // Email clients rarely send referrers; treat mail.google.com / mail.yahoo.com etc.
  if (ref.includes("mail.google") || ref.includes("mail.yahoo") || ref.includes("outlook")) return "email";
  return "other";
}
```

#### Step 3 — Client-side beacon on share pages

File: `src/components/share/AnalyticsBeacon.tsx` (create)

```typescript
"use client";

import { useEffect, useRef } from "react";

export function AnalyticsBeacon({ pageId }: { pageId: string }) {
  const fired50 = useRef(false);
  const fired100 = useRef(false);

  useEffect(() => {
    // Fire initial view event
    void navigator.sendBeacon(
      "/api/analytics/view",
      JSON.stringify({ pageId, event: "view", referrer: document.referrer }),
    );

    // Scroll depth tracking
    function onScroll() {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      const pct = scrolled / total;

      if (!fired50.current && pct >= 0.5) {
        fired50.current = true;
        void navigator.sendBeacon("/api/analytics/view", JSON.stringify({ pageId, event: "read_50" }));
      }
      if (!fired100.current && pct >= 0.95) {
        fired100.current = true;
        void navigator.sendBeacon("/api/analytics/view", JSON.stringify({ pageId, event: "read_100" }));
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pageId]);

  return null;
}
```

Add `<AnalyticsBeacon pageId={resolvedId} />` to `src/app/p/[id]/page.tsx`.

**Note:** `navigator.sendBeacon` is fire-and-forget and doesn't block navigation. It falls
back to a background `fetch` in environments that don't support it. Use this instead of
`fetch` to avoid delaying page unload.

#### Step 4 — Analytics query helpers

File: `src/lib/db/analytics.ts` (create)

```typescript
export type PageAnalyticsSummary = {
  total_views: number;
  unique_views: number;
  read_50_pct: number;    // % of unique viewers who reached 50%
  read_100_pct: number;   // % of unique viewers who reached 100%
  referrers: Record<AnalyticsEvent["referrer_bucket"], number>;
  top_countries: Array<{ country: string; count: number }>;
  views_by_day: Array<{ date: string; views: number }>; // last 30 days
};

export async function getPageAnalytics(pageId: string): Promise<PageAnalyticsSummary> {
  const db = await getDb();
  const coll = db.collection<AnalyticsEvent>("analytics_events");
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

  // Aggregate in a single pipeline
  const [result] = await coll.aggregate([
    { $match: { page_id: pageId, created_at: { $gte: thirtyDaysAgo } } },
    {
      $facet: {
        counts: [
          { $group: { _id: "$event", uniqueSessions: { $addToSet: "$session_hash" } } },
          { $project: { event: "$_id", count: { $size: "$uniqueSessions" } } },
        ],
        referrers: [
          { $match: { event: "view" } },
          { $group: { _id: "$referrer_bucket", count: { $sum: 1 } } },
        ],
        countries: [
          { $match: { event: "view", country: { $ne: null } } },
          { $group: { _id: "$country", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 },
        ],
        byDay: [
          { $match: { event: "view" } },
          { $group: { _id: { $substr: ["$created_at", 0, 10] }, views: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ]).toArray();

  // Transform aggregation result into PageAnalyticsSummary...
  // (full transformation logic omitted for brevity — standard aggregation unwrapping)
  return transformAnalyticsResult(result);
}
```

#### Step 5 — Analytics dashboard UI

File: `src/app/my-pages/analytics/[id]/page.tsx` (create)

Route: `/my-pages/analytics/:pageId` — protected by Clerk middleware.

UI layout:
```
┌─────────────────────────────────────────────────┐
│  ← Back to My Pages    "Incident Report Q2"     │
├──────────┬──────────┬──────────┬────────────────┤
│ 247      │ 189      │ 62%      │ 41%            │
│ Views    │ Unique   │ Read 50% │ Read 100%       │
├──────────┴──────────┴──────────┴────────────────┤
│ Views last 30 days (sparkline bar chart)         │
├─────────────────────────┬───────────────────────┤
│ Referrers               │ Top countries          │
│ ████ Slack      54%     │ 🇺🇸 US    48%          │
│ ██   Direct     31%     │ 🇬🇧 GB    22%          │
│ █    GitHub     15%     │ 🇩🇪 DE    12%          │
└─────────────────────────┴───────────────────────┘
```

**No charting library** — use CSS `width` percentages for the bar charts. No D3, no
Recharts. This is a table with percentage-bar decorations, nothing more. Keeps bundle
size zero.

The bar chart for "Views last 30 days" is a series of `<div>` elements with variable
heights inside a `display: flex; align-items: flex-end` container.

Link from My Pages row: add a "stats" icon button that navigates to
`/my-pages/analytics/${page.id}`.

---

### P1-2 — Version history

**Status:** Implemented in this repo. Authenticated publishes and in-place updates
snapshot the latest `PublishedDoc` into `page_versions`, My Pages links to an
owner-only version history page, and owners can preview or restore saved versions.

**Goal:** Keep the last 10 versions of any published page so authors can see what changed
and revert if needed. Non-negotiable for incident reports and ADRs.

#### Step 1 — Version storage schema

New collection: `page_versions`

```typescript
// src/lib/db/types.ts — add:
export type PageVersion = {
  id: string;             // UUID v4
  page_id: string;        // FK → pages._id
  version_number: number; // auto-increment per page, 1-based
  doc_snapshot: string;   // JSON.stringify(PublishedDoc) — compressed with gzip via CompressionStream
  created_at: string;
  size_bytes: number;
};
```

**MongoDB indexes:**
```javascript
db.page_versions.createIndex({ page_id: 1, version_number: -1 })
db.page_versions.createIndex({ page_id: 1, created_at: -1 })
```

#### Step 2 — Snapshot on every update

File: `src/lib/db/versions.ts` (create)

```typescript
export async function snapshotPageVersion(
  pageId: string,
  doc: PublishedDoc,
): Promise<void> {
  const db = await getDb();
  const coll = db.collection<PageVersion>("page_versions");

  // Get current max version number
  const latest = await coll
    .find({ page_id: pageId })
    .sort({ version_number: -1 })
    .limit(1)
    .toArray();

  const nextVersion = (latest[0]?.version_number ?? 0) + 1;
  const json = JSON.stringify(doc);
  const encoded = new TextEncoder().encode(json);

  await coll.insertOne({
    id: crypto.randomUUID(),
    page_id: pageId,
    version_number: nextVersion,
    doc_snapshot: json,
    created_at: new Date().toISOString(),
    size_bytes: encoded.byteLength,
  });

  // Enforce max 10 versions per page — delete oldest if over limit
  const count = await coll.countDocuments({ page_id: pageId });
  if (count > 10) {
    const oldest = await coll
      .find({ page_id: pageId })
      .sort({ version_number: 1 })
      .limit(count - 10)
      .toArray();
    await coll.deleteMany({ id: { $in: oldest.map(v => v.id) } });
  }
}

export async function getPageVersions(pageId: string): Promise<PageVersion[]> {
  const db = await getDb();
  return db
    .collection<PageVersion>("page_versions")
    .find({ page_id: pageId })
    .sort({ version_number: -1 })
    .toArray();
}

export async function getPageVersion(
  pageId: string,
  versionNumber: number,
): Promise<PublishedDoc | null> {
  const db = await getDb();
  const v = await db
    .collection<PageVersion>("page_versions")
    .findOne({ page_id: pageId, version_number: versionNumber });
  if (!v) return null;
  return JSON.parse(v.doc_snapshot) as PublishedDoc;
}
```

#### Step 3 — Call snapshot on every publish/update

In `src/app/api/publish/route.ts` and `src/app/api/v1/publish/route.ts`, after a
successful `putDoc` for an authenticated user, call:

```typescript
if (isAuthenticated) {
  void snapshotPageVersion(id, doc).catch(err =>
    console.error("[publish] version snapshot failed:", err)
  );
}
```

For the update-in-place flow (same `id`, existing page), snapshot *before* overwriting.

#### Step 4 — Version history API

File: `src/app/api/pages/[id]/versions/route.ts` (create)

```
GET /api/pages/:id/versions
→ [{ version_number, created_at, size_bytes }]

GET /api/pages/:id/versions/:versionNumber
→ { doc: PublishedDoc }
```

Both routes require Clerk session auth and verify `page.user_id === userId`.

#### Step 5 — Version history UI

File: `src/app/my-pages/versions/[id]/page.tsx` (create)

Accessible from My Pages via a "history" icon next to each page row.

Layout:
```
← Back    "Incident Report Q2"  — Version History

  v5  Today at 14:32         [Restore] [Preview]
  v4  Yesterday at 09:15     [Restore] [Preview]
  v3  3 days ago             [Restore] [Preview]
  ...
```

"Preview" opens the version's rendered content in a modal (reuse `BlockRenderer`).
"Restore" calls `PATCH /api/pages/:id` with the restored doc content and creates a new
version snapshot of the current state before overwriting.

---

### P1-3 — Collections (page organisation)

**Status:** Implemented in this repo. My Pages now supports collection creation,
filtering, deletion, and HTML5 drag-and-drop assignment backed by Clerk-protected
collection APIs and MongoDB `collections` records.

**Goal:** Let users organise their pages into named groups. The flat list in My Pages
breaks past 20 documents.

#### Step 1 — Collections schema

New collection: `collections`

```typescript
// src/lib/db/types.ts — add:
export type Collection = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};
```

Add `collection_id: string | null` to `DbPage`.

**MongoDB indexes:**
```javascript
db.collections.createIndex({ user_id: 1, name: 1 }, { unique: true })
db.pages.createIndex({ collection_id: 1, user_id: 1 })
```

#### Step 2 — Collection CRUD API

File: `src/app/api/collections/route.ts` — `GET` (list), `POST` (create)
File: `src/app/api/collections/[id]/route.ts` — `PATCH` (rename), `DELETE`
File: `src/app/api/collections/[id]/pages/route.ts` — `POST` to add a page,
`DELETE` to remove a page from the collection

All routes: Clerk session auth.

#### Step 3 — My Pages UI update

In `src/app/my-pages/MyPagesClient.tsx`:
- Left sidebar (desktop) or top filter strip (mobile) shows collection names
- Clicking a collection filters the page list
- "All pages" is the default view
- "Uncollected" shows pages with `collection_id === null`
- Drag-and-drop to assign pages to collections (use the HTML5 Drag API, no library)
- "New collection" button opens a one-line input at the top of the sidebar

---

### P1-4 — Real PDF export

**Current state:** `ExportMenu` has "Print or Save as PDF" which calls `window.print()`.
This is a system print dialog — quality varies by browser and OS.

**Goal:** A true PDF download that preserves Readable's typographic quality.

**Approach:** Server-side PDF generation using the `@sparticuz/chromium` package with
Puppeteer, running as a Cloudflare Workers-compatible Node.js function.

**Alternative approach (recommended for Cloudflare Workers):** Use a browser-to-PDF
conversion service. The cleanest zero-dependency approach for the Cloudflare Workers
environment is to use the existing rendered HTML page and the browser's print CSS,
but trigger it server-side using a lightweight solution.

**Practical recommendation for Cloudflare Workers:**
Since Cloudflare Workers cannot run a headless browser, the PDF export route should
use `@playwright/test` in a separate Node.js process (outside Workers), or delegate
to an external PDF service. The most pragmatic path:

1. Build a dedicated `/api/pdf/:id` Next.js route that returns a `Content-Type: application/pdf`
2. Inside it, use `@vercel/og` (or a raw Satori-based approach) to generate a PDF-compatible
   SVG → PDF conversion, OR simply return the existing HTML with print-optimised CSS and
   document it as a "print to PDF" flow
3. **Pragmatic fallback for Workers:** Enhance `window.print()` with print-specific CSS
   that produces near-identical output to a "real" PDF. This is zero-cost and zero-bundle-size.

**Print CSS enhancement (immediate win, no infra cost):**

File: `src/app/globals.css` — add inside `@media print`:
```css
@media print {
  header, footer, .print\:hidden { display: none !important; }
  body { font-size: 12pt; color: #000; background: #fff; }
  h1 { font-size: 24pt; }
  h2 { font-size: 18pt; }
  h3 { font-size: 14pt; }
  a[href]::after { content: " (" attr(href) ")"; font-size: 9pt; color: #666; }
  pre, code { background: #f5f5f5 !important; color: #333 !important; border: 1px solid #ddd; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 4pt 8pt; }
  @page { margin: 2cm; }
}
```

**True PDF (deferred to Phase 2):** Implement via a dedicated `/api/render-pdf` route
using a hosted Puppeteer instance (Render.com free tier runs Node.js). The Workers
deployment calls out to this sidecar service. Document this architecture in infra notes.

---

## Phase 2 — The Writing Surface (Months 3–6)

---

### P2-1 — Mermaid diagram rendering (first-class)

**Current state:** `DiagramBlock` exists in `src/components/blocks/DiagramBlock.tsx`.
Verify it works end-to-end. Make it documented and solid.

#### Step 1 — Audit DiagramBlock

Check `src/components/blocks/DiagramBlock.tsx` and `src/lib/parse.ts`:
- Verify fenced code blocks with ` ```mermaid ` are parsed into a `diagram` block type
- Verify `DiagramBlock` initialises `mermaid` client-side with `mermaid.initialize({ startOnLoad: false })`
- Verify it uses `mermaid.render()` to produce SVG output and injects it safely (not `dangerouslySetInnerHTML` — use `element.innerHTML = svg` on the div ref, since this is SVG from a trusted renderer)
- Verify dark/light mode: Mermaid supports `theme: 'dark'` and `theme: 'default'`. Subscribe to the CSS class change on `<html>` to re-render when the user switches themes.

#### Step 2 — Error handling

If Mermaid throws a parse error (invalid diagram syntax), show a styled error panel
instead of a blank space:

```tsx
<div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
  <p className="text-sm font-semibold text-red-400">Diagram error</p>
  <pre className="mt-2 text-xs text-red-300 whitespace-pre-wrap">{error.message}</pre>
</div>
```

#### Step 3 — Dynamic import to avoid SSR issues

```typescript
const mermaid = (await import("mermaid")).default;
```

Mermaid must be imported dynamically (not statically) because it accesses `window` and
`document` on module initialisation. Use `useEffect` + dynamic import pattern.

#### Step 4 — Supported diagram types to document

In `PRODUCT.md`, add a section listing supported Mermaid diagram types:
- `flowchart` / `graph`
- `sequenceDiagram`
- `classDiagram`
- `erDiagram`
- `gantt`
- `stateDiagram-v2`
- `pie`
- `gitGraph`

Document the code fence syntax: ` ```mermaid `.

---

### P2-2 — YAML frontmatter support

**Goal:** Let users write frontmatter at the top of their Markdown to set title, date,
author, description, and tags. This makes Readable compatible with the existing Markdown
ecosystem.

**Supported frontmatter keys:**
```yaml
---
title: "Incident Report — Payment Gateway Down"
date: 2026-05-08
author: "Ashwin Sathian"
description: "Post-mortem for the 3-hour payment gateway outage"
tags: [incident, p1, payment]
visibility: unlisted
---
```

#### Step 1 — Parse frontmatter in `parse.ts`

File: `src/lib/parse.ts`

Add `remark-frontmatter` and `remark-parse-frontmatter` (or use `js-yaml` directly):

```bash
npm install remark-frontmatter js-yaml
npm install --save-dev @types/js-yaml
```

In `parseToBlocks`, before the main remark pipeline, strip and parse frontmatter:

```typescript
import remarkFrontmatter from "remark-frontmatter";
import yaml from "js-yaml";

// Add to the remark plugin chain
.use(remarkFrontmatter, ["yaml"])
.use(() => (tree, file) => {
  const yamlNode = tree.children.find(n => n.type === "yaml");
  if (yamlNode) {
    try {
      file.data.frontmatter = yaml.load(yamlNode.value) as Record<string, unknown>;
    } catch {
      // invalid frontmatter — ignore
    }
    // Remove the yaml node from the AST so it doesn't render as text
    tree.children = tree.children.filter(n => n.type !== "yaml");
  }
})
```

#### Step 2 — Pass frontmatter through the block pipeline

Update the return type of `parseToBlocks` to include frontmatter:

```typescript
export type ParseResult = {
  blocks: Block[];
  frontmatter: {
    title?: string;
    date?: string;
    author?: string;
    description?: string;
    tags?: string[];
    visibility?: "public" | "unlisted";
  } | null;
};
```

Callers (editor preview, publish route) need to handle the new return shape.

#### Step 3 — Use frontmatter in publish

In `src/app/api/publish/route.ts` and `src/app/api/v1/publish/route.ts`:
- If `frontmatter.title` is present, use it as the `title` for `createPageRecord`
  (overriding the auto-extracted title from heading H1)
- If `frontmatter.visibility` is present, pass it to `createPageRecord`

#### Step 4 — Render frontmatter metadata on the share page

In `src/app/p/[id]/page.tsx`, after parsing blocks, if frontmatter is present:
- Show author name below the H1 heading
- Show publication date (formatted) in the header
- Show tags as pill badges below the author line
- Use frontmatter description for `<meta description>` (overriding the auto-extract)

**Schema for storing frontmatter:** Add `frontmatter: Record<string, unknown> | null` to
`PublishedDoc` type in `src/lib/blocks.ts`.

---

### P2-3 — Math rendering (KaTeX)

**Goal:** Render LaTeX math expressions. Expands Readable's audience to researchers,
data scientists, and academics.

**Syntax:**
- Inline: `$E = mc^2$`
- Block: `$$\int_a^b f(x)\,dx$$`

**Library:** KaTeX — the smallest, fastest, most reliable LaTeX renderer for the web.
Do NOT use MathJax (too heavy — ~500KB+).

```bash
npm install katex
npm install --save-dev @types/katex
```

#### Step 1 — Parse math in `parse.ts`

```bash
npm install remark-math
```

Add `remarkMath` to the remark plugin chain. This converts `$...$` to `inlineMath` nodes
and `$$...$$` to `math` nodes.

#### Step 2 — Add `math` block type and `inlineMath` inline type to blocks schema

In `src/lib/blocks.ts`:
```typescript
// Block types — add:
{ t: "math"; src: string }          // display math ($$...$$)

// Inline types — add:
{ t: "math"; src: string }          // inline math ($...$)
```

#### Step 3 — Render in BlockRenderer and InlineRenderer

File: `src/components/blocks/BlockRenderer.tsx`:
```tsx
case "math":
  return (
    <div
      className="my-4 text-center overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: katex.renderToString(block.src, { displayMode: true, throwOnError: false }) }}
    />
  );
```

File: `src/components/blocks/InlineRenderer.tsx`:
```tsx
case "math":
  return (
    <span
      dangerouslySetInnerHTML={{ __html: katex.renderToString(node.src, { displayMode: false, throwOnError: false }) }}
    />
  );
```

**Note:** `dangerouslySetInnerHTML` is safe here because KaTeX generates its own
sanitised HTML from LaTeX source. KaTeX does not interpret arbitrary HTML.

#### Step 4 — KaTeX CSS

KaTeX requires its CSS for proper rendering. Load it only on pages that may have math:

```typescript
// In the share page and editor, dynamically import KaTeX CSS:
import "katex/dist/katex.min.css";
```

Add this import to `src/app/app/primereact.css` (editor) and `src/app/globals.css`
(share pages). KaTeX CSS is ~280 bytes gzipped — acceptable to load globally.

---

### P2-4 — Embed codes

**Goal:** Let any published Readable page be embedded in Notion, Confluence, Linear,
or any HTML page via `<iframe>`.

#### Step 1 — Embed-specific render route

File: `src/app/embed/[id]/page.tsx` (create)

This is a stripped-down version of the share page: no sticky header, no footer, no
ToC sidebar, no export menu. Just the content in a white/dark container.

Add route parameters:
- `?theme=dark|light` — force a theme
- `?width=normal|wide` — content width
- `?padding=0|1` — whether to include padding (for seamless embeds)

Add `X-Frame-Options: SAMEORIGIN` header override for `/embed/*` routes only (the
default `DENY` header set in middleware must be overridden for this path):

```typescript
// src/middleware.ts — add frame exception for embed routes:
if (req.nextUrl.pathname.startsWith("/embed/")) {
  response.headers.set("X-Frame-Options", "ALLOWALL");
  // OR omit X-Frame-Options entirely (modern browsers use CSP frame-ancestors)
  response.headers.set("Content-Security-Policy",
    "frame-ancestors *;" // allow embedding anywhere
  );
}
```

#### Step 2 — Embed code generator UI

File: `src/components/share/EmbedDialog.tsx` (create)

Accessible from the share page header (new "Embed" button next to Export).

UI:
```
┌─────────────────────────────────────────────────────┐
│  Embed this page                                   ✕ │
├─────────────────────────────────────────────────────┤
│  Preview:  [iframe preview 400px]                   │
│                                                      │
│  Copy code:                                          │
│  <iframe src="..." width="100%" height="600"         │
│    frameborder="0" allow="..."></iframe>             │
│                                [Copy]                │
│                                                      │
│  Height  [600px    ▼]   Theme  [Auto ▼]             │
└─────────────────────────────────────────────────────┘
```

The generated embed code:
```html
<iframe
  src="https://readable.ashwinsathian.com/embed/Ab3k91QxZp"
  width="100%"
  height="600"
  frameborder="0"
  style="border-radius: 8px; border: 1px solid #eee;"
></iframe>
```

---

### P2-5 — Password-protected pages

**Goal:** A simple viewer password for sensitive pages (incident reports, internal runbooks).

**Security model:**
- Password is NOT stored in plaintext
- `bcrypt` hash stored in `pages.password_hash` (MongoDB)
- Reader enters password → server validates → sets a short-lived JWT cookie
- The JWT cookie is checked on every request to the share page

#### Step 1 — Schema

Add to `DbPage`:
```typescript
password_hash: string | null; // bcrypt hash of the viewer password
```

#### Step 2 — Password set/clear endpoint

`PATCH /api/pages/:id` — add `password?: string | null` to the patch body.
If `password` is provided and non-null: hash with `bcrypt.hash(password, 10)` and store.
If `password === null`: clear the hash.

```bash
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

#### Step 3 — Gate on share page

In `src/app/p/[id]/page.tsx`:
1. Check if `pageRecord.password_hash` is set
2. Check for a valid `readable_auth_{pageId}` cookie
3. If no valid cookie: redirect to `/p/${id}/password` instead of rendering the page

File: `src/app/p/[id]/password/page.tsx` (create) — a simple form asking for the password.

On form submit (Server Action or POST to `/api/pages/:id/auth`):
- Validate bcrypt match
- On success: set `readable_auth_{pageId}` cookie (HttpOnly, Secure, 24-hour expiry,
  signed with `JWT_SECRET` env var)
- On failure: re-render with "Incorrect password" error

**Cookie signing:**
```bash
npm install jose
```

```typescript
import { SignJWT } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const token = await new SignJWT({ pageId })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("24h")
  .sign(secret);
```

**Env var to add:** `JWT_SECRET` — 32-byte random hex string, stored in Cloudflare
Workers secrets and `.env.local`.

#### Step 4 — UI for setting a password

In My Pages row actions and in the post-publish TopBar panel, add a "Set password"
option that opens a small modal:

```
┌────────────────────────────────┐
│  Protect this page           ✕ │
├────────────────────────────────┤
│  Password  [____________]      │
│  Confirm   [____________]      │
│                                │
│  Anyone with the link needs    │
│  this password to view it.     │
│                                │
│  [Cancel]  [Set password]      │
└────────────────────────────────┘
```

Show a lock icon on password-protected pages in My Pages.

---

### P2-6 — Template SEO landing pages

**Goal:** Create dedicated landing pages for each template that rank for queries like
"incident report template", "ADR template markdown", "runbook template".

#### Step 1 — Template detail pages

File: `src/app/templates/[slug]/page.tsx` (create)

Route pattern: `/templates/incident-report`, `/templates/adr`, etc.

Each page includes:
- Template name as H1 (with proper structured data)
- 400–600 words of useful copy about the use case (what this document type is, when to
  use it, what good vs. bad examples look like)
- A live preview of the rendered template using `BlockRenderer` (server-rendered — SEO
  content)
- A "Use this template" CTA that deep-links to `/app?template=incident-report`

#### Step 2 — Template index page

File: `src/app/templates/page.tsx` (create)

Route: `/templates` — a grid of all templates with name, description, and "Use" CTA.

This page serves as a hub for template discovery. Add it to `src/app/sitemap.ts`.

#### Step 3 — Deep-link template loading in editor

In `src/app/app/AppClient.tsx`, read the `?template=` query param on mount. If present,
find the matching template from `TEMPLATES` array by slug (add a `slug` field to each
template definition) and auto-load it as the initial draft content. Clear the query
param from the URL without a page reload using `history.replaceState`.

#### Step 4 — Sitemap entries

In `src/app/sitemap.ts`, add all template pages:

```typescript
...TEMPLATES.map(t => ({
  url: absoluteUrl(`/templates/${t.slug}`),
  lastModified: new Date(),
  changeFrequency: "monthly" as const,
  priority: 0.8,
}))
```

#### Step 5 — Template slugs

Add `slug` to the `Template` type in `src/lib/templates.ts`:

| Template name | Slug |
|---|---|
| Incident Report | `incident-report` |
| Architecture Decision Record | `adr` |
| Release Notes | `release-notes` |
| README | `readme` |
| Meeting Notes | `meeting-notes` |
| Onboarding Guide | `onboarding-guide` |
| Runbook | `runbook` |
| Weekly Update | `weekly-update` |

**Expand template library to 20+ types** (Phase 2 scope):
Add: `pr-description`, `one-on-one-notes`, `sprint-retrospective`, `design-brief`,
`product-spec`, `api-changelog`, `deployment-checklist`, `okr-template`,
`interview-notes`, `data-dictionary`, `system-design`, `postmortem`.

---

## Phase 3 — Distribution and Network (Months 6–12)

---

### P3-1 — Public explore page

**Goal:** A curated, opt-in gallery of published pages. The explore page creates social
proof, generates fresh SEO content, and makes Readable feel alive.

#### Step 1 — Featured flag on pages

Add `featured: boolean` to `DbPage`. Default: `false`. Users opt in from My Pages settings.

Add MongoDB index: `db.pages.createIndex({ featured: 1, created_at: -1 })`

#### Step 2 — Explore API

File: `src/app/api/explore/route.ts` (create)

```
GET /api/explore?limit=20&offset=0&tag=incident-report
→ { pages: [{ id, slug, title, view_count, created_at, tags }] }
```

Only returns pages where `featured: true AND visibility: "public"`.

#### Step 3 — Explore page

File: `src/app/explore/page.tsx` (create)

Route: `/explore`

Layout:
```
Explore  —  Pages people are writing and sharing with Readable

  Filters: [All]  [Incident Reports]  [ADRs]  [Runbooks]  [Release Notes]

  ┌───────────────────────┐  ┌───────────────────────┐
  │ Incident Report       │  │ Q1 ADR: Auth Rewrite  │
  │ Q2 Payment Outage     │  │ ···                    │
  │ 247 views · 3 days ago│  │ 89 views · 1 week ago │
  └───────────────────────┘  └───────────────────────┘
```

Server component with pagination. Page cards link to the actual share page.
Add `/explore` to the landing page navigation and footer.

#### Step 4 — Opt-in toggle in My Pages

In `src/app/my-pages/MyPagesClient.tsx`, add a toggle in each page row:
"Feature on Explore". Calls `PATCH /api/pages/:id` with `{ featured: true }`.

Add `featured` to `DbPage` type and to `updatePageRecord` patch type.

---

### P3-2 — CLI: `readable publish`

**Goal:** `npm install -g @readable/cli && readable publish README.md` → returns a URL.
Once in a Makefile or GitHub Action, Readable has real switching cost.

#### Architecture

The CLI is a separate npm package: `@readable/cli`. Published to npm. Lives in
a `packages/cli/` subdirectory of the monorepo (or a separate repo).

**Language:** Node.js with TypeScript, compiled to ESM. No heavy dependencies.
Use `commander` for CLI argument parsing, `node-fetch` (or native `fetch` in Node 22)
for HTTP, and `marked` or `remark` for Markdown parsing.

#### Step 1 — Package structure

```
packages/cli/
  bin/
    readable.ts        # entry point
  src/
    commands/
      publish.ts       # readable publish <file>
      pages.ts         # readable pages list
      open.ts          # readable open [id]
    lib/
      auth.ts          # reads ~/.readable/config.json for API key
      api.ts           # HTTP client for the Readable API
      parse.ts         # thin wrapper around remark for Markdown → blocks
  package.json
  tsconfig.json
  README.md
```

#### Step 2 — `readable publish <file>`

```
readable publish INCIDENT.md
readable publish INCIDENT.md --title "Q2 Incident Report"
readable publish INCIDENT.md --slug "q2-incident-2026"
readable publish INCIDENT.md --visibility unlisted
readable publish INCIDENT.md --watch        # re-publish on file change
readable publish -                          # read from stdin: echo "# Hello" | readable publish -
```

Implementation:
1. Read file (or stdin)
2. Extract title from first H1 heading if `--title` not provided
3. POST to `POST /api/v1/publish` with `{ raw: content }` and `Authorization: Bearer ${apiKey}`
4. If `--slug` is provided, follow up with `PATCH /api/v1/pages/:id` to set the slug
5. Print the resulting URL to stdout

**Config file:** `~/.readable/config.json`:
```json
{ "apiKey": "rdbl_...", "baseUrl": "https://readable.ashwinsathian.com" }
```

`readable auth` command: prompts for API key, writes to config file.
`readable auth --key rdbl_...`: non-interactive setup (for CI environments).

#### Step 3 — `readable pages`

```
readable pages list
```

Calls `GET /api/v1/pages` and prints a formatted table:
```
ID           TITLE                  VIEWS  CREATED
Ab3k91QxZp   Q2 Incident Report     247    2026-05-01
```

#### Step 4 — `--watch` mode for real-time re-publish

Uses Node.js `fs.watch` to monitor the file. On change: re-publish to the same page ID
using `PATCH /api/v1/pages/:id` with new content. Prints "Updated: [url]" on each change.

This makes the CLI useful for live documentation writing sessions.

#### Step 5 — npm publish setup

`package.json` for `@readable/cli`:
```json
{
  "name": "@readable/cli",
  "version": "0.1.0",
  "bin": { "readable": "./dist/bin/readable.js" },
  "engines": { "node": ">=18" },
  "type": "module"
}
```

Add to CI: `npm publish --access public` on version tag.

---

### P3-3 — GitHub Integration

**Goal:** Publish any Markdown file in a GitHub repo to Readable directly. No local
setup required.

#### Approach A — GitHub Actions workflow template (documentation)

The simplest integration: document a ready-to-paste GitHub Actions workflow.

File: `docs/github-actions.md` (create)

```yaml
# .github/workflows/publish-to-readable.yml
name: Publish to Readable

on:
  push:
    branches: [main]
    paths: ['CHANGELOG.md', 'docs/**/*.md']

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Publish to Readable
        id: readable
        run: |
          RESPONSE=$(curl -s -X POST https://readable.ashwinsathian.com/api/v1/publish \
            -H "Authorization: Bearer ${{ secrets.READABLE_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d "{\"raw\": $(jq -Rs . < CHANGELOG.md)}")
          echo "url=$(echo $RESPONSE | jq -r '.url')" >> $GITHUB_OUTPUT

      - name: Comment URL on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `📄 Published to Readable: ${{ steps.readable.outputs.url }}`
            })
```

#### Approach B — GitHub Action (full action, Phase 3+)

A proper GitHub Action published to the GitHub Marketplace:
`readable-hq/publish-to-readable@v1`

Action inputs:
```yaml
inputs:
  api-key:
    description: "Readable API key"
    required: true
  file:
    description: "Markdown file to publish"
    required: true
  slug:
    description: "Custom URL slug"
    required: false
  visibility:
    description: "public or unlisted"
    default: "public"
```

Implementation: A Docker action or Node.js action that calls the Readable API.
Lives in a separate `readable-hq/publish-action` GitHub repository.

---

### P3-4 — Slack integration

**Goal:** A `/readable` slash command in Slack that publishes directly from a Slack message,
and rich unfurl previews when Readable links are shared in Slack.

#### Part A — Slack App (slash command)

This requires:
1. A Slack app with a slash command `/readable`
2. An OAuth flow to connect a Slack workspace to a Readable account
3. A slash command handler endpoint

File: `src/app/api/slack/command/route.ts` (create)

When `/readable publish <content>` is invoked in Slack:
1. Slack sends a POST with `command=/readable` and `text=publish <content>`
2. Parse the text, call `POST /api/v1/publish` with the content
3. Respond to Slack with the page URL in a formatted message block

This requires a Slack app registration (free) and storing the Slack workspace token
in MongoDB (`slack_tokens` collection).

**Slack App configuration:**
- Request URL: `https://readable.ashwinsathian.com/api/slack/command`
- Slash commands: `/readable`
- OAuth scopes: `commands`, `links:read`, `links:write`

#### Part B — Link unfurls

Register `readable.ashwinsathian.com` as an unfurl domain in the Slack app. When a user
shares a Readable link, Slack calls the app's Event API endpoint:

File: `src/app/api/slack/events/route.ts` (create)

On `link_shared` event:
1. Extract the URL from the event payload
2. Parse the page ID from the URL
3. Fetch page title and description from MongoDB
4. Return a Slack attachment block with title, description, and "Read on Readable" CTA

The unfurl response makes Readable links look premium in Slack — this is a viral
distribution mechanism.

---

### P3-5 — Team Spaces

**Goal:** A shared workspace for a small team. All pages published in the space are
owned by the team. Members can view, publish, and manage pages.

**This is the B2B wedge.** Team Spaces are the foundation for the Teams pricing tier.

#### Step 1 — Team schema

New collections: `teams`, `team_members`

```typescript
export type Team = {
  id: string;
  name: string;
  slug: string;            // used for the team subdomain/path
  owner_id: string;        // Clerk user ID
  created_at: string;
  plan: "free" | "teams";  // for Phase 4 gating
};

export type TeamMember = {
  id: string;
  team_id: string;
  user_id: string;
  role: "owner" | "editor" | "viewer";
  invited_email: string | null;  // null once the invite is accepted
  joined_at: string | null;
};
```

Add `team_id: string | null` to `DbPage`.

#### Step 2 — Team routes

```
/t/[team-slug]              — team home (public page index)
/t/[team-slug]/admin        — team admin (owner only)
/t/[team-slug]/members      — member management
```

File: `src/app/t/[slug]/page.tsx` (create) — public-facing team page listing.

#### Step 3 — Team membership invite flow

`POST /api/teams/:id/invite` — send an invite email to a given address.
The invite link contains a signed JWT. On accepting, the user is added to `team_members`.

For email: use **Resend** (free tier: 3,000 emails/month). Add `RESEND_API_KEY` to env vars.

```bash
npm install resend
```

#### Step 4 — Publishing to a team space

In the editor (`src/app/app/AppClient.tsx`), if the user is a member of one or more teams,
show a "Publish to team" option in the overflow menu alongside "Publish". This sets
`team_id` on the new page record.

#### Step 5 — Team analytics aggregation

Team-level analytics dashboard at `/t/[slug]/admin/analytics`:
- Total pages published
- Total views across all team pages
- Most-read pages
- Active members

---

### P3-6 — VS Code Extension

**Goal:** One-click publish from VS Code. Select a Markdown file, hit
`Cmd+Shift+P → Publish to Readable`. Returns a URL in the status bar.

#### Architecture

A VS Code extension published to the VS Code Marketplace.
Lives in a separate repository: `readable-hq/vscode-readable`.

Language: TypeScript. Uses the VS Code Extension API.

**Extension commands:**
- `readable.publish` — publish the active Markdown file
- `readable.publishSelection` — publish the selected text as Markdown
- `readable.setApiKey` — prompt for API key and store in VS Code settings

**VS Code settings contributed:**
```json
{
  "readable.apiKey": { "type": "string", "description": "Your Readable API key" },
  "readable.defaultVisibility": { "type": "string", "enum": ["public", "unlisted"], "default": "public" }
}
```

**On `readable.publish`:**
1. Read the content of the active editor (`vscode.window.activeTextEditor.document.getText()`)
2. POST to `POST /api/v1/publish` with `{ raw: content }`
3. On success: show URL in a VS Code notification with "Copy URL" and "Open" buttons
4. Optionally show a status bar item: "Readable: Published ✓"

**Package:** Published via `vsce package && vsce publish`. The extension ID:
`readable-hq.readable`.

---

## Phase 4 — Monetisation (Months 8–14)

---

### P4-1 — Pricing tiers

| Tier | Price | Limits | Key features |
|---|---|---|---|
| **Anonymous** | Free | 30-day expiry, 5 pages/month | All templates, "Made with Readable" badge |
| **Readable+** | $7/month or $60/year | Permanent pages, 100 pages/month | Custom slugs, analytics, version history, no badge, PDF export |
| **Teams** | $12/user/month | 5 free seats, unlimited pages | Team spaces, shared templates, team analytics, custom subdomain |
| **Enterprise** | Custom | Unlimited | Private deployment, SSO, SLA, audit logs, custom domain |

**Billing provider:** Stripe. Use Stripe Checkout (hosted, lowest PCI scope).

```bash
npm install stripe
```

#### Step 1 — Stripe setup

Required env vars:
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PRO_MONTHLY=price_...
STRIPE_PRICE_ID_PRO_ANNUAL=price_...
STRIPE_PRICE_ID_TEAMS=price_...
```

Stripe products to create in Stripe Dashboard:
1. "Readable+" — monthly ($7) and annual ($60) prices
2. "Readable Teams" — per-seat monthly ($12)

#### Step 2 — User schema update

Add to `DbUser`:
```typescript
stripe_customer_id: string | null;
stripe_subscription_id: string | null;
plan: "free" | "pro" | "teams";
plan_expires_at: string | null; // null for monthly (managed by Stripe)
```

#### Step 3 — Checkout flow

File: `src/app/api/billing/checkout/route.ts` (create)

```
POST /api/billing/checkout
Body: { priceId: string, returnUrl: string }
→ { checkoutUrl: string }
```

Implementation:
```typescript
const session = await stripe.checkout.sessions.create({
  customer_email: user.email ?? undefined,
  line_items: [{ price: priceId, quantity: 1 }],
  mode: "subscription",
  success_url: `${returnUrl}?checkout=success`,
  cancel_url: `${returnUrl}?checkout=cancelled`,
  metadata: { userId },
});
return NextResponse.json({ checkoutUrl: session.url });
```

#### Step 4 — Stripe webhook handler

File: `src/app/api/billing/webhook/route.ts` (create)

Handles:
- `checkout.session.completed` → upgrade user plan in MongoDB
- `customer.subscription.deleted` → downgrade to free
- `customer.subscription.updated` → update plan metadata

```typescript
export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature") ?? "";
  const body = await req.text();
  const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      if (userId) {
        await upsertUser(userId, null, {
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          plan: "pro",
        });
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      await downgradeUserByStripeCustomer(sub.customer as string);
      break;
    }
  }

  return new Response(null, { status: 200 });
}
```

#### Step 5 — Quota enforcement

File: `src/lib/quota.ts` — currently empty. Implement:

```typescript
export type UserLimits = {
  maxPagesPerMonth: number;  // -1 = unlimited
  permanentPages: boolean;
  customSlugs: boolean;
  analytics: boolean;
  versionHistory: boolean;
  removeBadge: boolean;
  pdfExport: boolean;
};

export function getLimitsForPlan(plan: "free" | "pro" | "teams"): UserLimits {
  switch (plan) {
    case "pro":
    case "teams":
      return { maxPagesPerMonth: 100, permanentPages: true, customSlugs: true,
               analytics: true, versionHistory: true, removeBadge: true, pdfExport: true };
    default: // free (signed-in)
      return { maxPagesPerMonth: 20, permanentPages: true, customSlugs: false,
               analytics: false, versionHistory: false, removeBadge: false, pdfExport: false };
  }
}
```

**Anonymous users** (not signed in): fall under the 30-day expiry rule. No change to
existing behaviour.

**Free signed-in users** get permanent pages (already implemented) but no custom slugs,
analytics, or version history. This is the conversion hook — they'll see greyed-out
premium features with upgrade prompts.

#### Step 6 — Upgrade prompts

In the My Pages UI and post-publish TopBar, show locked-state versions of premium
features with an upgrade CTA:

```
Custom URL  [my-incident-2026]  🔒  Upgrade to Readable+
            ← available on Readable+ →
```

Clicking the lock opens the pricing modal.

#### Step 7 — Pricing page

File: `src/app/pricing/page.tsx` (create)

A clean pricing comparison table. Three columns: Anonymous, Readable+, Teams.
Links to Stripe Checkout for the paid tiers.
Add to landing page nav and footer.

---

## Appendix

---

### MongoDB Index Reference

All indexes required across the full roadmap (consolidated):

```javascript
// Existing (should already exist)
db.pages.createIndex({ user_id: 1, created_at: -1 })
db.pages.createIndex({ slug: 1 }, { unique: true, sparse: true })
db.api_keys.createIndex({ key_hash: 1 }, { unique: true })
db.api_keys.createIndex({ user_id: 1 })

// Phase 0
db.pages.createIndex({ slug: 1 }, { unique: true, sparse: true })  // confirm exists

// Phase 1 — Analytics
db.analytics_events.createIndex({ page_id: 1, created_at: -1 })
db.analytics_events.createIndex({ session_hash: 1, page_id: 1, event: 1 }, { unique: true })
db.analytics_events.createIndex({ created_at: 1 }, { expireAfterSeconds: 7776000 })

// Phase 1 — Versions
db.page_versions.createIndex({ page_id: 1, version_number: -1 })

// Phase 1 — Collections
db.collections.createIndex({ user_id: 1, name: 1 }, { unique: true })
db.pages.createIndex({ collection_id: 1, user_id: 1 })

// Phase 3 — Teams
db.teams.createIndex({ slug: 1 }, { unique: true })
db.team_members.createIndex({ team_id: 1, user_id: 1 }, { unique: true })
db.pages.createIndex({ team_id: 1, created_at: -1 })

// Phase 3 — Explore
db.pages.createIndex({ featured: 1, created_at: -1 })

// Phase 4 — Billing
db.users.createIndex({ stripe_customer_id: 1 }, { sparse: true })
```

---

### Environment Variables Reference

All env vars across the full roadmap:

```bash
# Existing
MONGODB_URI=mongodb+srv://...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_SITE_URL=https://readable.ashwinsathian.com
NEXT_PUBLIC_GA_ID=G-...

# Phase 0 (none new)

# Phase 2 — Password protection
JWT_SECRET=<32-byte random hex>

# Phase 3 — Slack
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
SLACK_SIGNING_SECRET=...

# Phase 3 — Team invite emails
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@readable.ashwinsathian.com

# Phase 4 — Billing
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PRO_MONTHLY=price_...
STRIPE_PRICE_ID_PRO_ANNUAL=price_...
STRIPE_PRICE_ID_TEAMS=price_...
```

---

### New npm Dependencies Reference

| Package | Phase | Purpose |
|---|---|---|
| `remark-frontmatter` | P2-2 | Parse YAML frontmatter in Markdown |
| `js-yaml` | P2-2 | Parse YAML frontmatter values |
| `remark-math` | P2-3 | Parse `$...$` and `$$...$$` math expressions |
| `katex` | P2-3 | Render LaTeX math to HTML |
| `bcryptjs` | P2-5 | Hash viewer passwords |
| `jose` | P2-5 | Sign/verify password auth JWT cookies |
| `resend` | P3-5 | Send team invite emails |
| `stripe` | P4-1 | Stripe Checkout and webhook handling |
| `commander` | CLI | CLI argument parsing (in `@readable/cli` package) |

---

### Testing Guide

For each phase, the critical test paths:

**Phase 0 — Slug**
- Set a slug → verify share page loads at `/p/new-slug`
- Set a duplicate slug → verify 409 response
- Set an invalid slug (spaces, uppercase) → verify 422 response
- Clear a slug → verify share page falls back to ID-based URL

**Phase 1 — Analytics**
- Load a share page → verify `view` event fires (check `analytics_events` collection)
- Scroll to 50% → verify `read_50` event fires
- Two requests from same "session" → verify only one row inserted (idempotency)

**Phase 1 — Version History**
- Publish a page → verify version 1 exists in `page_versions`
- Update the same page → verify version 2 exists
- Publish 11 times → verify only versions 2–11 exist (oldest pruned)

**Phase 2 — Mermaid**
- Write ` ```mermaid flowchart LR; A-->B ``` ` → verify SVG renders
- Write invalid Mermaid syntax → verify error panel renders without crashing

**Phase 2 — Frontmatter**
- Write YAML frontmatter → verify title, author, tags render on share page
- Write invalid YAML frontmatter → verify page still renders (graceful degradation)

**Phase 2 — Password protection**
- Set a password on a page → verify unauthenticated visitors see the password form
- Enter correct password → verify cookie is set and content is accessible
- Enter wrong password → verify error message and no content shown

**Phase 4 — Billing**
- Test Stripe Checkout with test mode keys
- Simulate `checkout.session.completed` webhook → verify user plan updated in MongoDB
- Simulate `customer.subscription.deleted` → verify user downgraded to free

---

### Recommended Build Sequence

```
Phase 0   Weeks 1–4    Slug UI, attribution badge
Phase 1   Months 1–3   Analytics, version history, collections
Phase 2   Months 3–6   Mermaid (finalise), frontmatter, KaTeX, embeds, password, template SEO
Phase 3   Months 6–12  Explore page, CLI, GitHub action, Slack, VS Code extension
Phase 3+  Month 8      Team Spaces (start parallel to other Phase 3 work)
Phase 4   Months 8–14  Pricing page, Stripe integration, quota enforcement
```

Do not start Phase 4 billing before Phase 1 analytics is shipped. Publishers need to
see the value (their stats) before being asked to pay for it. The conversion sequence is:
Publish → See views → See referrers → See the lock icon on analytics → Upgrade.

---

*Last updated: May 2026. Author: Ashwin Sathian.*
*This document should be updated after each phase ships — mark items complete,
note deviations from the plan, and add new technical findings as they emerge.*
