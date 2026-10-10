# ADR 0001: Hosting platform

- Status: accepted
- Date: 2026-10-10
- Decided by: Ashwin Sathian

## Decision

Booklet stays on one Mac behind a Cloudflare Tunnel, with MongoDB on the same machine. The move to Cloudflare Workers is deferred, not rejected. It gets looked at again when the rest of the roadmap is done.

The decision was made by the owner part-way through the feasibility spike, before two of its eleven items were measured. This document records what the spike did measure, so the next attempt does not start from zero, and it lists what the Mac needs so that staying on it is a decision and not a default.

## Why not Workers now

The spike's own rule was: "go" only if S1, S2, S3, S4 and S6 pass, the share-page render stays under the 30-second CPU limit, and p95 time to first byte is no worse than production's. Measured against that rule the answer is **no-go**:

- S4 failed as written. `hash-wasm` cannot run in a Worker.
- The p95 comparison was never made, because the production baseline (S0) was not measured.

Three results would have needed a decision even on a pass:

1. Every D1 read from a Worker at the nearest edge to a database in another region took about 100 ms, and a share page makes about 7 of them one after another.
2. Page-unlock passwords cannot be verified at their current strength with the platform's own crypto.
3. Only part of the data layer was ported (list under S3). The rest is still to do.

## What was measured

Versions: Next.js 16.3.8 (the spike raised it from 16.3.4, which `@opennextjs/cloudflare` 1.20.10 requires), wrangler 4.149.0, Node 24.19.0. The code is on the branch `spike/cloudflare-workers`, which is never merged. The Workers and the D1 database it deployed were deleted on 2026-10-10.

"Deployed" below means a Worker on `workers.dev` with a D1 database in the APAC region, called from the network production runs on. CPU times come from `wrangler tail --format json` (`cpuTime`).

| Item | Result | Measurement |
|---|---|---|
| S0 Baseline | Not measured | Needed an API key and 200 test pages on production; the decision came first |
| S1 Build | Pass | OpenNext builds and serves `/`, `/app`, a share page and `POST /api/v1/publish`. Deploy output: 13,686.25 KiB, 2,968.63 KiB gzip. Startup 21 to 33 ms |
| S2 Middleware | Pass | `src/middleware.ts` runs unchanged apart from the 410 lookup. All four checks pass locally and deployed |
| S3 Data | Pass | `versions-concurrency`, `pages-search` and a new rate-limit spec pass on local D1 |
| S4 Passwords | **Fail** | `hash-wasm`: `CompileError: WebAssembly.compile(): Wasm code generation disallowed by embedder` |
| S5 Webhooks | Done | Delivery through `fetch`. `ssrf-guard.spec.ts` passes (19 tests); there is no webhook spec |
| S6 MCP | Pass | The MCP section of `cli-mcp-verify.mjs` passes 13 of 13, locally and deployed |
| S7 Rendering | Pass | Share render 98 ms CPU (p50), 179 ms (max of 10). Publish 252 ms (p50), 368 ms (max of 6) |
| S8 Migration | Pass on local D1 | 16 of 16 collections, row counts equal |
| S9 Atlas from a Worker | Not measured | No cluster was provided. See the local signal under S9 below |
| S10 Cost and operations | Not written | The decision came first |

### S1: build

The bundle is under every limit the two documentation pages give (3 MiB and 10 MiB compressed, 64 MiB uncompressed). The MCP server as a Worker is 1,652.14 KiB, 286.43 KiB gzip.

With the data layer untouched, the build serves static pages and nothing else reliably: the native `argon2` module does not load, and the MongoDB driver works on one request and hangs on the next.

### S2: middleware and the 410 path

The Content-Security-Policy header on the deployed Worker equals the production value byte for byte. HSTS is present. `/admin` returns 403 without an allowed address, including when the caller sends its own `cf-connecting-ip` or `x-forwarded-for`. The API hostname returns 404 for `/` and 401 for `/api/v1/pages`.

On Workers the middleware cannot call `http://127.0.0.1:$PORT/api/pages/:id/gone`. The replacement is one D1 read inside the middleware, which runs in the same isolate as the app:

| Where | Added time per share request |
|---|---|
| Local D1 (n=100) | p50 1 ms, p95 2 ms |
| Deployed, database in another region (n=120) | p50 114 ms, p95 526 ms |

Smart Placement was switched on and had not moved the Worker 15 minutes later, so its effect is unknown.

Script-injecting zone features could not be read through the API with the available login. Production HTML carries one injected script, `/cdn-cgi/challenge-platform/scripts/jsd/main.js`, which the current policy allows (`'self'` plus `'unsafe-inline'`). No Rocket Loader, email-obfuscation or Web Analytics script appears in it.

### S3: data

The schema is 16 tables, one per collection, plus `page_tags` for the tag index. Ported: rate limits, page versions, document storage, publish events, the purge, users, sessions, reset tokens, pages, API keys and webhooks. Not ported: collections and their members, drafts, reports, analytics and the admin metrics. The other unit specs were not run on D1.

Differences that a full port has to handle:

- D1 rejects a `LIKE` pattern longer than 50 bytes (`LIKE or GLOB pattern too complex`). Title search uses `instr(lower(title), lower(?))`, which folds case for ASCII only. MongoDB's `$regex` with `i` also folded other letters.
- A unique index treats two NULLs as different. `collections (user_id, parent_id, name)` needs `COALESCE(parent_id, '')` to keep two top-level folders from sharing a name.
- There are no TTL indexes. An hourly Cron Trigger (`0 * * * *`) deletes expired sessions, reset tokens, rate-limit buckets and dedupe rows, and lookups filter on `expires_at` themselves.
- The daily purge of expired anonymous documents becomes a Cron Trigger (`17 3 * * *`). On local D1 it deleted a document 31 days past expiry and left an owned document and a one-day-expired document alone.
- The version counter no longer needs its retry loop: the next number is computed inside the `INSERT`.

Document bodies fit in D1. The row limit is 2 MB and the largest stored document is 600,000 bytes; a 451,994-character body was written to and read from a deployed database. A statement is limited to 100 KB, so bodies must be bound parameters, never literals.

Size at 10,000 pages, from production's figures (documents average 12.3 KB, snapshots 25 KB, 1.07 versions per page):

| Assumption | Size |
|---|---|
| Today's averages | 0.4 GB |
| 10 versions per page | 2.6 GB |
| 50 versions per page (the cap) | 12.6 GB |

The last row is over D1's 10 GB limit. Snapshots are the part to move to R2 if the database passes about 5 GB.

### S4: passwords

`hash-wasm` compiles its WebAssembly from bytes at run time. Workers forbid that, so it fails before computing anything.

Pure JavaScript does work. `@noble/hashes` 2.4.0 (MIT) verified a hash made by the native `argon2` package at production's parameters (m=65536 KiB, t=3, p=4):

| Where | Time per hash |
|---|---|
| Node 24 on this Mac | 477 to 527 ms CPU |
| Deployed Worker | 981 ms CPU (p50 of 3), 1,034 ms max |
| Deployed login, end to end | 995 ms CPU (p50 of 4) |

No request ended with a memory-limit outcome. Peak memory inside an isolate cannot be read directly.

Page-unlock passwords are a second problem. They are PBKDF2-SHA256 at 600,000 iterations, and both WebCrypto and `node:crypto` on a deployed Worker refuse: `NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not supported (requested 600000)`. The pure JavaScript version verifies correctly at 2,608 ms CPU per attempt (p50 of 3). `wrangler dev` does not enforce the cap, so this only shows up after a deploy.

### S5: webhooks

A Worker cannot pin a connection to an address it resolved itself, so the DNS-rebinding defence in `src/lib/webhook-delivery.ts` does not carry over. From a deployed Worker, `fetch` to `127.0.0.1`, `localhost`, `10.0.0.1`, `192.168.1.1`, `169.254.169.254`, `[::1]` and `100.64.0.1` each returned 403: there is no private network behind a Worker to reach. `src/lib/ssrf-guard.ts` would still have to refuse those addresses at registration, refuse redirects, and be revisited if the Worker ever gets a private network binding.

### S6: MCP

`mcp-server/src/index.ts` runs as a Worker without changes. It reaches the app through a service binding. `booklet-api-client` calls the global `fetch`, so the spike redirected that; the clean version is a `fetch` option on `createClient`.

The whole script scores 41 of 42. The one failure is the script reading MongoDB to confirm a user that is in D1.

### S7: rendering cost

The test document is 200,000 characters and 550 blocks, with a Mermaid block, display and inline KaTeX, and a Graphviz block. KaTeX is rendered on the server; the two diagram types are rendered in the browser. The response is 1.44 MB of HTML. Both numbers in the table are about 0.5% of the 30-second limit.

A denser 200,000-character document (4,800 blocks) cannot be published at all, on any platform: its stored form passes 600,000 bytes and the route returns 413.

### S8: migration rehearsal

No backup archive existed, so the source was a fresh `mongodump` of production, restored into a scratch `mongod`. `scripts/spike-mongo-to-d1.mjs` on the spike branch read it through the driver and wrote through the D1 binding with bound parameters.

All 16 collections arrived with equal counts (3,161 rows; the largest row 346,782 bytes) in 5.2 seconds. No document had a field the schema lacks. The 7 API key hashes and 40 password hashes are identical on both sides, and all 40 are argon2id at m=65536, t=3, p=4. The one page password in production is in the older 100,000-iteration format.

It was not rehearsed against a deployed database, because that would have uploaded production data.

### S9: the comparison case

Not measured. One local observation: with the unmodified driver in `wrangler dev`, requests alternated between success and `The Workers runtime canceled this request because it detected that your Worker's code had hung`.

## Alternative looked at: Vercel Hobby

Read from Vercel's documentation (dated 2026-09-14), not deployed. The app would run with little change, on MongoDB Atlas's free tier. Two things count against it: exceeding an included limit pauses the feature for up to 30 days, and the plan is for non-commercial use only.

## What staying on the Mac requires

A single machine fails in ways code cannot fix. These are in place or in this change:

| Risk | Answer |
|---|---|
| The Mac idle-sleeps and the tunnel drops | `scripts/com.booklet.awake.plist` holds a `caffeinate` assertion |
| `mongod` crashes and launchd does not restart it | The PM2 watchdog starts the MongoDB 8.0 launch agent |
| A bad migration or delete | Nightly local archive, 30 kept, with a restore drill |
| Nobody notices the site is down | `.github/workflows/uptime.yml` probes the three hostnames from GitHub |
| Logs fill the disk | The nightly job rotates the MongoDB log |

These are not solved and are the owner's to accept or fix. Each is described in `docs/OPERATIONS.md`, "Keeping this Mac serving":

- The disk is encrypted with FileVault and there is no automatic login. After any restart, including a power cut or an automatic macOS update, nothing serves until someone unlocks the Mac at its keyboard.
- The local backup is on the same disk as the database.
- Home power and one internet connection.

## When to reopen this

When the roadmap's other phases are done, or sooner if the Mac is down for more than a few hours in a month. Start from the spike branch, and decide these three first: which argon2id implementation to trust, what to do with 600,000-iteration page passwords, and where the D1 database lives relative to readers.
