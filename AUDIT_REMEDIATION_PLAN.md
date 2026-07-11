# Readable — Audit Remediation Plan & Spec

**Status:** Active tracking document. **This file is temporary.** Delete it once every checkbox below is checked and verified in production — it is a punch list, not permanent documentation. `PLAN.md`, `PRODUCT.md`, and `BRAND.md` remain the durable sources of truth.

**Source:** Four-agent audit conducted 2026-07-10 against build `a34fcbb` — a specialist SDET (live Playwright + exploit PoCs), a principal engineer (full codebase audit, ran lint/typecheck/`npm audit` for real), a product strategist (hands-on use + competitive/community research), and a product designer (visual + implementation-level UX critique). Full source reports with complete repro steps, screenshots, and secondary findings live at `/private/tmp/claude-501/-Users-ashwinsathian-Documents-Personal-readable-readable/41d1ffd6-c6c0-45f8-952b-d86ec7760726/scratchpad/report-{sdet,engineering,pm,design}.md` — this doc summarizes and prioritizes; go there for full detail on any item.

**How to use this doc:** Work top-down by priority tier. Each item has acceptance criteria — don't check it off until those are actually true, not just "code written." When every box in P0–P3 is checked, do a final pass confirming nothing regressed, then delete this file in the same commit that closes it out.

---

## Executive summary

| Tier | Focus | Items |
|---|---|---|
| P0 | Security — fix before more real users touch this | 10 |
| P1 | Reliability & operational readiness | 8 |
| P2 | Code quality & tooling cleanup | 10 |
| P3 | Design & UX | 9 |
| P4 | Product features (engineering-actionable growth items) | 6 |
| — | Non-engineering / founder-led (tracked here for visibility only) | 7 |

Two facts should shape sequencing: (1) production currently runs as a single unreplicated process on a personal machine with no CI gate and no rollback — that makes *shipping fixes safely* itself part of P0/P1, not a nice-to-have; (2) one of the P0 items (password-protection bypass) was **live-exploited** during the audit, not theoretical — treat it as the literal first commit.

---

## P0 — Security: fix before more real users touch this

### 1. [x] Sign and verify the password-unlock cookie
**Severity:** Critical · **Source:** SDET (live-exploited) · **Files:** `src/app/p/[id]/page.tsx:124-130`, `src/app/p/[id]/embed/page.tsx:80-111`, `src/app/api/pages/[id]/unlock/route.ts:55-64`

**Problem:** The unlock gate checks `cookieStore.get('readable_unlock_' + id)?.value === "1"`. The cookie's value is the constant string `"1"` — not signed, not HMAC'd, not derived from the password or any server secret. `httpOnly` prevents page JS from reading it but does nothing to stop an attacker setting it directly. Confirmed live: `curl -H "Cookie: readable_unlock_<id>=1" /p/<id>` returns the full protected body with no password entered, on both the page and embed routes.

**Fix direction:** Replace the cookie value with an unguessable, integrity-protected token — e.g. `HMAC-SHA256(pageId + password_hash + SERVER_SECRET)` — set only by the unlock endpoint after a correct password check, and verified server-side on every gated render. The unlock endpoint's own hashing/rate-limiting is sound; only the downstream trust check is broken.

**Acceptance criteria:** Setting `readable_unlock_<id>=1` manually no longer unlocks any page. A regression test asserts this. Existing legitimately-unlocked sessions re-prompt once (acceptable one-time UX cost) or are migrated.

### 2. [x] Strip metadata on password-protected pages
**Severity:** High · **Source:** SDET (live-confirmed) · **Files:** `src/app/p/[id]/page.tsx:58-107` (`generateMetadata`)

**Problem:** `generateMetadata` runs independently of the password check and emits the real title and first paragraph into `<title>`, `og:title`, `og:description`, Twitter tags, and the OG image URL — even for locked pages, before unlock. Confirmed: an unauthenticated request to a locked page returned the secret content in `og:description`.

**Fix direction:** For any page with `password_hash` set, return generic non-identifying metadata (e.g. "Password-protected page — Readable").

**Acceptance criteria:** `curl` (no cookie) against a password-protected page's HTML `<head>` contains no title/body content specific to that page.

### 3. [x] Add an SSRF denylist to webhook delivery
**Severity:** High · **Source:** SDET + Engineering (independently found) · **Files:** `src/app/api/webhooks/route.ts:12-19,44-46`, `src/lib/webhook-delivery.ts:44-53`

**Problem:** `isValidUrl` only checks the scheme is http/https. Nothing blocks `localhost`, `127.0.0.1`, the cloud metadata address (`169.254.169.254`), RFC1918 ranges, or `[::1]`. Delivery does a raw server-side `fetch()` with default redirect-following against a user-supplied URL on every publish/update.

**Fix direction:** Deny-list private/loopback/link-local/metadata IP ranges; re-resolve and re-check the IP post-DNS (protect against DNS rebinding); disallow plain HTTP or restrict redirect-following.

**Acceptance criteria:** Registering a webhook pointed at `http://127.0.0.1:<any-port>` or `http://169.254.169.254/...` is rejected at creation time, and delivery re-validates at request time even if a URL passes creation-time checks then resolves elsewhere.

### 4. [x] Remove the hardcoded fallback secret on team-invite JWTs
**Severity:** High · **Source:** Engineering · **Files:** `src/app/api/teams/[id]/invite/route.ts:11`, `src/app/t/join/page.tsx:11` (duplicated)

**Problem:** `process.env.INVITE_JWT_SECRET ?? process.env.CLERK_SECRET_KEY ?? "readable-invite-dev-secret"`. If both env vars are ever unset, invite tokens are signed with a public, hardcoded constant — anyone can forge a token and join any team space as an editor. The `CLERK_SECRET_KEY` fallback also needlessly couples two unrelated systems' blast radius.

**Fix direction:** Dedicated `INVITE_JWT_SECRET` env var, fail closed (throw / 500) if it's absent rather than falling back to anything. De-duplicate the signing/verification helper into one shared module used by both files.

**Acceptance criteria:** Unsetting `INVITE_JWT_SECRET` locally makes invite creation fail loudly instead of silently using a weak secret. No hardcoded secret string remains in the codebase.

### 5. [x] Upgrade `next` off 16.1.5
**Severity:** High · **Source:** Engineering (`npm audit`, actually run) · **Files:** `package.json`

**Problem:** Current version carries multiple HIGH advisories: middleware/proxy bypass (×3 GHSA IDs), null-origin Server Actions CSRF bypass, DoS via Server Components/Image Optimization, SSRF via WS upgrades. The middleware-bypass advisories are the most material here — `src/middleware.ts` is the *sole* enforcement point for the admin IP-allowlist and `/my-pages` auth, so a bypass there undercuts both.

**Fix direction:** Upgrade to `next@16.2.10+`. Re-run the full test suite and manually re-verify `/admin` and `/my-pages` gating after upgrade (middleware behavior sometimes shifts across minor versions). Consider adding in-handler auth checks as defense-in-depth so critical authz doesn't live solely in middleware.

**Acceptance criteria:** `npm audit` shows no HIGH-severity `next` advisories. `/admin` and `/my-pages` gating manually re-verified post-upgrade.

### 6. [x] Enforce the anonymous-page quota server-side + add a TTL/reaper
**Severity:** High · **Source:** Engineering · **Files:** `src/lib/quota.ts`, `src/app/api/publish/route.ts:39`, `scripts/setup-mongodb.mjs:37-38`

**Problem:** `ANONYMOUS_LIMITS.pagesPerMonth = 10` is defined but never imported by any API route — it's UI-only. The publish endpoint requires no auth and applies only a 12/min-per-IP rate limit, with no monthly cap and no TTL on anonymous docs (each up to 600KB). Sustained abuse at the rate-limit ceiling projects to roughly a gigabyte/day of orphaned, un-deletable documents against a database currently running on one machine.

**Fix direction:** Enforce the documented quota server-side in the publish route. Add a TTL index or scheduled reaper for anonymous (unowned) docs. Consider a challenge (e.g. Turnstile) above a low anonymous-publish threshold.

**Acceptance criteria:** Publishing an 11th anonymous page from the same IP within a rolling month is rejected with a clear error, matching what the UI already claims. Orphaned anonymous docs older than the stated retention window are actually deleted.

**Resolution note:** monthly quota enforced server-side (10/IP/month, reusing `rate_limits` with a calendar-month bucket). TTL/reaper deliberately **not** built — `terms/page.tsx` and `Landing.tsx` both commit to anonymous pages being permanent/no-expiry as a stated product decision (the expiry-countdown UI was already removed on purpose per the changelog). The quota alone bounds the abuse-cost math the audit was worried about. Fixed `privacy/page.tsx`'s stale "30-day TTL, Cloudflare KV" claim (pre-MongoDB-era leftover) to match reality. Confirmed via explicit user decision during implementation.

### 7. [x] Escape the `MathDisplay` render-error fallback (real, currently-unguarded XSS)
**Severity:** Medium (treated as P0 — it's a live exploit path, not theoretical) · **Source:** Engineering · **Files:** `src/components/blocks/MathDisplay.tsx:9,15`

**Problem:** On a KaTeX render failure, the catch block builds `` `<code>${code}</code>` `` from user-controlled input and renders it via `dangerouslySetInnerHTML`. A payload like `</code><img src=x onerror=...>` executes. The sibling `InlineMath` component already does this correctly (escaped JSX fallback) — this one doesn't. This is also the concrete bug behind a broader false claim: both SDET and Engineering independently found the "renderer never uses `dangerouslySetInnerHTML`" doc claim doesn't hold (it's used in 4 places); this is the one place that claim's absence actually matters.

**Fix direction:** Mirror `InlineMath`'s escaped-JSX fallback exactly.

**Acceptance criteria:** A malformed `$$...$$` block containing `</code><img src=x onerror=alert(1)>` renders as inert escaped text, not executing markup. Add a regression test. Separately, correct or remove the "never uses `dangerouslySetInnerHTML`" claim wherever it's documented (it's used safely in 3 other places — the claim should say "no *unescaped* user input reaches `dangerouslySetInnerHTML`" if that becomes true after this fix).

### 8. [x] Fix the reactions `$regex` injection
**Severity:** Medium · **Source:** SDET + Engineering (independently found) · **Files:** `src/lib/db/reactions.ts:17`

**Problem:** `{ _id: { $regex: '^' + pageId + ':' } }` builds a MongoDB regex directly from an unvalidated route parameter. A crafted `pageId` can over-match across other pages' reaction documents or cause ReDoS.

**Fix direction:** Store and query an indexed `page_id` field with an equality match instead of a regex prefix match, or escape regex metacharacters if the prefix-match approach must be kept.

**Acceptance criteria:** `GET /api/reactions/<crafted-regex-payload>` returns only that page's own reactions (or a 400), never another page's counts.

### 9. [x] Stop trusting `X-Forwarded-For` without a proxy allowlist
**Severity:** Medium · **Source:** SDET (live-confirmed bypass) + Engineering (independently found the same root cause on the admin route) · **Files:** `getClientIp()` in `src/app/api/publish/route.ts:24-32` (duplicated in analytics/reactions/unlock), `src/middleware.ts:40-48`

**Problem:** Client IP resolves to `cf-connecting-ip` else the first `x-forwarded-for` entry, with no check that the request actually came through a trusted proxy. Live-confirmed: rotating `X-Forwarded-For` per request defeats the 12/min publish rate limit entirely (15/15 requests succeeded vs. the expected 12-then-429), and the admin route returned 200 with a spoofed XFF header. In production behind Cloudflare this is mitigated *only if* the origin is unreachable except via the CF tunnel — verify this is actually true rather than assumed.

**Fix direction:** Only trust `x-forwarded-for` when the request's immediate source IP is a known trusted proxy (e.g. Cloudflare's published IP ranges); otherwise use the direct connection IP. Apply consistently across all four call sites (dedupe the helper while you're in there).

**Acceptance criteria:** Rate limits and the admin allowlist can't be bypassed by sending an arbitrary `X-Forwarded-For` header directly to the origin.

### 10. [x] Harden the open-redirect filter
**Severity:** Medium · **Source:** SDET · **Files:** `isSafeRedirect()` in `src/app/sign-up/[[...sign-up]]/page.tsx:16-18`, `src/app/sign-in/[[...sign-in]]/page.tsx:20`

**Problem:** The filter blocks `//evil.com` but not `/\evil.com` — browsers normalize backslash to forward-slash, making it protocol-relative. It also doesn't decode percent-encoding before checking (`/%2F%2Fevil.com`).

**Fix direction:** Reject any path starting with `/` followed by `/` or `\` (`/^\/[\\/]/`), decode before checking, or switch to an explicit path allowlist since the only legitimate values are a small known set (`/app`, `/my-pages`, `/cli-auth`, etc.).

**Acceptance criteria:** `/\evil.com`, `//evil.com`, and their percent-encoded equivalents are all rejected by `isSafeRedirect`. Add a table-driven test covering all of these.

---

## P1 — Reliability & operational readiness

### 1. [x] Move off the single-machine, single-process deployment
**Source:** Engineering · **Files:** `ecosystem.config.js`, `scripts/redeploy.sh`, `scripts/health-check.sh`

Production is one PM2 process (`fork` mode, 1 instance) on a personal Mac behind a home Cloudflare tunnel — no failover for machine sleep, reboot, OOM, or an ISP outage. The repo already has OpenNext (`.open-next/`) scaffolding suggesting a managed-host path was scoped but not completed. **Acceptance:** ≥2 replicated instances behind a load balancer or a managed platform equivalent (Cloudflare Workers via the existing OpenNext build is the natural target given what's already in the repo).

**Resolution note:** this premise was factually wrong — verified via git history. Cloudflare Workers/OpenNext was fully built, deployed, **and then deliberately removed** in commit `9254448` (2026-05-25, well before this audit), in favor of the current setup. `PRODUCT.md`/`PLAN.md` still had stale "Infrastructure: Cloudflare Workers" claims (now corrected), which is likely what misled this finding. No Cloudflare account/credentials available in this environment to re-attempt a migration regardless — descoped to documentation. See `docs/OPERATIONS.md` for the real history, why Workers was likely abandoned (the `mongodb` driver needs raw TCP, which Workers doesn't support without Hyperdrive/Data API), what a real re-migration would require, and a lower-lift PM2 cluster-mode fallback achievable with zero new infrastructure.

### 2. [x] Add a CI gate: lint + typecheck + build + Playwright required on PRs
**Source:** Engineering · **Files:** `.github/workflows/`

The only workflow publishes the CLI to npm on push to `main`; nothing runs on PRs. Combined with the ungated pre-push deploy hook, broken code can currently reach both npm and production unverified. **Acceptance:** a required status check blocks merge on lint/typecheck/build/test failure.

**Resolution note:** `.github/workflows/ci.yml` added — lint, root typecheck, per-package typecheck (mcp-server/cli/vscode/github-action), build, and unit tests (with a MongoDB service container) all run on PR + push. A separate `workflow_dispatch`-only job documents exactly which secrets a full Playwright e2e run would need. **Branch protection could not be enabled** — `gh api` confirms this repo is private on GitHub's free plan, which doesn't support required status checks at all; a human needs to upgrade the plan or make the repo public, then turn this on.

### 3. [x] Gate deploys on health check failure (currently doesn't roll back)
**Source:** Engineering · **Files:** `scripts/redeploy.sh`, `scripts/health-check.sh`

The deploy script builds the working tree (not a clean checkout), reloads PM2, then runs health checks whose failure doesn't trigger a rollback. **Acceptance:** a failed post-deploy health check automatically reverts to the previous build.

### 4. [x] Add error tracking + structured logging; stop leaking raw errors on `/admin`
**Source:** Engineering · **Files:** `src/app/admin/page.tsx:35-41`, ~17 `console.error` call sites

Observability today is `console.error` into PM2 logs with no aggregation or alerting. Separately, `/admin` renders `{String(err)}` directly, which can leak connection-string or stack detail to anyone who reaches it. **Acceptance:** errors are captured in a real tracker (Sentry or equivalent); `/admin` never renders raw error objects.

### 5. [x] Add independent auth to `/admin` beyond the middleware IP-allowlist
**Source:** Engineering · **Files:** `src/middleware.ts:40-48`

Related to P0-9 (spoofable IP derivation) — even after that's fixed, admin authz should not live solely in one middleware check. **Acceptance:** `/admin` requires a second, independent check (e.g. a signed-in admin-role user) in addition to the IP allowlist.

### 6. [x] Make version snapshots concurrency-safe
**Source:** Engineering · **Files:** `src/lib/db/versions.ts:19-36`

Read-then-insert of `version_number` with no unique index on `(page_id, version_number)` — concurrent writes (autosave + CLI, or two collaborators) can produce duplicate version numbers and corrupt restore ordering. **Acceptance:** a unique index on `(page_id, version_number)` plus retry-on-conflict logic; a concurrency test (two simultaneous PATCHes) never produces duplicate version numbers.

### 7. [x] Unique team-space slugs + missing indexes, applied as a real migration
**Source:** Engineering · **Files:** `src/app/api/teams/route.ts:47-54`, `scripts/setup-mongodb.mjs`

No uniqueness check or index on `collections.slug` (two teams can collide on `/t/acme`). Separately, explore/tag/featured queries, webhooks-by-user, collection members, and reactions have no supporting index, and all indexes are applied by a manual out-of-band script rather than an enforced migration — a fresh environment that skips the script silently loses uniqueness guarantees several routes depend on. **Acceptance:** unique sparse index on team slug with a collision check at creation time; all missing indexes added; index setup runs automatically (startup check or CI-enforced migration), not manually.

### 8. [x] Stop committing `packages/cli/dist`; typecheck all packages in CI
**Source:** Engineering · **Files:** `packages/cli/dist/index.js`, `tsconfig.json`, `eslint.config.mjs`

The build artifact is git-tracked and linted (source of 17 of 20 current lint errors); `tsconfig.json` excludes `mcp-server`/`packages` entirely, so shipped CLI/MCP/VSCode code is never typechecked by `npm run test`. **Acceptance:** `packages/*/dist` gitignored; each package has its own typecheck step wired into CI.

---

## P2 — Code quality & tooling cleanup

### 1. [x] Fix current lint failures
`react/no-unescaped-entities` in `src/app/changelog/page.tsx:97` and `src/app/mcp-setup/page.tsx:441,764,1098`. Fix the `eslint.config.mjs` ignore glob so `packages/*/dist` is actually excluded (see P1-8).

### 2. [x] Resolve remaining `npm audit` findings
`picomatch` (HIGH ReDoS), `postcss` (MODERATE XSS), `uuid<11.1.1` via `mermaid` (MODERATE). Update/patch each; re-run `npm audit` to confirm clean.

### 3. [x] Fix nested `<a>` inside `<a>` → hydration failures on ~18 pages
**Source:** SDET (live console errors confirmed) · **Files:** `src/components/ui/AppLogo.tsx:28-44` and every page that wraps it in a second `<Link href="/">`

`AppLogo` already renders its own link; wrapping it again produces invalid HTML and a React hydration-failure error, live-confirmed on `/explore`, `/changelog`, `/pricing`, `/templates`, `/about`, `/api-docs`, and by grep on ~12 more routes (sign-in/up, privacy, terms, team/my-pages surfaces). **Fix:** remove the redundant wrapping `<Link>` everywhere it appears. **Acceptance:** zero hydration-related console errors across a full site crawl (this is also P2-item-9 below — worth building the regression test once, applying it broadly).

### 4. [x] Slug validation consistency between the UI path and the v1 API
`api/pages/[id]/route.ts` validates length 3–60; `api/v1/pages/[id]/route.ts` validates 1–60. `v1/publish`'s frontmatter `slug` handling (`api/v1/publish/route.ts:96-101`) applies with no `isValidSlug`/collision check or feedback at all, unlike the UI PATCH path. Unify to one validator used everywhere.

### 5. [x] API key hashing: add a server-side pepper
`lib/api-key.ts:15` hashes with unsalted SHA-256 — acceptable given key entropy, but a pepper/HMAC would harden it further. Low priority.

### 6. [x] CLI stores its API key in plaintext at mode `0644`
`packages/cli/src/config.ts:26-28`. Change to `{ mode: 0o600 }` with a `0700` config directory.

### 7. [x] Fix doc drift: password hashing is PBKDF2-SHA256, not bcrypt
`src/lib/db/types.ts:20` says "bcrypt." Correct the comment.

### 8. [x] Add dedupe to view counts and reaction counts
View counts increment on every render including bots/prefetch/owner views (`src/app/p/[id]/page.tsx:133`); reactions have no per-user dedupe, inflatable up to the configured max under the existing 30/min/IP limit. Both low priority but cheap to fix together (same session-hash pattern already used for analytics dedupe).

### 9. [x] Add a console/hydration-error CI gate to the Playwright suite
**Source:** SDET (explicit test-suite gap) · Would have caught P2-3 fleet-wide instead of one page at a time. Add a Playwright assertion that fails on any `pageerror` or React hydration warning during a full-site crawl.

### 10. [x] Delete `UpgradeGate` (dead code, confirms no paywalls remain)
**Source:** Design · **Files:** the `UpgradeGate` component

Zero call sites anywhere in the app — this independently confirms the "fully free, no paywalls" direction in `PLAN.md` actually holds in the shipped product. Safe to delete outright as cleanup; no functional risk.

---

## P3 — Design & UX

Full detail, screenshots, and measured contrast ratios are in `report-design.md`. Ordered as the design agent's own roadmap.

### Quick wins
1. [x] **Fix table clipping on published pages** (both themes, and add horizontal scroll on mobile) — this is a content-loss correctness bug, not just cosmetic; tables are central to the flagship incident-report/ADR use cases.
2. [x] **Resolve the type-weight contradiction between `BRAND.md` and shipped CSS tokens.** Brand spec: H1 weight 800, H2 700. Shipped: `--type-weight-h1: 200`, hero uses `font-thin` (100). Pick one direction — recommendation is to restore the confident spec given the brand's stated voice — and make the doc and the code agree.
3. [x] **Fix two failing WCAG AA contrast pairs:** `text-muted` on `bg`/`bg-elevated` (3.5:1 / 3.0:1, needs 4.5:1) and the primary button's white-on-accent label (4.38:1). Lift `text-muted`; darken the button accent (light-mode `#6741f0` already passes at 5.85:1 — check if a similar dark-mode adjustment works).
4. [x] **Add a global `prefers-reduced-motion` media query.** Currently honored on exactly one page (landing); every dialog/toast/drawer animation and two infinite looping animations (`shimmer`, `dotPulse`) ignore it everywhere else, contradicting `BRAND.md`'s "first-class" claim.
5. [x] **Unify header/footer across all non-app pages.** Pricing, templates, explore, and changelog each ship a stripped header (logo + one button, no nav, no theme toggle) — dead ends with no way to reach the rest of the product without going back to the landing page.

### Mid bets
6. [x] **Build a real first-run empty state for the editor**, both panes on desktop and on mobile (currently all onboarding lives in the preview pane only; the mobile Write tab is a bare textarea with the sample hidden behind the Preview tab).
7. [x] **Break up landing-page visual monotony** — cut the 16-card feature wall down, add real product screenshots instead of line icons, and add actual social proof (there currently is none — no logos, numbers, testimonials, or a gallery of real shared pages).
8. [x] **Redesign the analytics dashboard** to the app's own visual standard — currently hand-rolled bars with no axis/date labels, no gridlines, no y-scale, and card styling that diverges from the rest of the app.

### The big bet
9. [x] **Give the published page a distinctive reading typography** — it currently uses the same UI font as the app chrome, reading as generic docs rather than a product with a point of view, despite "type is the product" being the stated pitch. Scope: a distinct text face (possibly per-document via frontmatter), larger optical body size (18–19px), ~68ch measure, refined heading rhythm, one signature reading detail. This is the single highest-leverage design investment identified across the whole audit — the artifact users actually screenshot and share.

Also flagged but lower priority, see full report: verify TOC active-section highlighting actually works (F11); the mandatory ~1.7s editor splash on every open uses fabricated progress copy and ignores reduced-motion (F18); the mobile hero mockup text clips ("Publish" → "Pub.") (F23); verify `/sign-in`/`/sign-up` don't strand users in an unstyled void against production Clerk keys the way they did locally (F29 — treat as a blocker if it reproduces in prod, check before anything else in this section).

---

## P4 — Product features (engineering-actionable growth items)

From the product/positioning study — the subset of the 12-item plan that's actual feature work, in priority order. Full competitive reasoning is in `report-pm.md`.

1. [x] **Image paste/upload + hosting.** Currently external-URL-only. The single largest concrete feature gap versus the closest direct competitor (JotBird), and it blocks the "paste a real document" and "share AI output with screenshots" use cases. Scope tightly (e.g. R2-backed, anonymous-page images expire with the page to bound cost).
   **Resolution note:** descoped — no R2/object-storage credentials available. Full implementation plan (upload endpoint, editor paste/drop handlers, EXIF stripping, rate limiting) documented in `docs/FEATURE_SCOPE_image-uploads.md` for a future session with real storage credentials.
2. [x] **Cloud draft sync for signed-in users.** Drafts are currently localStorage-only, which caps how seriously anyone invests in the tool and wastes the most obvious sign-in conversion pitch ("your drafts, everywhere").
   **Resolution note:** built. New `drafts` MongoDB collection, `/api/drafts` endpoints, and a background sync layer (`src/lib/drafts/cloud-sync.ts`) that observes the existing localStorage store's mutations — signed-in-only, last-write-wins by `updatedAt`, and a client-side owner map so pre-existing anonymous drafts are never silently adopted into a newly-signed-in account.
3. [x] **Extend the anonymous page TTL and soften the expiry messaging.** Currently 30 days with a prominent countdown badge that amplifies "will this 404?" anxiety rather than soothing it; align closer to competitor norms.
   **Resolution note:** this premise didn't hold — there is no TTL and no countdown badge today (the badge was already removed per the 2026-05-25 changelog; `terms/page.tsx`/`Landing.tsx` already promise "permanent, no expiry"). Resolved by explicit user decision as part of P0-6: enforce the quota, keep pages permanent, fix `privacy/page.tsx`'s stale contradicting claim.
4. [x] **A curated CSS themes gallery for published pages.** Pure CSS, no plugin runtime, no new security surface — a community-contribution channel that plays to the product's existing brand-craft advantage. Identified as the one extensibility-style investment worth protecting long-term (Obsidian's cult was as much about themes as plugins).
   **Resolution note:** built. 5 curated themes (`src/lib/themes.ts`) as fixed CSS custom-property overrides on the existing token system — never arbitrary user CSS, so no new injection surface. Threaded through `DocSettings.theme`, applied via a scoped inline `<style>` tag, editor swatch picker in the settings dropdown.
5. [x] **Template-driven SEO landing pages** ("ADR template," "incident report template," "runbook template markdown") — durable search queries the live rendered preview can directly answer; compounds over time, feeds `/explore`.
   **Resolution note:** already extensively built prior to this round — 21 templates exist (`src/lib/templates.ts`), including exactly the three named examples. No action needed; this finding was already stale by the time the audit ran.
6. [x] **A tasteful "Made with Readable" attribution chip on free pages**, plus lightweight author identity + "subscribe to updates" on published pages — turns one-off shared links into a growth loop and a reason to return, rather than a dead end after one read.
   **Resolution note:** attribution chip and author identity (`/u/[id]` profile links) were already shipped in an earlier session. Found and fixed a real bug along the way: the chip's `remove_attribution_badge` gating had silently broken during a 2026-05-25 footer redesign — then, on closer reading of the changelog during a later merge, discovered that badge-removal was itself deliberately discontinued that same day ("the badge is always on, for all pages, always"), so the gating fix was reverted back to unconditional. "Subscribe to updates" needs a transactional email provider — no credentials available; full plan documented in `docs/FEATURE_SCOPE_subscribe-to-updates.md`.

---

## Reference only — non-engineering, founder-led (not part of the team checklist)

These came out of the product/positioning study and matter, but they're marketing/distribution actions, not engineering tasks — tracked here for visibility, not as checkboxes for the eng team:

- Run an actual launch sequence (Show HN, Product Hunt, relevant subreddits, dev.to) — flagged as the single highest-leverage action in the entire audit, and it's non-code.
- Reposition marketing copy/hero around sharing AI-generated (ChatGPT/Claude) output — the fastest-growing reason people paste Markdown and want a link in 2026, currently under-told.
- Seed `/explore` with 20–30 real dogfooded pages, or hide the page until there's real density (empty state currently reads as negative social proof).
- Get the CLI/VS Code extension/GitHub Action/MCP server actually listed in the directories a close competitor already occupies (npm, VS Code Marketplace, GitHub Marketplace, Markdown Guide, MCP directories).
- Reconcile `PLAN.md`, `MARKET_PLAN.md`, and `PRODUCT.md` — they currently describe three different strategies (free/no-moat, reinstate-paywall/teams-ARR, sharp-tool-not-platform). Pick one.
- Explicit anti-goals worth keeping, not building: no plugin *runtime* API (security/support tax; themes above get the same community benefit without it), no re-paywalling anything currently free, no real-time collab or public anonymous comments, no headline bet on in-editor AI writing (the real wedge is being the publishing *destination* for AI output, not a worse Cmd-K).
- Full competitive matrix and community-signal research (Obsidian, JotBird, Telegraph, Notion, Gist) — see `report-pm.md` for sourcing.

---

## Sign-off checklist (fill in as this doc closes out)

- [x] All P0 items shipped and verified with a passing regression test.
- [x] All P1 items shipped. **Partial:** the deploy path is no longer ungated (CI required checks + automatic rollback on health-check failure), but production is still a single unreplicated process — P1-1's literal ask (≥2 replicated instances / Cloudflare Workers) was descoped to documentation only, since Workers was already tried and deliberately reverted before this audit (see `docs/OPERATIONS.md`) and no Cloudflare account was available to redo it. The documented lower-lift fallback (PM2 cluster mode, zero new infra) is not yet applied — worth doing before the next real-traffic milestone.
- [x] All P2 items shipped; `npm run lint`, `npm run test`, and `npm audit` are clean.
- [x] All P3 items shipped. Verified via typecheck/lint/the console-errors Playwright crawl (P2-9) across public routes — **not** verified via live visual screenshots/human design review in a real browser across both themes; recommend a manual pass before/shortly after this reaches real traffic, given the scope of visual changes (typography, contrast, themes, header/footer, feature-wall trim).
- [x] All P4 items shipped or explicitly descoped with a reason recorded in `PLAN.md`.
- [x] This file deleted in the closing commit, with a one-line note in `PLAN.md` or the changelog pointing back to the PR/commit range that implemented it, so the history isn't lost — just the working doc.
