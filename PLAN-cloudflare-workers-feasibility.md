# Cloudflare Workers + MongoDB Atlas: feasibility analysis

Status: **ANALYSIS ONLY — no implementation started.** Written 2026-07-23 in
response to a request to critically evaluate deploying `readable-app` on
Cloudflare Workers (via OpenNext) with MongoDB Atlas, while staying strictly
within Cloudflare's **Free** plan (zero bill, ever) and with no feature or
security regression ("without compromise").

**Bottom line up front:** technically possible, but "without compromise" and
"zero Cloudflare bill" are in tension with each other in exactly one place —
account-password hashing — and the migration is a real data-layer rewrite,
not a redeploy. Full reasoning below. This revises and corrects prior
guidance in `docs/OPERATIONS.md` and the `cloud_migration_plan` memory, both
of which understated how load-bearing the MongoDB connection-reuse problem
is.

This is the same rollback this app already lived through once (`commit
9254448`, 2026-05-25, "remove all Cloudflare Worker dependencies"). Anything
that made that removal look reasonable at the time is re-examined here
against what's actually changed since (mainly: workerd's `node:net`/`node:tls`
support, which didn't exist when Workers was first tried in this repo).

---

## 1. What actually blocks this today

### 1.1 `argon2` is a native addon — cannot run in a Workers isolate at all

`src/lib/auth/password.ts` hashes account passwords with the `argon2` npm
package (default params: `m=65536 KiB, t=3, p=4` — the code comment notes
this deliberately exceeds OWASP's minimums). This package is a compiled
Node native addon (prebuilt `.node` binary via napi), not a pure-JS or WASM
module. Workers' `nodejs_compat` flag shims a *subset* of Node's built-in
JS-expressible APIs (`node:net`, `node:tls`, `node:crypto`, etc.) — it does
not and cannot load arbitrary compiled native addons. This has nothing to do
with `nodejs_compat_v2` or any compatibility date; it is categorically
unsupported. **This blocks every build, not just a slow one.**

A drop-in fix exists: swap to a WASM argon2id implementation (e.g.
`hash-wasm`). That solves *loading* the code. It does not solve running it
(next section).

### 1.2 Free-plan CPU time (10ms/request, hard cap) cannot fit argon2id

Cloudflare Workers' **Free** plan caps CPU time at **10ms per request**, and
critically — **this cannot be raised**. `limits.cpu_ms` in `wrangler.jsonc`
only takes effect on the **Paid** plan ($5/mo minimum), where it can go up
to 5 minutes. There is no way to buy more CPU time while staying on Free.

Argon2id at this app's current parameters costs on the order of 50–300ms of
wall/CPU time on typical hardware, by design — memory-hardness and
deliberate slowness is the entire point of the algorithm as a password KDF.
A WASM reimplementation won't be faster than the native one. This is **5–30x
over the Free plan's hard ceiling**, for every signup and every login.

There is no config change that resolves this. The two honest options are:

- **Downgrade the KDF** for account passwords to something CPU-cheap enough
  to fit under 10ms — in practice this means Web Crypto `PBKDF2` (native
  BoringSSL-backed, not JS/WASM, so genuinely fast), the same primitive this
  codebase *already* uses for page-unlock passwords (`src/lib/password.ts`,
  100,000 iterations, comment implies this tier deliberately doesn't need
  argon2id's memory-hardness). Applying that same pattern to account
  passwords is defensible under current OWASP guidance (PBKDF2-HMAC-SHA256
  at ≥600k iterations is an accepted tier, not "insecure") — but it is a
  **real reduction from argon2id's memory-hardness**, which the code
  comment shows was a deliberate choice for the account-password tier
  specifically, not an oversight. This is the one place "zero bill" and
  "without compromise" cannot both be true; it needs an explicit decision
  from you, not a silent substitution.
- **Move only auth off Workers** (e.g. keep sign-up/login on a tiny non-CF
  origin, or accept Workers Paid — $5/mo — scoped to just this). Both
  contradict a stated constraint (zero-CF-bill or Workers-only), so neither
  is "free," they're just different places to spend the cost.

### 1.3 MongoDB works on Workers now — but not the way this codebase uses it

The prior removal's stated reasoning (`docs/OPERATIONS.md`) — "Workers
doesn't support arbitrary outbound TCP the way Node does" — is **now
outdated**. Since workerd added `node:net`/`node:timers` and a real
`node:tls` `TLSSocket` (~Jan–Mar 2025, requires `nodejs_compat_v2` and a
compatibility date ≥ 2024-12-05), the standard `mongodb` driver does connect
and run real queries against Atlas from a Worker. Confirmed against a live
Atlas cluster in a March 2025 write-up.

But there's a second, more load-bearing constraint that neither
`docs/OPERATIONS.md` nor the prior `cloud_migration_plan` memory called out:

> **Workers enforce per-request I/O isolation.** A `node:net`/`node:tls`
> socket (or any I/O object) opened while handling request A cannot be used
> while handling request B — attempting to reuse it throws `Cannot perform
> I/O on behalf of a different request`. This is a fundamental workerd
> design property, not a MongoDB-specific bug.

`src/lib/mongodb.ts` today caches a single `MongoClient` in a module-level
variable (`_prodClientPromise`) and reuses it across every request — the
standard, correct pattern for a long-lived Node/PM2 process. **That exact
pattern breaks under Workers**: the cached client's underlying socket was
opened during some earlier request and cannot be reused by a later one.

Naively "fixing" this by opening a fresh `MongoClient` per request would:
- Pay a full TCP+TLS handshake (SCRAM auth included) on *every* request that
  touches the database — which, in this app, is nearly every request:
  every `/api/*` route, every session check (`getSession()` is a Mongo
  lookup, done on nearly every authenticated request), the Mongo-backed
  rate limiter (`src/lib/rate-limit.ts`), and the published-page route
  itself (`src/app/p/[id]/page.tsx`, `runtime = "nodejs"`, `dynamic =
  "force-dynamic"` — no caching, every view re-queries Mongo).
- Burn real CPU time on that handshake's crypto (ECDHE, cert parsing) —
  directly competing with the same 10ms Free-plan ceiling as §1.2, on
  *every* Mongo-touching request, not just auth.
- Risk exhausting Atlas M0's 500-connection cap under any real concurrency,
  since concurrent requests each open their own connection instead of
  sharing a pool.

**The real fix is a Durable Object acting as a connection-pool proxy** — a
DO's execution context is continuous across invocations (unlike a Worker's),
so a `MongoClient` opened once inside a DO *can* be reused. Workers Free
plan does include SQLite-backed Durable Objects at no cost (~3M
requests/month, 5GB storage, generous row-read/write allowances) — so this
stays inside the zero-bill constraint. But it means:

- Rewriting `src/lib/mongodb.ts` and, transitively, every file under
  `src/lib/db/*.ts` (all ~40 Mongo-touching call sites: pages, sessions, API
  keys, rate limits, webhooks, teams, collections, drafts, reactions, view
  counts) to go through DO RPC calls instead of a direct `await getDb()`.
  This is a genuine data-access-layer rewrite, not a config change.
- Accepting a single DO instance (or a small deliberately-sharded set) as a
  new single point of serialization for all database access — DO instances
  process incoming calls to themselves one at a time. At this app's current
  scale (91 published pages, personal-project traffic) this is very unlikely
  to matter in practice, but it's a new architectural property that didn't
  exist before and is worth naming rather than discovering under load.
- Re-deriving the Atlas connection string in **non-SRV form**
  (`mongodb://host1,host2,host3/...` instead of `mongodb+srv://...`) —
  `dns.resolveTxt`/SRV record resolution has historically been the weaker
  part of workerd's DNS shim; Atlas's dashboard can generate the non-SRV
  form directly, so this is a known, low-effort workaround, not a blocker,
  but it's an easy thing to trip over if you paste the default connection
  string.

### 1.4 Worker script size: already brushed the Free-plan 3 MiB limit once

`scripts/stub-og.cjs` (still wired into `postinstall` today, even though the
app has run on plain Node/PM2 since May) exists *specifically* because
OpenNext's Turbopack patch unconditionally pulled in `@vercel/og`'s WASM
(~1.5MB) and pushed the gzipped Worker over the Free plan's **3 MiB script
size limit** — even though this app doesn't use `ImageResponse` at all. That
was worked around once already; it's directly relevant evidence that this
app's server-side bundle (Next.js 16 + React 19 + the full `mongodb` driver
and its dependencies — bson, compression codecs, etc. — + ~40 route
handlers, all bundled into one Worker) already has thin headroom under 3
MiB. This needs a fresh `wrangler deploy --dry-run` size check before
committing to the migration, not an assumption that the old workaround still
covers it.

---

## 2. What is *not* a problem (checked, not assumed)

- **OpenNext/Cloudflare + Next.js 16**: actively supported (all 16.x minor/
  patch versions), so no framework-version blocker.
- **Markdown → HTML rendering**: parsing (`unified`/`remark`, `src/lib/
  parse.ts`) happens once at *publish* time, producing a stored `Block[]`
  JSON AST (`src/lib/storage.ts`). Per-view rendering (`BlockRenderer.tsx`)
  is `"use client"` — it runs in the visitor's browser, not the Worker. Same
  for syntax highlighting (`highlight.js`, via `CodeBlock.tsx`) and diagram
  rendering (`mermaid`, `@viz-js/viz` Graphviz-via-WASM, via
  `DiagramBlock.tsx`). None of this counts against Worker CPU time.
- **Math (KaTeX)**: client-side (`MathDisplay.tsx`/`InlineMath.tsx`).
- **Page-unlock passwords**: already use Web Crypto `PBKDF2`
  (`src/lib/password.ts`) — already Workers-native-speed, no change needed.
  This is the existing in-repo precedent for the §1.2 fix on account
  passwords.
- **Unlock-token signing**: already Web Crypto HMAC-SHA256
  (`src/lib/unlock-token.ts`) — Workers-native.
- **Export (Markdown/HTML download)**: fully client-side blob download
  (`ExportMenu.tsx`), no server PDF rendering, so no dependency on
  Cloudflare's (paid, limited) Browser Rendering API.
- **Image handling**: `next.config.ts` already sets `images: {unoptimized:
  true}`, and uploads were already descoped (per prior project decision) —
  no dependency on Cloudflare Images or a next/image edge loader.
- **Traffic volume**: 100,000 requests/day free allowance vs. this app's
  actual usage (91 published pages total, personal-scale traffic) — not
  close to a constraint.
- **Webhooks** (`src/lib/webhook-delivery.ts`): plain outbound `fetch`,
  native and unrestricted in Workers.
- **MCP server**: already a clean Workers candidate independent of this
  analysis — it's a stateless `fetch` handler with *no* direct MongoDB
  coupling (it calls `readable-app`'s own `/api/v1` over HTTP). Restoring it
  as a native Worker carries none of the risk in §1.3.
- **CLI / GitHub Action / VS Code extension**: already cloud-native
  (npm / GitHub Marketplace / VS Code Marketplace), unaffected either way.
- **Atlas Free (M0) cluster itself**: permanently free, 512MB storage, 500
  connection cap, no time limit — fine for this app's data size today. Two
  honest caveats, both *pre-existing* gaps rather than new ones: M0 doesn't
  support backups/PITR at all (the self-hosted `mongod` setup already has
  this same gap per `docs/OPERATIONS.md`), and M0 is a shared cluster, so
  performance is best-effort, not dedicated.

---

## 3. What this migration actually requires, scoped honestly

1. **Decide the argon2 question** (§1.2) — this needs your sign-off, not a
   silent code change, since it's a real security-posture tradeoff, not a
   technical detail.
2. Rewrite `src/lib/mongodb.ts` + all `src/lib/db/*.ts` call sites around a
   Durable-Object-backed connection proxy (§1.3). This is the single
   largest chunk of engineering effort in the whole migration.
3. Re-derive the Atlas connection string in non-SRV form.
4. Re-scaffold `wrangler.jsonc` / `open-next.config.ts` (deleted in commit
   `9254448`, but recoverable via `git show 9254448~1:<path>` as a starting
   point — not a from-scratch design).
5. Move secrets (`SESSION_TOKEN_PEPPER`, `CLAIM_TOKEN_SECRET`,
   `MONGODB_URI`, `UNLOCK_TOKEN_SECRET`, `ADMIN_IPS`, `ADMIN_USER_IDS`,
   `NEXT_PUBLIC_SITE_URL`, etc.) to `wrangler secret put`.
6. Run a real `wrangler deploy --dry-run` bundle-size check (§1.4) before
   assuming it fits.
7. Re-verify `src/middleware.ts`'s IP-allowlist admin gate and the
   `readable-api.ashwinsathian.com` host-based routing split still behave
   correctly under Workers' request model (should be fine — no Node-only
   APIs in `middleware.ts` today — but worth a real check, not an
   assumption, given how much else in this doc turned out to need
   verification rather than inference).
8. End-to-end re-run of `scripts/production-verify/` (both the Playwright
   suite and `cli-mcp-verify.mjs`) against the Workers deployment before
   calling it done — this is exactly the kind of regression those suites
   exist to catch.

This is materially more than "redeploy the same app to a different host." It
touches the data-access layer used by essentially every route in the app.

---

## 4. Recommendation

Given the above, I'd frame the actual decision as three options, not one:

- **(A) Do it, with PBKDF2 for account passwords.** Achieves genuinely
  zero Cloudflare bill and keeps the app fully self-contained on
  Workers + Atlas Free. Costs: the DO-proxy rewrite (real engineering,
  bounded and well-understood — not a research problem anymore, everything
  in §1 has a known answer) + an explicit, acknowledged KDF downgrade for
  account passwords that you'd be signing off on knowingly, not discovering
  later.
- **(B) Do it, keep argon2id, accept Workers Paid ($5/mo) for the CPU
  ceiling.** No security tradeoff, but violates the "zero bill" constraint
  by the smallest possible amount ($5/mo flat, not usage-based) — this is
  the "buy the ceiling instead of lowering the bar" option.
- **(C) Don't move the main app; only restore `readable-mcp` as a Worker**
  (as already scoped as a clean win in `cloud_migration_plan`), and address
  the personal-Mac single-point-of-failure problem some other way (that
  memory's Fly.io direction, or just PM2 cluster mode per
  `docs/OPERATIONS.md`'s "lower-lift fallback"). Zero new risk, but doesn't
  answer the cost/reliability question for the main app.

I don't think there's a version of "everything works exactly as today, and
it's Cloudflare-Workers-only, and it costs nothing" that's actually true —
§1.2 is a real fork in the road, not a implementation detail I can paper
over. Let me know which of (A)/(B)/(C) — or which piece of §1.2 — you want,
and I'll turn the chosen path into a proper implementation plan.
