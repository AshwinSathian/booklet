# Operations notes

Punch-list style, not a full runbook. Written 2026-07 as part of closing out
`AUDIT_REMEDIATION_PLAN.md`'s P1 items. Updated 2026-07 with the in-house
auth migration (see `PLAN-backend-auth-migration.md` for the full design).

## Auth: in-house (Clerk removed)

**Current state:** Email + password, no third-party identity provider.
Passwords are hashed with `argon2id` (`src/lib/auth/password.ts`). Sessions
are opaque, DB-backed tokens (`sessions` collection, TTL-indexed, 30-day
sliding window), hashed with an HMAC pepper before storage — the same
generate-raw/hash-with-pepper/store-hash-only pattern already used for API
keys (`src/lib/api-key.ts`) — and delivered via an httpOnly/Secure/
SameSite=Lax cookie (`readable_session`). See `src/lib/auth/session.ts`.

**Required env vars** (fail closed if unset, no fallback — see
`.env.example` for generation commands): `SESSION_TOKEN_PEPPER`,
`CLAIM_TOKEN_SECRET`. `ADMIN_USER_IDS` is unchanged in meaning (still a
comma-separated list of user IDs) but no longer refers to Clerk IDs for new
signups — see the migration note below for why existing admin IDs don't
need to change.

**Admin gating is split across two layers**, not one: `src/middleware.ts`
does a cheap, Edge-safe IP allowlist check (`ADMIN_IPS`) only; the
authoritative session + `ADMIN_USER_IDS` check lives in
`src/app/admin/layout.tsx`, which needs Node.js runtime for the Mongo-backed
session lookup. Both must pass. `/my-pages`'s cookie-presence redirect in
middleware is similarly non-authoritative — the real check is
`getSession()` inside each page/route.

**No email delivery.** Password reset and email verification are
out of scope for this iteration (see PLAN-backend-auth-migration.md's
"Follow-up Work"). Account recovery for users migrated off Clerk uses the
same signed-link-shared-manually pattern as team invites — see the
migration runbook below.

## Production cutover runbook (Clerk → in-house auth)

This only needs to run once, at the point `main` is deployed with Clerk
removed. It is **not idempotent-and-forgettable** — re-running after users
have started claiming accounts is safe (see the script's own idempotency
guarantees), but the *cutover* itself (deploying Clerk-free code to
production) is a one-way door once real users hit it.

1. **Back up MongoDB first.** This deployment has no automated backup
   pipeline (see the single-machine-deployment section below) — take a
   manual `mongodump` of the `readable` database before touching anything.
2. **Rehearse against a restored copy**, not production directly: restore
   the backup to a scratch local `mongod` (or a second database name),
   point `MONGODB_URI` at it, and run `node scripts/migrate-clerk-users.mjs`
   with `CLERK_SECRET_KEY` (still valid at this point) and
   `CLAIM_TOKEN_SECRET` set. Confirm the printed summary line's counts match
   expectations and spot-check a few generated `/claim?token=...` links
   resolve correctly against a locally-running app pointed at that same
   scratch database.
3. **Deploy the Clerk-free build** via the normal `scripts/redeploy.sh`
   path (pre-push hook, or run it directly) — this already has
   backup-before-build + health-check + auto-rollback-on-failure built in
   for the *application* layer. Add the new required env vars
   (`SESSION_TOKEN_PEPPER`, `CLAIM_TOKEN_SECRET`) to
   `.env.production.local` before this step, or every session-dependent
   request fails closed immediately after deploy.
4. **Run the real migration**: `node scripts/migrate-clerk-users.mjs`
   against the real `MONGODB_URI`, with `CLERK_SECRET_KEY` still set (it's
   only needed for this one script, not the app itself — safe to remove
   from `.env.production.local` once every user has claimed). It prints one
   `email\t/claim?token=...` line per user needing to set a password;
   nothing here sends email — share these links with the affected users
   through whatever channel you'd already use to reach them.
5. **Verify**: sign up a fresh test account, sign in, publish, and confirm
   `/admin` is still reachable with the existing `ADMIN_USER_IDS` value —
   Clerk user IDs are preserved as-is as the new local user IDs (see
   PLAN-backend-auth-migration.md's Key Decisions), so no admin
   reconfiguration should be needed.
6. **Revoke `CLERK_SECRET_KEY`** (delete the Clerk application, or just
   rotate/revoke the key) once step 4's migration has run and you don't
   expect to re-run it. Nothing in the running app reads it — only the
   one-time migration script does.

**Rollback**: if the Clerk-free deploy needs to be reverted, `git revert`
back to the last Clerk-based commit and redeploy — the `users` collection
gained new fields (`password_hash`, `display_name`) and a new `sessions`
collection, but nothing about the rollback removes or corrupts pre-existing
Clerk-era data (the migration script only ever adds/backfills, never
deletes). Note this only reverts the *application*; anyone who already
claimed a password-based account keeps that password_hash — reverting to
Clerk doesn't retroactively invalidate it, so treat a rollback as a
one-way decision too, not a clean undo.

## npm workspaces + the shared API client

The repo is an npm workspace (`mcp-server`, `packages/*`) — one root
`package.json`/lockfile covers every package; there's no more
`packages/*/package-lock.json`. `packages/shared` (published to npm as
`readable-api-client`) is the single source of truth for the `/api/v1/*`
request/response contract (zod schemas + a thin typed fetch client) —
`mcp-server`, `packages/cli`, `packages/github-action`, and
`packages/vscode` all depend on it instead of hand-rolling their own fetch
calls. Three of those four (`cli`, `github-action`, `vscode`) bundle it at
build time via `tsup` (`noExternal`) into a single self-contained output
file, since none of them get a real `npm install` step wherever they
actually run (a published npm package, a GitHub Actions runner with no
install step, a VS Code Extension Host). `mcp-server` resolves it normally
via `node_modules` since it runs as a regular long-lived Node process under
PM2. See `PLAN-backend-auth-migration.md` Phase 3 for the full design.

## Error tracking / structured logging

**Current state:** `src/lib/logger.ts` provides `logError`/`logWarn`/`logInfo`,
emitting JSON lines to stdout/stderr instead of free-form
`console.error(string, err)` calls. Every catch-and-log site across the app
(~21 call sites) now goes through this. Logs still land in PM2's log files
(`~/.pm2/logs/`) — there is **no external aggregation, search, or alerting**
yet.

**Why not further:** an external error tracker (Sentry, Axiom, Better Stack,
etc.) needs a real account/DSN. None is available in this environment.

**What a future integration needs:**
1. Pick a provider, create an account, get a DSN/API key.
2. For Sentry specifically: `npm install @sentry/nextjs`, run
   `npx @sentry/wizard@latest -i nextjs`, set `SENTRY_DSN` in the environment.
3. Wrap `logError` in `src/lib/logger.ts` to also call
   `Sentry.captureException(err, { tags: { scope }, extra })` when
   `SENTRY_DSN` is set — keep the JSON-stdout behavior too, so PM2 logs stay
   useful without the external service.
4. Wire PM2 itself to alert on process crashes/restarts (PM2 Plus, or a
   simple watchdog cron hitting `pm2 jlist` and paging on unexpected state)
   — this is a different concern from application-level error tracking and
   isn't addressed by the logger change above.

## Infrastructure: single-machine deployment

**Current state:** one PM2 process (`readable-app`, `fork` mode, 1 instance)
plus a second PM2 process (`readable-mcp`) on a personal Mac, both reverse-
proxied to the public internet via a Cloudflare Tunnel (`cloudflared`). No
failover for machine sleep, reboot, OOM, or an ISP outage.

**Correction to the audit this doc originally responded to:** the audit
assumed Cloudflare Workers/OpenNext scaffolding already in the repo
represented an *incomplete* migration ("scoped but not completed"). That's
not what happened. Cloudflare Workers was **fully built, deployed to
production, and then deliberately removed** in commit `9254448`
("chore(infra): remove all Cloudflare Worker dependencies and CF-specific
code", 2026-05-25 — well before the audit ran) — `wrangler.jsonc`,
`open-next.config.ts`, `@opennextjs/cloudflare`, and all CF-specific code
were deleted; `npm run deploy` was repointed at `scripts/redeploy.sh` (local
build + PM2 reload); the MCP server was converted from a Worker to a plain
Node process. `PRODUCT.md` and `PLAN.md` both still contained stale
"Infrastructure: Cloudflare Workers via OpenNext" claims describing this as
current — corrected alongside this doc, since that's very likely what led
the audit to the wrong premise.

**Why it was likely abandoned (not stated explicitly in the commit, inferred
from the surrounding history):** the app also migrated its entire data layer
from Cloudflare D1/KV to MongoDB Atlas around the same period. `src/lib/
mongodb.ts` uses the standard Node `mongodb` driver, which needs a real TCP
socket to the Atlas cluster. Cloudflare Workers' runtime does not support
arbitrary outbound TCP the way a normal Node process does (it requires
Hyperdrive or a Data-API-style HTTP proxy to reach a database like MongoDB
Atlas) — reconciling "MongoDB via the standard driver" with "Workers
runtime" is a real, nontrivial compatibility gap, not a small config change.
This is the most plausible reason the CF Workers path was rolled back rather
than extended.

**What re-attempting a Cloudflare Workers migration would actually require**
(scoped honestly, given the above — this is not a small "finish what's
already there" task):
1. Either adopt Cloudflare Hyperdrive (a TCP-to-Workers connection pooler —
   check current Hyperdrive support for MongoDB specifically, historically
   it's been Postgres/MySQL-focused) or replace `src/lib/mongodb.ts`'s driver
   usage with MongoDB's Data API (HTTP-based, works from any edge runtime,
   but is a materially different client and query surface — most of
   `src/lib/db/*.ts` would need rewriting, not just the connection setup).
2. Re-scaffold `wrangler.jsonc`/`open-next.config.ts` and reinstall
   `@opennextjs/cloudflare` (deleted, but the removal commit shows exactly
   what existed — `git show 9254448` for the full prior config).
3. Move all secrets currently in `.env`/`.env.local` to Wrangler secrets
   (`wrangler secret put`) or Workers environment bindings.
4. Re-verify the `@vercel/og` WASM-bundling workaround (`scripts/stub-og.cjs`)
   still applies — it was written specifically for this OpenNext/Workers
   path and may need to be re-derived if OpenNext's bundling behavior has
   changed since May 2026.
5. This needs an actual Cloudflare account with Workers access, which is not
   available in this environment — descoped here to documentation only, per
   product decision.

**Lower-lift fallback, achievable with zero new infrastructure:** run 2+ PM2
instances in `cluster` mode on the *same* machine (`instances: 2` or more,
`exec_mode: "cluster"` in `ecosystem.config.js`, currently `instances: 1` /
`"fork"`). This doesn't protect against the machine itself sleeping,
rebooting, or losing power/ISP connectivity, but it does protect against a
single Node process OOM-ing or crashing under load — a real, if partial,
reliability improvement with no new moving parts. Recommended as the
practical next step unless a Cloudflare Workers (or other managed-host)
migration is actually imminent.
