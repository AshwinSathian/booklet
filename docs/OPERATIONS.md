# Operations notes

Punch-list style, not a full runbook. Written 2026-07 as part of closing out
`AUDIT_REMEDIATION_PLAN.md`'s P1 items.

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
