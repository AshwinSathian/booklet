# Readable — Strategy Execution Plan
## From War Council to Working Software

> **Document type:** Strategic execution plan. This is NOT a technical spec (see
> `IMPLEMENTATION_PLAN.md` for that). This document translates the war council
> output — the founder's post-rejection strategic pivot — into a sequenced,
> dependency-aware build plan tied to the actual current state of the codebase.
>
> **When this was written:** May 2026, following the seed round rejection and
> the internal strategy session that resulted from it.
>
> **Audience:** The engineering team executing the next phase of Readable's
> growth. Assumes familiarity with the existing `IMPLEMENTATION_PLAN.md`
> and `ROADMAP.md`.
>
> **Source of truth for current product state:** `PRODUCT.md`, `ROADMAP.md`,
> and the actual source code. Where this document conflicts with `ROADMAP.md`,
> this document takes precedence — it represents the updated strategic direction.

---

## The Critical Distinction: Old Roadmap vs. New Strategy

The existing `ROADMAP.md` contains a deliberately scoped constraint:

> *Paywall / paid tier — Skip indefinitely. Explicit product constraint — keep
> everything free.*

This document supersedes that constraint. The war council analysis concluded that
a product without a monetization path is not a company, and deferring the question
indefinitely is not a strategic choice — it is the absence of one. Readable has
built real infrastructure. It now needs to build a real business on top of it.

This does NOT mean we add a paywall to existing features or degrade the free
experience. It means we identify what *genuinely premium* looks like — features
that teams will pay for — and build those features while keeping the core product
free and frictionless.

---

## Section 1 — Honest Current State Audit

Before building anything new, the team must share a precise understanding of
what is already built, what is partially built, and what is entirely absent.

### What Is Fully Operational

| Capability | Evidence |
|---|---|
| Auth (Clerk — Google, GitHub, email) | `src/app/sign-in/`, `src/middleware.ts` |
| Permanent pages for signed-in users | `src/app/api/publish/route.ts` |
| Anonymous 30-day pages via KV | Existing publish flow |
| Custom slugs (UI + API) | `src/app/api/pages/check-slug/route.ts`, `IMPLEMENTATION_PLAN.md P0-1` |
| REST API v1 (publish, update, list) | `src/app/api/v1/` |
| API key management | `src/app/api/v1/keys/`, `src/app/my-pages/ApiKeysClient.tsx` |
| My Pages dashboard | `src/app/my-pages/MyPagesClient.tsx` |
| Analytics events + per-page dashboard | `src/app/api/analytics/view/route.ts`, `src/app/my-pages/analytics/[id]/` |
| Version history (10 versions, snapshot + restore) | `src/app/api/pages/[id]/versions/`, `src/app/my-pages/versions/` |
| Collections (drag-and-drop organisation) | `src/app/api/collections/` |
| Template picker (8 templates) | `src/components/app/TemplatesDialog.tsx` |
| Mermaid diagram rendering | `src/components/blocks/DiagramBlock.tsx` |
| Export (MD, HTML, Print/PDF) | `src/components/share/ExportMenu.tsx` |
| Reading time on share pages | `src/lib/reading-time.ts` |
| OG images with page title | `src/app/opengraph-image/route.ts` |
| GitHub Actions workflow (recipe) | `PRODUCT.md`, `ROADMAP.md M6.3` |
| API docs page | `src/app/api-docs/page.tsx` |
| Security headers (Milestone 1 complete) | `src/middleware.ts` |
| Rate limiting on v1 API | `ROADMAP.md M1.2 — [x]` |

### What Is Absent or Incomplete

This is the build list. Everything in this document traces back to items in
this table.

| Capability | Gap | Strategic Impact |
|---|---|---|
| Monetization layer (Stripe) | Zero revenue infrastructure | Critical — we are not a company yet |
| Team Spaces | No shared workspace concept | B2B wedge — highest revenue potential |
| Pricing page | No conversion surface | Blocks revenue entirely |
| Quota enforcement by plan | All features free-for-all | Required before charging |
| "Make your own" conversion metrics | CTA exists but untracked | Blocks funnel understanding |
| Template SEO landing pages | Templates exist, no `/templates/` routes | Low-cost organic acquisition |
| Public explore page | No discovery surface | Growth + social proof |
| CLI (`@readable/cli`) | No npm package | Developer embedding + stickiness |
| First-party GitHub Action | Only a recipe doc, no actual action | Distribution + switching cost |
| VS Code extension | Not started | Developer workflow integration |
| Password-protected pages | Deliberately omitted per old roadmap | Unblocks confidential content use case |
| Webhook on publish (for teams) | Not built | Team workflow embedding |
| Custom domains (Pro/Teams) | Not built | Premium differentiator |
| Syntax highlighting in code blocks | `ROADMAP.md M3.4 — [x]` but verify | Core content quality |
| Frontmatter support | Not built | Compatibility with existing Markdown workflows |
| KaTeX math rendering | Not built | Research / academic audience |
| Embed codes | Not built | Notion/Confluence integration surface |

---

## Section 2 — Strategic Framework

Before the task list, the framework that governs every decision about what
to build and in what order.

### The Three Questions for Every Feature

1. **Does it increase the number of people who publish?**
   If yes, it is top-of-funnel. Prioritise.

2. **Does it increase the number of people who come back to publish again?**
   If yes, it is retention. Prioritise.

3. **Does it give teams a reason to pay?**
   If yes, it is monetization. Required for Phase 3+.

Features that answer none of these three questions are backlog until the
business is sustainable.

### The Flywheel Model

```
Write → Publish → Share link
            ↓
       Reader sees Readable page
            ↓
       "Make your own" CTA → New publisher
            ↓
       Publisher signs in (for permanent pages)
            ↓
       Publisher sees analytics → Sees lock icon → Upgrades
            ↓
       Team member joins → Team Space → Paying account
```

Every phase of the build plan must either power a stage of this flywheel
or support it. Features that don't connect to the flywheel wait.

### The Revenue Logic

We are building three monetization surfaces, in order:

**Surface 1 — Readable Pro ($7/month or $60/year)**
Individual power users who have hit the free tier limits or want premium
features (custom domains, remove badge, password protection, advanced
analytics). This is the conversion from the "analytics lock icon" moment.

**Surface 2 — Readable Teams ($12/user/month)**
The B2B surface. A shared workspace, team analytics, API key pooling,
webhooks, subdomain. This is where the real ARR lives.

**Surface 3 — Enterprise (custom)**
Custom domain per team, SSO, SLA. Not this year — build the foundation for it.

---

## Section 3 — The Build Plan

Organised into four phases. Each phase has a defined entry condition
(what must be true before we start) and an exit condition (what must be
true before we move to the next).

Phase 0 takes precedence over everything. Do not start Phase 1 until
Phase 0 is complete.

---

## Phase 0 — Measurement Before Everything
### Timeline: 2 weeks
### Entry condition: None
### Exit condition: We can answer the five questions below from first-party data

**The five questions we must be able to answer:**

1. How many unique pages are published per week?
2. Of those publishers, what percentage publishes more than once in a 30-day window?
3. Of all share page visitors, what percentage clicks "Make your own"?
4. Of pages that expire, what percentage is owned by a signed-in user?
5. What is the referrer breakdown for share page traffic (Slack / GitHub / direct / other)?

We currently cannot answer any of these from the existing analytics setup.
GA4 gives us page views. The `analytics_events` collection gives us per-page
read depth. Neither gives us the funnel-level numbers above.

---

### P0-1 — Publisher funnel tracking
**Files:** `src/app/api/publish/route.ts`, `src/app/api/v1/publish/route.ts`,
`src/lib/db/analytics.ts`

**What to build:** On every successful publish, write a `publish_event` record
to a new `publish_events` D1 table (not MongoDB — keep this on D1 for fast
edge queries):

```sql
-- migrations/0005_publish_events.sql
CREATE TABLE IF NOT EXISTS publish_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,                    -- NULL for anonymous
  page_id TEXT NOT NULL,
  is_update INTEGER NOT NULL DEFAULT 0,   -- 1 if re-publish of existing page
  content_length_bucket TEXT NOT NULL,   -- 'xs'|'sm'|'md'|'lg'|'xl'
  source TEXT NOT NULL DEFAULT 'browser', -- 'browser'|'api'|'cli'
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS publish_events_user_week
  ON publish_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS publish_events_created
  ON publish_events(created_at);
```

**Content length buckets:**
- `xs`: < 500 chars
- `sm`: 500–2,000 chars
- `md`: 2,000–10,000 chars
- `lg`: 10,000–50,000 chars
- `xl`: > 50,000 chars

**No PII stored.** `user_id` is the Clerk internal ID (opaque string).
Anonymous publishes store `user_id = NULL`.

**Caller logic** (add to both publish routes after successful KV/D1 write):
```typescript
void db.prepare(
  `INSERT INTO publish_events (id, user_id, page_id, is_update, content_length_bucket, source, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
).bind(
  crypto.randomUUID(),
  userId ?? null,
  pageId,
  isUpdate ? 1 : 0,
  bucketContentLength(rawLength),
  source, // 'browser' | 'api'
  new Date().toISOString()
).run().catch(() => {}); // fire-and-forget; never block the response
```

**Acceptance criteria:**
- Every browser publish creates a row in `publish_events`
- Every v1 API publish creates a row with `source = 'api'`
- Re-publishes to existing page IDs set `is_update = 1`
- Anonymous publishes have `user_id = NULL`

---

### P0-2 — "Make your own" click tracking on share pages
**Files:** `src/app/p/[id]/page.tsx`, `src/components/share/AnalyticsBeacon.tsx`,
`src/app/api/analytics/view/route.ts`

The CTA "Make your own →" in the share page header is the top of the acquisition
funnel. We need its click-through rate.

**What to build:** Extend `AnalyticsBeacon` to also emit a `cta_click` event when
the "Make your own" button is clicked. The event type already exists in spirit
(the `analytics_events` collection) — add `cta_click` as a valid event value.

```typescript
// In src/app/p/[id]/page.tsx — add data attribute to the CTA button:
<a
  href="/app"
  data-readable-cta="make-your-own"
  ...
>
  Make your own →
</a>
```

```typescript
// In AnalyticsBeacon.tsx — add click listener:
useEffect(() => {
  const handleCta = () => {
    void navigator.sendBeacon(
      "/api/analytics/view",
      JSON.stringify({ pageId, event: "cta_click" }),
    );
  };
  document.querySelectorAll("[data-readable-cta='make-your-own']")
    .forEach(el => el.addEventListener("click", handleCta));
  return () => {
    document.querySelectorAll("[data-readable-cta='make-your-own']")
      .forEach(el => el.removeEventListener("click", handleCta));
  };
}, [pageId]);
```

Update the `event` union type in `src/lib/db/types.ts`:
```typescript
event: "view" | "read_50" | "read_100" | "cta_click";
```

**Acceptance criteria:**
- Click on "Make your own" fires a `cta_click` event to the analytics endpoint
- The event appears in the analytics dashboard for that page
- The CTA click rate (cta_click / view) is queryable via the analytics helpers

---

### P0-3 — Internal metrics dashboard
**Files:** New `src/app/admin/page.tsx`, `src/lib/db/admin-metrics.ts`

A private `/admin` route, IP-restricted to `127.0.0.1` and the founder's IP
via middleware, that answers the five questions in a single glanceable view.

**Middleware guard:**
```typescript
// src/middleware.ts — add before clerk middleware:
if (req.nextUrl.pathname.startsWith("/admin")) {
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for");
  const ALLOWED = (process.env.ADMIN_IPS ?? "").split(",");
  if (!ALLOWED.includes(ip ?? "")) {
    return new Response("Forbidden", { status: 403 });
  }
}
```

Add `ADMIN_IPS=<your-ip>` to `.env.local` and Cloudflare Workers secrets.

**Metrics to show (all computed server-side from D1 + analytics_events):**

| Metric | Query source |
|---|---|
| Weekly new pages published | `publish_events` WHERE `created_at > 7 days ago` AND `is_update = 0` |
| Re-publish rate (7d) | `publish_events` — users with ≥2 rows in last 30 days / total users with ≥1 row |
| Anonymous vs. signed-in publish split | `publish_events` — NULL user_id vs. non-null |
| API publish share | `publish_events` WHERE `source = 'api'` |
| Share page views (7d) | `analytics_events` WHERE `event = 'view'` |
| CTA click rate | `cta_click` / `view` from `analytics_events` (last 7d) |
| Top referrers | `analytics_events` GROUP BY `referrer_bucket` (last 7d) |
| Read completion rate | `read_100` events / `view` events (last 7d) |

**UI:** A plain server-rendered table. No charts. No JavaScript. Load in under
200ms. This is an internal tool, not a product surface.

**Acceptance criteria:**
- `/admin` returns 403 for all IPs not in `ADMIN_IPS`
- The dashboard loads and shows real numbers from the database
- The five Phase 0 questions are answered on a single screen

---

### Phase 0 — Exit Checklist

Before proceeding to Phase 1, the following must all be true:

- [ ] `publish_events` table is populated with at least 7 days of data
- [ ] `cta_click` events are being tracked on share pages
- [ ] The `/admin` dashboard loads and shows all seven metrics
- [ ] The team has reviewed the numbers and formed a hypothesis about
      which user cohort is most likely to convert to a paid plan

---

## Phase 1 — Monetization Foundation
### Timeline: 6 weeks
### Entry condition: Phase 0 exit checklist complete
### Exit condition: First paying customer exists. Even one.

This is the phase the old `ROADMAP.md` deliberately avoided. We are not
avoiding it anymore. The goal is to build the minimal monetization
infrastructure and capture the first revenue signal.

We are NOT building a complex pricing system. We are building the smallest
possible path from "free user" to "paying user" and learning from it.

---

### P1-1 — Pricing tier definition and quota system
**Files:** New `src/lib/quota.ts`, `src/lib/db/types.ts`

Before billing, we need the system to know what each tier gets.

```typescript
// src/lib/quota.ts

export type Plan = "anonymous" | "free" | "pro" | "teams";

export type PlanLimits = {
  pagesPerMonth: number;      // -1 = unlimited
  permanentPages: boolean;
  customSlugs: boolean;
  analytics: boolean;
  versionHistory: boolean;
  passwordProtection: boolean;
  removeAttributionBadge: boolean;
  apiAccess: boolean;
  apiKeysMax: number;
  teamsAccess: boolean;
  webhooks: boolean;
};

const LIMITS: Record<Plan, PlanLimits> = {
  anonymous: {
    pagesPerMonth: 10,
    permanentPages: false,
    customSlugs: false,
    analytics: false,
    versionHistory: false,
    passwordProtection: false,
    removeAttributionBadge: false,
    apiAccess: false,
    apiKeysMax: 0,
    teamsAccess: false,
    webhooks: false,
  },
  free: {
    pagesPerMonth: 30,
    permanentPages: true,      // The hook: sign in, your pages last forever
    customSlugs: true,
    analytics: true,
    versionHistory: false,    // Version history is a Pro feature
    passwordProtection: false,
    removeAttributionBadge: false,
    apiAccess: true,
    apiKeysMax: 2,
    teamsAccess: false,
    webhooks: false,
  },
  pro: {
    pagesPerMonth: -1,
    permanentPages: true,
    customSlugs: true,
    analytics: true,
    versionHistory: true,
    passwordProtection: true,
    removeAttributionBadge: true,
    apiAccess: true,
    apiKeysMax: 10,
    teamsAccess: false,
    webhooks: false,
  },
  teams: {
    pagesPerMonth: -1,
    permanentPages: true,
    customSlugs: true,
    analytics: true,
    versionHistory: true,
    passwordProtection: true,
    removeAttributionBadge: true,
    apiAccess: true,
    apiKeysMax: -1,
    teamsAccess: true,
    webhooks: true,
  },
};

export function getLimits(plan: Plan): PlanLimits {
  return LIMITS[plan];
}

export function canUseFeature(plan: Plan, feature: keyof PlanLimits): boolean {
  const limits = getLimits(plan);
  const value = limits[feature];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return false;
}
```

**Update `DbUser` type** (`src/lib/db/types.ts`) to add:
```typescript
plan: "free" | "pro" | "teams";              // default "free"
stripe_customer_id: string | null;
stripe_subscription_id: string | null;
plan_expires_at: string | null;
```

**D1 migration:**
```sql
-- migrations/0006_add_plan_to_users.sql
ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN plan_expires_at TEXT;
```

Note: This contradicts `ROADMAP.md M1.4` which removed `is_pro` and
`stripe_customer_id` as "dead columns." They are now live columns.
The migration adds them back with correct semantics.

**Acceptance criteria:**
- `getLimits("free")` returns the correct limits object
- `getLimits("pro")` returns the correct limits object
- All users in D1 have `plan = 'free'` by default after migration

---

### P1-2 — Stripe integration
**Files:** New `src/app/api/billing/checkout/route.ts`,
`src/app/api/billing/webhook/route.ts`, `src/app/api/billing/portal/route.ts`

```bash
npm install stripe
```

**Required env vars** (add to `.env.local` and Cloudflare Workers secrets):
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PRO_MONTHLY=price_...
STRIPE_PRICE_ID_PRO_ANNUAL=price_...
STRIPE_PRICE_ID_TEAMS=price_...
```

**Pricing to set up in Stripe dashboard:**

| Product | Price | Stripe mode |
|---|---|---|
| Readable Pro | $7/month | Subscription |
| Readable Pro | $60/year | Subscription |
| Readable Teams | $12/user/month | Subscription (metered or fixed per seat) |

**P1-2a — Checkout endpoint:**
```typescript
// src/app/api/billing/checkout/route.ts
// POST — body: { priceId: string }
// Requires Clerk auth (session cookie)
// Returns: { checkoutUrl: string }

import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { priceId } = await req.json() as { priceId: string };
  const returnUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/my-pages`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${returnUrl}?checkout=success`,
    cancel_url: `${returnUrl}?checkout=cancelled`,
    metadata: { userId },
    // Collect email for receipt; Clerk already has it
    allow_promotion_codes: true,
  });

  return Response.json({ checkoutUrl: session.url });
}
```

**P1-2b — Webhook handler:**
```typescript
// src/app/api/billing/webhook/route.ts
// POST — Stripe sends events here; signature verified
// No auth — Stripe signs requests

export const runtime = "nodejs"; // webhooks need raw body access

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature") ?? "";
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const db = getD1(); // your D1 client

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (!userId) break;
      await db.prepare(
        `UPDATE users SET plan = 'pro', stripe_customer_id = ?, stripe_subscription_id = ?
         WHERE clerk_id = ?`
      ).bind(session.customer, session.subscription, userId).run();
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      // Sync plan status — covers cancellation at period end
      const planActive = sub.status === "active" || sub.status === "trialing";
      if (!planActive) {
        await db.prepare(
          `UPDATE users SET plan = 'free' WHERE stripe_subscription_id = ?`
        ).bind(sub.id).run();
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await db.prepare(
        `UPDATE users SET plan = 'free', stripe_subscription_id = NULL
         WHERE stripe_subscription_id = ?`
      ).bind(sub.id).run();
      break;
    }
  }

  return new Response(null, { status: 200 });
}
```

**P1-2c — Customer portal endpoint** (for managing subscriptions):
```typescript
// src/app/api/billing/portal/route.ts
// POST — returns URL for Stripe Customer Portal
// Requires auth

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserByClerkId(userId);
  if (!user?.stripe_customer_id) {
    return Response.json({ error: "No billing account" }, { status: 404 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/my-pages`,
  });

  return Response.json({ url: session.url });
}
```

**Acceptance criteria:**
- A test checkout completes and sets `plan = 'pro'` in D1 for the test user
- Cancellation via the portal sets `plan = 'free'`
- The webhook endpoint returns 200 for valid Stripe signatures and 400 for invalid

---

### P1-3 — Pricing page
**File:** New `src/app/pricing/page.tsx`

The conversion surface. Three columns: Free, Pro, Teams. Clean, minimal.

**Layout (conceptual):**
```
Readable — Pricing

Free                  Pro ($7/mo)           Teams ($12/user/mo)
─────────────────     ─────────────────     ─────────────────
Unlimited drafts ✓    Everything in Free    Everything in Pro
30 pages/month        Unlimited pages       Shared workspace
Permanent pages ✓     Version history       Team analytics
Custom slugs ✓        Password protection   Webhooks
Basic analytics       No attribution badge  Custom subdomain
2 API keys            10 API keys           Unlimited API keys
                                            Up to 20 members

[Get started]         [Upgrade to Pro]      [Start team trial]
```

**Technical notes:**
- The "Get started" CTA links to `/app` (no account required to start)
- The "Upgrade to Pro" CTA calls `POST /api/billing/checkout` with the monthly price ID,
  then redirects to `checkoutUrl`
- If user is not signed in, "Upgrade to Pro" redirects to sign-in first (middleware
  handles this automatically via Clerk)
- Add pricing page to landing page nav and footer
- Add to `src/app/sitemap.ts`

**Acceptance criteria:**
- Pricing page renders on `/pricing`
- Clicking "Upgrade to Pro" while signed out redirects to sign-in then returns to pricing
- Clicking "Upgrade to Pro" while signed in opens Stripe Checkout
- The page is linked from the landing page footer

---

### P1-4 — Upgrade prompts (the "lock icon" pattern)
**Files:** `src/app/my-pages/MyPagesClient.tsx`,
`src/app/my-pages/analytics/[id]/page.tsx`, `src/components/app/TopBar.tsx`

The conversion moment is when a free user encounters a feature they cannot use.
Every gated feature shows a lock icon that opens the pricing page or a brief
upgrade modal. The lock pattern must be consistent everywhere.

**New component:** `src/components/ui/UpgradeGate.tsx`

```typescript
// src/components/ui/UpgradeGate.tsx
type UpgradeGateProps = {
  feature: string;        // e.g. "Version history"
  plan: "pro" | "teams";  // minimum plan required
  children: React.ReactNode; // the locked feature UI (shown greyed out)
};

// Renders children with a grey overlay and a lock chip:
// "Version history  🔒  Available on Pro  [Upgrade]"
// Clicking [Upgrade] navigates to /pricing
```

**Implement gates on:**
1. Version history link in My Pages row (`plan !== "pro"` → show lock)
2. "Password protect" option in My Pages / TopBar (`plan !== "pro"`)
3. "Remove attribution badge" option in page settings (`plan !== "pro"`)
4. Additional API keys beyond 2 (`plan !== "pro"`)
5. Team workspace creation (`plan !== "teams"`)

**Acceptance criteria:**
- A free user sees upgrade prompts on all five gated surfaces above
- Clicking any upgrade prompt lands on the pricing page
- A Pro user sees no upgrade prompts on Pro features, only Team features
- A Teams user sees no upgrade prompts on any feature

---

### P1-5 — Attribution badge (the "Powered by Readable" chip)
**File:** `src/app/p/[id]/page.tsx`

Every share page for a free or anonymous user shows a small, tasteful chip
in the bottom-right corner: `Published with Readable`. This is both brand
awareness and acquisition. Pro users can disable it.

```tsx
// Add to src/app/p/[id]/page.tsx
{!pageRecord.owner_removes_badge && (
  <a
    href={process.env.NEXT_PUBLIC_SITE_URL}
    target="_blank"
    rel="noopener noreferrer"
    className={[
      "fixed bottom-5 right-5 z-30",
      "hidden sm:inline-flex items-center gap-2",
      "rounded-full border border-border-subtle",
      "bg-bg/70 backdrop-blur-md",
      "px-3 py-1.5",
      "text-xs text-text-muted",
      "transition-all hover:border-accent-soft/30 hover:text-text-primary",
      "print:hidden",
    ].join(" ")}
  >
    <AppLogo onlyIcon size={14} />
    Made with Readable
  </a>
)}
```

**Schema change:** Add `remove_attribution_badge: boolean` (default `false`) to
`DbPage`. When a Pro+ user publishes, check their plan and set this flag.

**D1 migration:**
```sql
-- migrations/0007_attribution_badge.sql
ALTER TABLE pages ADD COLUMN remove_attribution_badge INTEGER NOT NULL DEFAULT 0;
```

**Logic in publish route:** After determining the user's plan:
```typescript
const userPlan = await getUserPlan(userId);
const removeBadge = canUseFeature(userPlan, "removeAttributionBadge");
// Pass removeBadge to createPageRecord / updatePageRecord
```

**Acceptance criteria:**
- Anonymous and free users' share pages show the "Made with Readable" chip
- Pro users' share pages do NOT show the chip
- The chip links to the Readable homepage
- The chip is hidden on print (`print:hidden`)

---

### Phase 1 — Exit Checklist

- [ ] Stripe is integrated and processes test payments correctly
- [ ] At least one user (the founder counts) has upgraded to Pro via the pricing page
- [ ] The plan field in D1 correctly reflects user tier
- [ ] All gated features show upgrade prompts to free users
- [ ] The attribution badge appears on free/anonymous share pages
- [ ] `/pricing` is live and linked from the footer

---

## Phase 2 — Distribution Engine
### Timeline: 8 weeks
### Entry condition: Phase 1 exit checklist complete; at least 1 paying user
### Exit condition: API keys issued to non-founder users; CLI installable from npm

The goal of this phase is to build the surfaces that embed Readable into
developer workflows — making it something teams use automatically rather
than manually.

---

### P2-1 — Password-protected pages (Pro feature)
**Files:** `src/app/p/[id]/page.tsx`, `src/app/p/[id]/password/page.tsx` (new),
`src/app/api/pages/[id]/route.ts`, `src/lib/db/types.ts`

Full spec already exists in `IMPLEMENTATION_PLAN.md P2-5`. Implement exactly
as documented there. This is a Pro-only feature — gate at publish time and
in the My Pages settings. If the user tries to set a password and is not Pro,
show the `UpgradeGate` component.

**Key implementation note:** Use `bcryptjs` for hashing and `jose` for JWT
cookie signing. Both are already specified in the existing implementation plan.
Do not use a different approach.

---

### P2-2 — Frontmatter support
**Files:** `src/lib/parse.ts`, `src/lib/blocks.ts`, `src/app/api/publish/route.ts`,
`src/app/p/[id]/page.tsx`

Full spec in `IMPLEMENTATION_PLAN.md P2-2`. Implement as documented.
This is a free feature — frontmatter benefits all users.

Key decision that is NOT in the existing spec: **frontmatter `visibility` field
is respected only for signed-in users.** An anonymous user who writes
`visibility: unlisted` in frontmatter gets the unlisted behavior only if they
publish while signed in. If anonymous, it is ignored and defaults to public.

---

### P2-3 — Template SEO landing pages
**Files:** New `src/app/templates/page.tsx`, `src/app/templates/[slug]/page.tsx`,
`src/lib/templates.ts` (update), `src/app/sitemap.ts`

Full spec in `IMPLEMENTATION_PLAN.md P2-6`. This is a zero-cost organic
acquisition channel. The template pages use `BlockRenderer` server-side,
so they exemplify the product in the act of describing it.

**Priority templates for SEO (by search volume estimate):**

| Slug | Target query | Priority |
|---|---|---|
| `incident-report` | "incident report template" | High |
| `adr` | "architecture decision record template" | High |
| `runbook` | "runbook template" | High |
| `release-notes` | "release notes template markdown" | Medium |
| `postmortem` | "postmortem template" | Medium |
| `readme` | "readme template" | Medium |
| `meeting-notes` | "meeting notes template" | Low |
| `weekly-update` | "weekly update template" | Low |

Ship in priority order. Each template page needs 400–600 words of genuinely
useful copy about the use case — not marketing fluff, not SEO spam. The content
must be worth reading on its own.

---

### P2-4 — Public explore page
**Files:** New `src/app/explore/page.tsx`, `src/app/api/explore/route.ts`,
`src/lib/db/types.ts`, `src/app/my-pages/MyPagesClient.tsx`

Full spec in `IMPLEMENTATION_PLAN.md P3-1`. Key decisions:

1. **Opt-in only.** Pages are not featured without the owner's explicit action.
   No page ever appears on the explore page without a deliberate toggle in My Pages.

2. **Curation over completeness.** The explore page should feel like a gallery,
   not a firehose. Cap at 50 featured pages. Quality beats quantity.

3. **The explore page itself is a Readable page.** The "Welcome to Explore"
   section uses `BlockRenderer` to render a short Markdown introduction.
   Dogfooding is required.

---

### P2-5 — CLI (`@readable/cli`)
**Files:** New `packages/cli/` directory (separate package within the repo)

This is the highest-leverage distribution tool we can build. Once a developer
has `readable` in their PATH, Readable is embedded in their workflow.

Full spec in `IMPLEMENTATION_PLAN.md P3-2`. Key additions to the existing spec:

**P2-5a — `readable auth` setup experience:**
```
$ readable auth
? Paste your API key: rdbl_...
? Base URL [https://readable.ashwinsathian.com]:
✓ Authentication saved. Welcome to Readable.
```

The API key is stored in `~/.readable/config.json`. The base URL is configurable
for future enterprise deployments.

**P2-5b — Source identifier:**
The CLI must pass `source: 'cli'` in the publish payload so `publish_events`
can track CLI-originated publishes separately from browser and API publishes.
Update `publish_events.source` enum to include `'cli'`.

**P2-5c — `--watch` mode for incident response:**
This is the highest-value CLI mode for the target use case.
```
$ readable publish incident.md --watch
✓ Published: https://readable.ashwinsathian.com/p/q2-incident
Watching for changes... (Ctrl+C to stop)
[14:32:01] Updated: https://readable.ashwinsathian.com/p/q2-incident
[14:35:44] Updated: https://readable.ashwinsathian.com/p/q2-incident
```

The link never changes. The content updates silently. The team looking at the
link always sees the latest status. This is the incident war-room use case.

**Acceptance criteria:**
- `npm install -g @readable/cli` works (package published to npm)
- `readable publish README.md` returns a URL
- `readable publish -` accepts stdin
- `readable pages list` returns a formatted table
- `readable publish README.md --watch` republishes on file save

---

### Phase 2 — Exit Checklist

- [ ] CLI is published to npm and installable
- [ ] Template SEO pages exist for all 8 priority slugs and are indexed
- [ ] Explore page is live with at least 5 opt-in featured pages
- [ ] Password protection is live and gated behind Pro
- [ ] `publish_events.source` distinguishes browser / api / cli publishes
- [ ] The `/admin` dashboard shows CLI publish share

---

## Phase 3 — The B2B Layer
### Timeline: 10 weeks
### Entry condition: Phase 2 complete; MRR > $0 from at least 3 paying Pro users
### Exit condition: First paying Team exists

Team Spaces is where the sustainable revenue lives. Individual Pro subscriptions
are table stakes. A team subscription at $12/user/month with 5 users is $720/year
— 8x the annual value of a single Pro user.

This phase is the hardest engineering work on the roadmap. Do not start it
until Phase 1 and Phase 2 are complete and the business has demonstrated
that individuals will pay.

---

### P3-1 — Team schema and routes
**Files:** New `src/lib/db/teams.ts`, `src/app/api/teams/`,
`src/app/t/[slug]/page.tsx` (new)

Full schema in `IMPLEMENTATION_PLAN.md P3-5 Step 1`.

D1 migrations required:
```sql
-- migrations/0008_teams.sql
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
  user_id TEXT,                    -- NULL until invite is accepted
  role TEXT NOT NULL DEFAULT 'editor',
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

---

### P3-2 — Team invite flow (email via Resend)
**Files:** New `src/app/api/teams/[id]/invite/route.ts`,
`src/lib/email.ts` (new), `src/lib/invite-token.ts` (new)

```bash
npm install resend
```

Add `RESEND_API_KEY` and `FROM_EMAIL` to env vars and Cloudflare secrets.

The invite flow:
1. Team owner sends invite to email address
2. Server generates a signed JWT invite token (expires in 72 hours)
3. Resend sends an email: "You've been invited to [Team Name] on Readable"
4. Recipient clicks the link: `/t/join?token=...`
5. If not signed in: redirect to sign-in, then back to the join URL
6. Server validates the JWT, creates a `team_members` row with `joined_at = now()`
7. Redirect to `/t/[team-slug]`

**Email template (plain text — no HTML email libraries):**
```
You've been invited to join [Team Name] on Readable.

Click here to accept: [join-link]

This invite expires in 72 hours. If you didn't expect this, ignore it.

— The Readable team
```

---

### P3-3 — Team publishing from the editor
**Files:** `src/app/app/AppClient.tsx`, `src/components/app/TopBar.tsx`

When a signed-in user is a member of one or more teams, the Publish button
gains a disclosure arrow: `Publish ▾`. Clicking the arrow reveals:

```
Publish to:
  ○ My pages
  ○ [Team Name 1]
  ○ [Team Name 2]
```

Selecting a team publishes with `team_id` set. The page appears in the team's
shared page list at `/t/[team-slug]`.

**Acceptance criteria:**
- Team members see the team selection on publish
- Pages published to a team appear in the team's dashboard
- Pages published to a team still appear in the owner's My Pages (with a "team" label)

---

### P3-4 — Webhooks (Teams feature)
**Files:** New `src/app/api/teams/[id]/webhooks/route.ts`,
`src/lib/webhooks.ts` (new)

Teams can configure one or more webhook URLs. On every page publish or update
within the team, Readable fires a POST to the configured URLs:

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

The webhook payload is signed with an HMAC-SHA256 secret (stored per webhook
config, generated by Readable and shown once to the user). Consumers verify
the signature via the `X-Readable-Signature` header.

**Slack integration via webhook:**
Document a ready-to-paste Slack incoming webhook configuration that
posts a Slack message on every Readable page publish. This is a zero-code
Slack integration for teams using Slack's incoming webhooks feature —
no Slack App required.

---

### Phase 3 — Exit Checklist

- [ ] At least one team has been created and has ≥2 members
- [ ] Team pages are publishing correctly and visible to all team members
- [ ] Team invite email is sending via Resend
- [ ] Webhook fires correctly on publish and the signature is valid
- [ ] The first paying team is on the Teams plan

---

## Phase 4 — Prove the Category
### Timeline: Ongoing after Phase 3
### Entry condition: First paying team; MRR > $100
### Exit condition: This phase has no exit — it is the steady state

The goal of Phase 4 is not to ship features. It is to make Readable
the recognized name for what it does: sharing written technical communication
as a link.

---

### P4-1 — First-party GitHub Action
**Repository:** New `readable-hq/publish-action` GitHub repository

The GitHub Actions recipe in `PRODUCT.md` is a bash script. A real GitHub Action
is published to the GitHub Marketplace and is a one-line install.

```yaml
- uses: readable-hq/publish-action@v1
  id: publish
  with:
    file: CHANGELOG.md
    api-key: ${{ secrets.READABLE_API_KEY }}
    page-id: ${{ vars.CHANGELOG_PAGE_ID }}  # optional: update in-place
```

Outputs: `url`, `id`

This is an independent repository and a separate npm package. The implementation
is ~150 lines of TypeScript. Ship it.

---

### P4-2 — KaTeX math rendering (free feature)
Full spec in `IMPLEMENTATION_PLAN.md P2-3`. Expands audience to data scientists
and researchers. Free feature — no gate.

---

### P4-3 — Embed codes (free feature)
Full spec in `IMPLEMENTATION_PLAN.md P2-4`. Makes Readable pages embeddable
in Notion, Confluence, or any HTML surface. The embed route strips all
navigation chrome and serves only the content.

---

### P4-4 — VS Code extension
**Repository:** New `readable-hq/vscode-readable` GitHub repository

Full spec in `IMPLEMENTATION_PLAN.md P3-6`. Published to the VS Code Marketplace.
Depends on the v1 API (done) and the CLI auth pattern (done in Phase 2).

---

### P4-5 — Content flywheel
**Files:** Blog posts (external), template SEO pages (Phase 2, extended here)

Every major use case gets a piece of content:
- "How to write a P1 incident postmortem" (links to `/templates/incident-report`)
- "The ADR format that actually gets read" (links to `/templates/adr`)
- "Why your runbooks don't work" (links to `/templates/runbook`)
- "Publish your CHANGELOG as a readable page in 60 seconds" (links to `/api-docs`)

Each piece of content is itself a Readable page. Published via the API.
Linked from the blog. This is Readable eating its own cooking at scale.

---

## Section 4 — Metrics Reference

These are the numbers that tell us if the strategy is working. Review
weekly from the `/admin` dashboard.

| Metric | Current (unknown) | Target Month 3 | Target Month 6 | Target Month 12 |
|---|---|---|---|---|
| Weekly new pages (unique) | ? | 200 | 500 | 2,000 |
| Re-publish rate (30d window) | ? | 15% | 25% | 35% |
| "Make your own" CTR | ? | 3% | 5% | 7% |
| API key activations (total) | ? | 20 | 100 | 500 |
| CLI installs (npm downloads) | n/a | n/a | 50 | 500 |
| MRR | $0 | $0 | $100 | $1,000 |
| Paying users (Pro) | 0 | 0 | 5 | 50 |
| Paying teams | 0 | 0 | 0 | 3 |
| Template page organic sessions | ? | 500 | 2,000 | 10,000 |

The Month 3 targets are conservative because Phase 0 will have completed
only recently. The Month 6 targets assume Phase 1 (monetization) is live.
The Month 12 targets are the seed-round targets — what makes Readable
fundable.

---

## Section 5 — Anti-Goals

These are things we will not build, regardless of how reasonable they sound.

**No real-time collaboration.** That is Notion, Linear, or Google Docs.
We are a publishing surface, not a co-editing surface. One writer,
one publish action, one link. This is the constraint that keeps the product
coherent.

**No rich text / WYSIWYG.** Markdown-only is a product decision, not a
limitation. Removing it would require replacing the entire editor surface
and would undermine the identity of Readable as a tool for people who
already know Markdown.

**No comments or reactions on pages.** The reader experience is read-only.
Adding social features changes the product category and requires moderation
infrastructure.

**No version control within the editor.** Git is version control. Readable
has version snapshots for published pages — that is sufficient. A branching
model in the editor is out of scope.

**No mobile app.** The web editor is the app. A mobile app is a separate
product and a separate team. We do not have either.

**No custom Markdown extensions or plugin system.** We support CommonMark
plus GFM. That covers 99% of technical writing. A plugin API would require
maintaining a compatibility layer forever.

---

## Section 6 — Sequential Dependencies

Some phases cannot start until others complete. This is the dependency
graph.

```
Phase 0 (Measurement)
  └── Required before: All other phases
      Reason: We cannot make strategic decisions without data

Phase 1 (Monetization foundation)
  └── Required before: Phase 3
      Reason: Teams plan requires billing infrastructure

Phase 2 (Distribution)
  └── Required before: Phase 4 GitHub Action
      Reason: CLI establishes the auth pattern the GitHub Action uses
  └── Parallel with: Phase 1 (can build P2-2 frontmatter, P2-3 templates
      while P1 billing is in progress)

Phase 3 (B2B)
  └── Requires: Phase 1 complete (billing), Phase 0 data showing
      cohort worth targeting
  └── Required before: Phase 4 enterprise features

Phase 4 (Category)
  └── No hard dependencies. Build incrementally alongside Phase 3.
      P4-2 (KaTeX) and P4-3 (embeds) can ship any time after Phase 1.
```

**Items that can be built in parallel with any phase:**

- P2-2 Frontmatter support (no dependencies, no revenue gating)
- P4-2 KaTeX math (no dependencies, no revenue gating)
- P4-3 Embed codes (no dependencies, no revenue gating)
- Template SEO content (ongoing — ship one template page per week)

---

## Section 7 — Decision Log

Decisions made in this plan that deviate from prior documents, and why.

| Decision | Prior state | New state | Reason |
|---|---|---|---|
| Monetization | ROADMAP: "Skip indefinitely" | Phase 1: Required | No revenue path = no company |
| Attribution badge | Not planned | P1-5: Free/anon pages show badge; Pro removes it | Growth mechanism + Pro conversion incentive |
| Version history gating | IMPLEMENTATION_PLAN: Available to all signed-in users | Now Pro-only | Creates a genuine Pro conversion hook |
| Teams plan | IMPLEMENTATION_PLAN: Phase 3 (distant future) | Phase 3 in this plan (months 6–14) | Core revenue vehicle — cannot defer indefinitely |
| `stripe_customer_id` column | ROADMAP M1.4: Deleted as dead column | P1-1: Re-added with correct semantics | Was premature to remove — now the intent is real |
| Password protection | ROADMAP: "Feature backlog — no current plan" | P2-1: Pro feature in Phase 2 | Unlocks confidential content use case; revenue gated |

---

*Authored: May 2026. Author: Ashwin Sathian.*
*Next review: When Phase 0 exit checklist is complete — update metrics
baselines and verify sequencing before starting Phase 1.*
*This document supersedes the "Paywall — Skip indefinitely" constraint in ROADMAP.md.*
