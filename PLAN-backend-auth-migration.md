# RFC: In-house auth + formalized backend service layer
> Status: OPEN FOR REVIEW
> Scale: Epic
> Target start: 2026-07-11
> Created: 2026-07-11
> Author: Ashwin Sathian (via Claude)

---

## 🎯 Goals

Replace `@clerk/nextjs` with a self-hosted, dependency-free auth system (email +
password, no external vendor, no API keys to a third party), and formalize the
existing organically-grown backend (`src/lib/db/*` + `src/app/api/*`, ~3,510 LOC)
into an explicit, validated, typed service layer that:

1. The Next.js app's own SSR pages and session-cookie API routes call **in-process**
   (no new network hop, no new deployable process).
2. External clients (MCP server, CLI, GitHub Action, VS Code extension) keep calling
   over HTTP via the existing `/api/v1/*` Bearer-API-key surface — now backed by the
   same service functions instead of parallel, drifting logic — through one shared,
   typed client library instead of four independent hand-rolled `fetch` call sites.

**Success looks like**: `@clerk/nextjs` is removed from `package.json`; every
existing user account, page, collection, webhook, and API key survives the
migration with zero data loss; a new visitor can sign up, log in, publish, and log
out entirely via in-house auth; `/admin` and `/my-pages` are gated by the new
session system; CI is green on all 4 packages + the shared client + the main app;
production has been cut over on the single-Mac PM2 deployment with a documented,
tested rollback path.

## 📘 Background

Investigated this session (see conversation for full detail):

- **Clerk touches 37 call sites across 26 files** — middleware route protection,
  admin gating, 19 API routes, sign-in/sign-up pages, `cli-auth` key minting,
  team-invite acceptance, public author profile (`clerkClient`), and 7
  UI components (`useUser`/`UserButton`/passkey sign-in).
- **`DbUser.id` *is* the Clerk user ID** (`src/lib/db/types.ts:4`) and is threaded
  as the `user_id` foreign key through `pages`, `collections`, `collection_members`,
  `api_keys`, `webhooks`, `drafts` — six collections. Clerk IDs are opaque random
  strings (`user_2abc...`) with no structural meaning, so **the migration can keep
  them as the local user's primary key** and avoid remapping any foreign key
  anywhere. This is the single biggest scope-reducer in this RFC.
- **The MCP server, CLI, GitHub Action, and VS Code extension are already 100%
  Clerk-agnostic.** They only ever hold a `rdbl_`-prefixed API key
  (`src/lib/api-key.ts`) and call `/api/v1/*` over Bearer auth
  (`src/lib/api-key-auth.ts`). The only place a live Clerk *session* is required is
  `src/app/cli-auth/page.tsx`, which mints the key after checking `auth()`. Swapping
  that one check for the new session system is a drop-in replacement — **none of
  the four external packages need auth-related code changes.**
- **No schema validation library exists anywhere** (`zod`/`joi`/`yup`/`ajv` all
  absent from `package.json`). All request validation today is hand-rolled
  `typeof`/regex checks inline in route handlers.
- **No shared types/client exists** between `mcp-server`, `packages/cli`,
  `packages/github-action`, `packages/vscode` — each hand-rolls `fetch` calls and
  hand-types the JSON response shape against the same `/api/v1/*` contract. Real
  drift risk today (confirmed: `packages/vscode` and `packages/cli` each define
  their own response types independently).
- **Deployment is single-Mac PM2** (`ecosystem.config.js`: `readable-app` :3100,
  `readable-mcp` :8788, loopback HTTP between them) behind a Cloudflare Tunnel,
  self-hosted MongoDB via Homebrew. `docs/OPERATIONS.md` documents this is a
  single point of failure by design (solo maintainer, no failover) — this RFC does
  not change that topology.
- **Existing crypto conventions to reuse, not reinvent**: `src/lib/password.ts`
  already does Web-Crypto PBKDF2-SHA256 (page-unlock passwords);
  `src/lib/api-key.ts`/`api-key-auth.ts` already establish the
  generate-raw-token → HMAC-pepper-hash → store-hash-only → Bearer-lookup pattern;
  `src/lib/invite-token.ts`/`unlock-token.ts` already establish
  dedicated-env-secret, fail-closed, `jose`-signed-JWT link tokens; every existing
  secret (`INVITE_JWT_SECRET`, `UNLOCK_TOKEN_SECRET`, `API_KEY_PEPPER`) follows the
  same "no fallback, throws if unset" rule in `.env.example`. The new auth system
  follows all of these conventions rather than inventing new ones.
- **Decisions locked in with the user before this RFC was written**:
  1. In-process service layer, **not** a second network service/PM2 process.
  2. Drop passkeys/WebAuthn entirely — email + password only.
  3. No email delivery infrastructure for v1 — account recovery follows the
     existing `invite-token.ts` pattern (signed link, manually shared), deferred
     as documented follow-up work.

## 🔭 Non-Goals

- **No separate network backend process.** Explicitly rejected — see Alternatives.
- **No email sending** (verification, password reset, notifications). Zero SMTP/
  transactional-email vendor added in this RFC.
- **No passkeys/WebAuthn, no social login (Google/Apple), no MFA.** Email +
  password only.
- **No horizontal scaling / multi-machine deployment.** Topology stays single-Mac
  PM2, `instances: 1`, fork mode, per `ecosystem.config.js`.
- **No changes to team/collection RBAC model** (`editor`/`viewer` roles) beyond
  what's needed to swap the identity underneath it.
- **No CAPTCHA/proof-of-work bot mitigation** for signup — rate-limiting only
  (documented as an accepted, revisitable tradeoff, see Risks).
- **No rewrite of `mcp-server`'s tool logic, the CLI's command surface, the GitHub
  Action's inputs, or the VS Code extension's commands** — only their HTTP client
  layer is swapped to the shared package.
- **No change to MongoDB itself** (stays self-hosted, plain `mongodb` driver, no
  Mongoose, no ORM).

## 🏗 Architecture

### System diagram (unchanged process topology, new internal layering)

```
                     ┌─────────────────────────────────────────┐
                     │            readable-app (PM2)            │
                     │                Next.js :3100              │
                     │                                            │
  Browser  ───cookie──▶  Server Components / session routes       │
                     │        │                                   │
                     │        ▼                                   │
                     │   src/server/*  (NEW — validated service    │
                     │   layer: zod input → auth check → db call)  │
                     │        │                    ▲                │
                     │        ▼                    │                │
                     │   src/lib/db/*  (existing)   │ same functions │
                     │        │                     │                │
                     │        ▼                     │                │
  CLI / MCP / ───Bearer──▶ /api/v1/* routes ─────────┘                │
  GH Action /  key       (thin: parse → resolveApiKey → src/server/*)│
  VS Code             │                                            │
                     └──────────────┬─────────────────────────────┘
                                    │ loopback HTTP (unchanged)
                                    ▼
                         MongoDB (self-hosted, unchanged)

  readable-mcp (PM2, :8788) ──HTTP──▶ /api/v1/* (unchanged transport,
    uses packages/shared client instead of hand-rolled fetch)
```

The only new *runtime* surface is inside the existing `readable-app` process.
Nothing new is deployed, no new port is opened, no new PM2 app is added.

### Component inventory

| Component | New / Modified | Notes |
|---|---|---|
| `src/lib/auth/session.ts` | New | `createSession`, `getSession`, `destroySession`, `SESSION_COOKIE_NAME` |
| `src/lib/auth/session-token.ts` | New | Mirrors `src/lib/api-key.ts`: `generateSessionToken`, `hashSessionToken` (HMAC-SHA256 + `SESSION_TOKEN_PEPPER`) |
| `src/lib/auth/password.ts` | New | `hashUserPassword`/`verifyUserPassword` via `argon2` (see Key Decisions) |
| `src/lib/auth/claim-token.ts` | New | Signed link token for (a) migrated-user first password set, (b) future password reset. Mirrors `src/lib/invite-token.ts` exactly (`jose`, dedicated secret, fail-closed) |
| `src/lib/db/auth.ts` | New | `createUser`, `getUserById`, `getUserByEmail` (exists, moves here), `createSessionRecord`, `findSessionByHash`, `deleteSessionRecord`, `deleteAllUserSessions`, `setUserPassword` |
| `src/lib/db/types.ts` | Modified | `DbUser` gains `password_hash: string \| null`, `display_name: string \| null`; new `DbSession` type |
| `src/lib/db/index-specs.mjs` | Modified | Add `sessions` collection indexes (unique `token_hash`, `user_id`, TTL on `expires_at`) |
| `src/app/api/auth/signup/route.ts` | New | Email+password signup, origin check, rate-limited |
| `src/app/api/auth/login/route.ts` | New | Email+password login, origin check, rate-limited, generic error (no user enumeration) |
| `src/app/api/auth/logout/route.ts` | New | Destroys session, clears cookie |
| `src/app/api/auth/claim/route.ts` | New | Consumes a claim token, sets initial password for a migrated user |
| `src/app/sign-in/page.tsx` | Rewritten | Custom form, replaces `<SignIn>` |
| `src/app/sign-up/page.tsx` | Rewritten | Custom form, replaces `<SignUp>` |
| `src/app/sign-in/[[...sign-in]]/`, `src/app/sign-up/[[...sign-up]]/` | Deleted | Clerk catch-all routes no longer needed (plain `/sign-in`, `/sign-up`) |
| `src/app/claim/page.tsx` | New | Migrated-user "set your password" page |
| `src/app/cli-auth/page.tsx` | Modified | `auth()` → `getSession()`; identical control flow otherwise |
| `src/app/admin/layout.tsx` | New | Authoritative admin session+role check (moved out of middleware, see Key Decisions) |
| `src/middleware.ts` | Modified | Drop `clerkMiddleware`; keep IP allowlist + security headers; cheap cookie-presence redirect for `/my-pages` (UX only, not the security boundary) |
| `src/app/layout.tsx` | Modified | Drop `<ClerkProvider>` |
| 19 API routes under `src/app/api/**` (list in Work Breakdown) | Modified | `auth()` → `getSession(req)`; most also move their body into `src/server/*` (Phase 2) |
| `src/app/u/[id]/page.tsx` | Modified | `clerkClient()` lookup → `getUserById` + `display_name`/initials fallback |
| `TopBar.tsx`, `SiteHeader.tsx`, `AppClient.tsx`, `Landing.tsx`, `my-pages/page.tsx`, `my-pages/PasskeyClient.tsx` (deleted), `t/[slug]/admin/page.tsx` | Modified | `useUser()`/`UserButton` → new `useSession()` client hook + small custom account-menu component |
| `src/lib/clerk-appearance.ts` | Deleted | No longer needed |
| `src/server/*.ts` | New | Service layer (Phase 2) — `pages.ts`, `collections.ts`, `teams.ts`, `drafts.ts`, `webhooks.ts`, `keys.ts`, `errors.ts` |
| `packages/shared/` | New | `@readable`-conventioned internal package; zod schemas + inferred types + thin `fetch` client, published to npm as `readable-api-client` |
| `mcp-server/src/*`, `packages/cli/src/*`, `packages/github-action/src/*`, `packages/vscode/src/*` | Modified | Replace hand-rolled `fetch`/types with `readable-api-client` |
| root `package.json` | Modified | Add `"workspaces"`, remove `@clerk/nextjs`, add `zod`, `argon2` |
| `.github/workflows/ci.yml` | Modified | Drop Clerk env vars/e2e-manual Clerk dependency; workspaces-aware install; add `packages/shared` to typecheck matrix + a build/publish job |
| `.env.example`, `.env.production.local.example` | Modified | Remove `NEXT_PUBLIC_CLERK_*`/`CLERK_SECRET_KEY`; add `SESSION_TOKEN_PEPPER`, `CLAIM_TOKEN_SECRET` |
| `docs/OPERATIONS.md` | Modified | Document the new auth system and the migration runbook |
| `scripts/migrate-clerk-users.mjs` | New | One-time production migration script (see Data Model) |

### Data model

```ts
// src/lib/db/types.ts — DbUser, modified
export type DbUser = {
  id: string;                     // was "Clerk user ID"; now app-owned, see Key Decisions
  email: string;                  // was nullable; now required (password auth needs it)
  password_hash: string | null;   // null only for migrated users pending /claim
  display_name: string | null;    // NEW — replaces Clerk's name/avatar on public author pages
  plan: UserPlan;
  created_at: string;
};

// NEW
export type DbSession = {
  id: string;              // createId(20)
  user_id: string;
  token_hash: string;      // HMAC-SHA256(raw token, SESSION_TOKEN_PEPPER) — same pattern as api_keys.key_hash
  created_at: string;
  expires_at: Date;        // BSON Date — TTL index, 30-day sliding window
};
```

New indexes (`src/lib/db/index-specs.mjs`):
```js
{ collection: "sessions", spec: { token_hash: 1 }, options: { unique: true } },
{ collection: "sessions", spec: { user_id: 1 } },
{ collection: "sessions", spec: { expires_at: 1 }, options: { expireAfterSeconds: 0 } },
{ collection: "users", spec: { email: 1 }, options: { unique: true } }, // NEW — email must now be unique (was queried but never uniquely indexed)
```

**Migration**: `scripts/migrate-clerk-users.mjs` (one-time, rerunnable/idempotent —
mirrors `scripts/migrate-from-atlas.sh`'s idempotency pattern) uses the Clerk
Backend API (`CLERK_SECRET_KEY`, still valid during the cutover window) to list all
Clerk users, and for each one **upserts a `users` doc with `_id` = the existing
Clerk user ID** (no FK remap needed anywhere), `email` from Clerk, `password_hash:
null`, `display_name` from Clerk's `first_name`/`username` if set. It then prints
one `/claim?token=...` link per user (via `signClaimToken`, 30-day TTL) to stdout
for the maintainer to manually share — consistent with the "no email infra, link-
based" decision already used for team invites.

### API design

`/api/v1/*` contract is **unchanged** at the wire level (no breaking changes for
existing CLI/GitHub Action/VS Code users already holding an API key) — only its
internal implementation moves to call `src/server/*`. New surface:

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/auth/signup` | POST | none (rate-limited, origin-checked) | `{email, password}` → sets session cookie |
| `/api/auth/login` | POST | none (rate-limited, origin-checked) | `{email, password}` → sets session cookie |
| `/api/auth/logout` | POST | session cookie | Destroys session, clears cookie |
| `/api/auth/claim` | POST | claim token (body) | `{token, password}` → sets `password_hash`, creates session |

## 🔀 Alternatives Considered

| Option | Description | Pros | Cons | Verdict |
|---|---|---|---|---|
| Separate network backend service | New PM2 process/port; Next.js becomes an HTTP client to it even for SSR | Matches literal "backend service" phrasing; clean process isolation | New network hop on every SSR render; second single-instance process that must independently stay up; cross-process auth to secure; zero scaling benefit given Mongo is already the real shared backend and rate-limit/quota are already Mongo-backed (not in-process state) | **Rejected** — user confirmed after evaluation |
| Keep Clerk, add in-house as a fallback | Dual auth systems during a long transition | Lower cutover risk | Two auth systems to maintain indefinitely; contradicts "move away from Clerk"; doubles the surface area of every auth-touching file listed above | Rejected |
| JWT (stateless) sessions instead of DB-backed | Sign a JWT via `jose` (already a dependency), no `sessions` collection | No DB read per request | No instant revocation (logout / "log out everywhere" needs a blocklist anyway, which is the DB-backed approach in disguise); every other credential in this codebase (API keys, page-unlock tokens) already uses the hash-and-store-server-side pattern — DB-backed sessions is the *consistent* choice, not a new paradigm | Rejected — see Key Decisions |
| bcrypt/scrypt for password hashing instead of argon2 | Well-established alternatives | bcrypt has no native-module risk (pure-JS `bcryptjs` exists) | argon2id is the current OWASP-recommended default (memory-hard, GPU/ASIC-resistant); this deployment target is a plain Node process (not edge/Workers), so native bindings are viable; `bcryptjs` kept as a documented fallback if the native module proves troublesome in CI (see Risks) | argon2 primary, bcryptjs documented fallback |
| npm workspaces for `packages/shared` distribution | vs. publish-to-npm-and-reinstall for every internal consumer | Instant local resolution during dev, no publish/bump/reinstall cycle for a solo maintainer iterating across 5 packages | Slightly larger one-time CI restructuring | **Chosen** — `packages/shared` is a workspace member *and* independently published to npm (dual-purpose: internal fast-iteration + external artifact for anyone installing the CLI/action standalone) |

## ⚖️ Tradeoffs

- **No CAPTCHA on signup** means automated account creation is only deterred by
  IP-based rate-limiting, not blocked outright. Accepted because the product has no
  paid tier to abuse and cheap spam accounts have low blast radius (see Risks).
- **No email verification** means an attacker can sign up with someone else's email
  address; that email's owner is never notified. Accepted per user decision — this
  matches the product's current low-stakes, no-PII-beyond-email posture, and is
  reversible later by adding a verification step without a schema change
  (`password_hash` already distinguishes "claimed" from "unclaimed" accounts, the
  same field could gate a `verified: boolean` addition later).
- **Migrated users cannot log in until they use their `/claim` link.** This is a
  real, visible UX cliff for existing users at cutover. Mitigated by generating and
  distributing claim links *before* the cutover deploy (see Phase 1 rollout).
- **`packages/shared` becomes a second place `/api/v1/*`'s contract is defined**
  (zod schemas live there, `src/server/*` imports them back). This is deliberate —
  the alternative (hand-authoring the same shapes twice) is exactly the drift this
  RFC exists to eliminate.

## 😱 Risks

| Risk | Likelihood | Impact | Score | Mitigation | Owner |
|---|---|---|---|---|---|
| Production auth cutover locks out real users or the maintainer | Med | High | 6 | Maintenance-window cutover (not zero-downtime dual-auth): full Mongo backup before deploy (mirrors existing `redeploy.sh` `.next` backup-before-build pattern), migration script run and claim links distributed *before* the deploy that removes Clerk, full flow tested against a local copy of prod data first, `scripts/redeploy.sh`'s existing auto-rollback-on-failed-health-check covers a broken build | Ashwin |
| `argon2` native module fails to build in CI (`ubuntu-latest`) or on the production Mac | Med | Med | 4 | Spike `npm install argon2` in CI and on the target Mac in Phase 0, before any auth code depends on it; documented fallback to pure-JS `bcryptjs` if it fails | Ashwin |
| npm workspaces conversion breaks `publish-cli.yml`'s version-guard or `packages/github-action`'s committed-`dist/` requirement | Med | Med | 4 | Convert incrementally per package; after each conversion, verify `npm pack`/the existing publish workflow output is byte-identical in shape (same `dist/` contents) before moving to the next package | Ashwin |
| Losing Clerk's Cloudflare Turnstile bot-mitigation opens signup to bulk automated account creation | Med | Low–Med | 3–4 | Per-IP signup rate limit (reuse `checkRateLimit`, same pattern as the existing 12/min publish limit); accepted residual risk, documented follow-up (honeypot field or PoW) if abuse is observed | Ashwin |
| `tests/e2e/happy-paths.spec.ts` drives real Clerk sign-in/sign-up (per `ci.yml`'s `e2e-manual` job comment) and will fail outright once Clerk is removed | High | Med | 6 | Rewrite the e2e sign-in/sign-up steps to drive the new email/password form as part of Phase 1, not left for later — this is a required-not-optional task in the Work Breakdown | Ashwin |
| Session-cookie forgery/fixation if the origin check or cookie flags are wrong | Low | High | 3 | `httpOnly` + `Secure` + `SameSite=Lax` cookie; `Origin` header check on `/api/auth/login` and `/api/auth/signup` (login-CSRF mitigation — `SameSite=Lax` alone does not prevent a cross-site POST from setting a cookie); constant-time hash comparison for session token lookup (mirrors `src/lib/unlock-token.ts`'s existing constant-time compare); unit tests assert all of the above | Ashwin |

## 🔗 Dependencies

- **Upstream**: none — this work can start immediately.
- **Downstream**: `packages/cli`, `packages/vscode`, `packages/github-action`,
  `mcp-server` all take a dependency on the new `packages/shared` package (Phase 3)
  but require **no auth changes** (confirmed: all four are already pure API-key
  clients).
- **External**: `argon2` (npm, native bindings — see Risks), `zod` (npm, pure JS),
  Clerk Backend API access during the migration window only (`CLERK_SECRET_KEY`,
  can be revoked/removed after Phase 1 completes and all users have claimed).
- **Blocked by**: nothing.

## 📅 Phases & Milestones

### Phase 0: Foundation (~2–3d)
**Goal**: Every primitive the rest of the RFC depends on exists and is tested in
isolation, with zero behavior change to the running app yet.
**Deliverable**: `src/lib/auth/*` fully unit-tested; `sessions` collection +
indexes live; npm workspaces scaffolded; `zod`/`argon2` installed and spiked in CI.
**Tasks**:
- [ ] Add `zod`, `argon2` to root `package.json`; spike `argon2` install in CI
  (`ubuntu-latest`) and on the production Mac — AC: `npm ci` succeeds in both
  environments, documented in this file's risk row
- [ ] `src/lib/auth/session-token.ts` (`generateSessionToken`/`hashSessionToken`,
  mirrors `src/lib/api-key.ts`) — AC: unit test proves two calls produce different
  raw tokens and the same raw token always hashes identically
- [ ] `src/lib/auth/password.ts` (`hashUserPassword`/`verifyUserPassword` via
  argon2) — AC: unit test proves a wrong password fails verification and a
  correct one succeeds, including against a hash produced in a prior test run
  (stored fixture)
- [ ] `src/lib/db/types.ts`: add `DbSession`, extend `DbUser` — AC: `tsc --noEmit`
  passes
- [ ] `src/lib/db/index-specs.mjs`: add `sessions` + `users.email` indexes — AC:
  `node scripts/setup-mongodb.mjs` run against a local Mongo creates all 4 new
  indexes, verified via `db.sessions.getIndexes()`
- [ ] `src/lib/db/auth.ts`: `createUser`, `createSessionRecord`,
  `findSessionByHash`, `deleteSessionRecord`, `deleteAllUserSessions`,
  `setUserPassword` — AC: unit tests cover create/find/delete/expire against the
  real `mongo:7` CI service container
- [ ] `src/lib/auth/session.ts`: `createSession`, `getSession`, `destroySession` —
  AC: unit test proves `getSession()` returns `null` for an expired or
  nonexistent token and the correct `{userId, email}` for a valid one
- [ ] Convert repo to npm workspaces (`mcp-server`, `packages/*`) — AC: root
  `npm install` succeeds, `npm run --workspace packages/cli build` still produces
  an identical `dist/index.js` to the pre-conversion build (diff check)
- [ ] Scaffold `packages/shared` (empty client + one schema) as a workspace member
  — AC: `mcp-server` can `import` from it via workspace resolution with no publish
  step

**Exit criteria**: All Phase 0 unit tests green in CI; no user-facing behavior has
changed; `main` still runs on Clerk.

### Phase 1: In-house auth cutover (~4–5d)
**Goal**: Clerk is fully removed from the codebase; every previously-Clerk-gated
surface works via the new session system; existing users have a path to keep
using their accounts.
**Deliverable**: `@clerk/nextjs` removed from `package.json`; signup/login/logout/
claim flows live; `/admin` and `/my-pages` gated by sessions; migration script run
against production data (in a rehearsal Mongo copy first, then for real at cutover).
**Tasks**:
- [ ] `POST /api/auth/signup`, `/login`, `/logout`, `/claim` routes — AC: each has
  a unit/integration test covering the happy path and the two failure modes
  (wrong password / non-origin request rejected with the Origin check)
- [ ] Rewire all 19 API routes' `auth()` → `getSession(req)` (see Work Breakdown
  list below) — AC: `grep -rn "@clerk" src/app/api` returns zero matches
- [ ] `src/middleware.ts`: drop `clerkMiddleware`, keep IP allowlist + security
  headers (tightened CSP — drop Clerk FAPI/Google/Apple/Turnstile origins), cheap
  `/my-pages` cookie-presence redirect — AC: CSP contains no `clerk`, `google`, or
  `apple` origins; `/my-pages` with no cookie still redirects to `/sign-in`
- [ ] `src/app/admin/layout.tsx` (new): authoritative session + `ADMIN_USER_IDS`
  check, replacing the userId check that lived in middleware — AC: hitting
  `/admin` from an allowlisted IP but without a valid admin session returns 403;
  with both, renders
- [ ] Rebuild `src/app/sign-in/page.tsx`, `src/app/sign-up/page.tsx` as plain
  forms POSTing to the new routes; delete the Clerk catch-all route folders and
  `src/lib/clerk-appearance.ts` — AC: both pages render and functionally work
  with JS disabled (progressive-enhancement form `action`/`method`, not
  JS-only `fetch`)
- [ ] `src/app/claim/page.tsx`: consumes a claim token, sets password — AC:
  reusing an already-claimed token is rejected
- [ ] Client components (`TopBar.tsx`, `SiteHeader.tsx`, `AppClient.tsx`,
  `Landing.tsx`, `my-pages/page.tsx`, `t/[slug]/admin/page.tsx`): new
  `useSession()` hook + minimal account-menu component replacing
  `useUser()`/`UserButton`; delete `my-pages/PasskeyClient.tsx` and
  `sign-in/[[...sign-in]]/PasskeySignInButton.tsx` — AC: `grep -rn "@clerk" src`
  returns zero matches anywhere in the repo
- [ ] `src/app/u/[id]/page.tsx`: `clerkClient()` → `getUserById` + `display_name`/
  deterministic-initials-avatar fallback — AC: page renders for a user with no
  `display_name` set
- [ ] `src/app/cli-auth/page.tsx`: `auth()` → `getSession()` — AC:
  `readable login` (existing CLI, unmodified) completes an end-to-end browser
  login against the new session system
- [ ] Rewrite `tests/e2e/happy-paths.spec.ts`'s sign-in/sign-up steps to drive the
  new forms — AC: suite passes locally against `next start` + local Mongo
  (required task per Risks table, not deferred)
- [ ] `scripts/migrate-clerk-users.mjs` — AC: idempotent (second run is a no-op),
  rehearsed against a restored copy of production Mongo data with dry-run output
  reviewed before the real run
- [ ] Remove `@clerk/nextjs` from `package.json`; remove all
  `NEXT_PUBLIC_CLERK_*`/`CLERK_SECRET_KEY` from `.env.example`,
  `.env.production.local.example`; add `SESSION_TOKEN_PEPPER`, `CLAIM_TOKEN_SECRET`
  following the exact fail-closed doc convention already used for
  `API_KEY_PEPPER` — AC: `npm ls @clerk/nextjs` reports not installed; `grep -rn
  clerk .env.example` returns zero matches

**Exit criteria**: Fresh signup → publish → logout → login round-trip works in a
clean local environment with zero Clerk code or config present; all Phase-0 and
Phase-1 tests green in CI; production migration rehearsed (not yet executed).

### Phase 2: Service-layer extraction (~3–4d)
**Goal**: Business logic and validation live once, in `src/server/*`, not
duplicated between session-cookie routes and `/api/v1/*` routes.
**Deliverable**: `src/server/{pages,collections,teams,drafts,webhooks,keys,
errors}.ts`; both route families call the same functions; every input is
zod-validated.
**Tasks**:
- [ ] `src/server/errors.ts`: `ServiceError` (code + httpStatus) + `toResponse()`
  helper — AC: unit test maps each error code to the correct HTTP status
- [ ] `src/server/pages.ts`: zod schemas + `publishPage`, `updatePage`,
  `deletePage`, `getPage`, `listPagesForUser`, ownership checks — AC:
  `src/app/api/publish/route.ts`, `src/app/api/publish/[id]/route.ts`,
  `src/app/api/pages/[id]/route.ts`, `src/app/api/v1/publish/route.ts`,
  `src/app/api/v1/pages/route.ts`, `src/app/api/v1/pages/[id]/route.ts` all call
  into it with no page-CRUD logic left inline in the route file
- [ ] `src/server/collections.ts`, `teams.ts` (team routes are collection routes
  under the hood, per existing code — confirm and merge if so), `drafts.ts`,
  `webhooks.ts`, `keys.ts` — same pattern, same AC shape
- [ ] Delete now-dead duplicate validation code from the 19 rewired route files —
  AC: `wc -l src/app/api` total line count drops (thin routes, not thick ones)
- [ ] Unit tests: each `src/server/*` zod schema rejects at least one malformed
  input per field (not just "add tests" — enumerate: missing required field, wrong
  type, over-length string, invalid enum value)

**Exit criteria**: `src/app/api/**/route.ts` files are all "parse → call
`src/server/*` → shape response"; no `db.collection(...)` calls remain directly
inside a route handler.

### Phase 3: Shared client + external integrations (~2–3d)
**Goal**: `mcp-server`, `packages/cli`, `packages/github-action`,
`packages/vscode` all talk to `/api/v1/*` through one typed client instead of four
independent implementations.
**Deliverable**: `packages/shared` published to npm as `readable-api-client`;
all four consumers depend on it; zero hand-rolled response types remain in any of
them.
**Tasks**:
- [ ] `packages/shared/src/schemas.ts`: zod schemas for every `/api/v1/*` request/
  response, re-exported and consumed by `src/server/*` (single source of truth,
  per Key Decisions) — AC: `src/server/*` imports its schemas from here, not
  redefines them
- [ ] `packages/shared/src/client.ts`: `createClient(baseUrl, apiKey)` thin fetch
  wrapper — AC: one integration test hits a local `next dev` instance and gets a
  typed response back
- [ ] `.github/workflows/publish-shared.yml` (new, modeled on `publish-cli.yml`):
  version-guarded npm publish of `readable-api-client` on push to main touching
  `packages/shared/**` — AC: workflow dry-run (`workflow_dispatch`) succeeds
- [ ] Wire `mcp-server/src/*`, `packages/cli/src/*`, `packages/github-action/src/*`,
  `packages/vscode/src/*` to `readable-api-client` — AC: `grep -rn "fetch(" ` in
  each package's `src/` only appears inside `packages/shared`, nowhere else
- [ ] Bump each consumer package's version and republish (`packages/cli` to npm,
  `packages/github-action`'s `dist/` recommitted) — AC: `npm view readable-cli
  version` and the action's `dist/main.js` both reflect the new build

**Exit criteria**: All four external integrations pass their existing typecheck +
whatever manual smoke test each has (CLI `readable publish`, MCP tool call,
GitHub Action run, VS Code command) against a local `readable-app` instance.

### Phase 4: CI/CD, ops, and production cutover (~2d)
**Goal**: CI reflects the new architecture; production has been migrated with a
tested rollback path.
**Deliverable**: Green CI on `main`; production running in-house auth; Clerk
account/keys decommissioned.
**Tasks**:
- [ ] `.github/workflows/ci.yml`: remove all `CLERK_*` env vars/secrets from the
  `build` and `e2e-manual` jobs; `e2e-manual` no longer needs Clerk test tokens
  (comment block rewritten); workspaces-aware `npm ci` at the root instead of
  per-package `--prefix` installs where that simplifies without changing the
  matrix's parallelism; add `packages/shared` to the `typecheck-packages` matrix
  — AC: a full CI run on a branch is green with the new auth system live
- [ ] `docs/OPERATIONS.md`: document the new auth system, the `sessions`
  collection, the migration runbook actually used, and update the stale
  "MongoDB Atlas" env-file comment while here — AC: a new-machine bootstrap
  (`scripts/setup-server.sh`) reader has everything needed with no tribal
  knowledge
- [ ] Rehearse the full cutover against a **restored copy of production data** on
  a scratch Mongo instance: run `migrate-clerk-users.mjs`, verify every existing
  page/collection/webhook/API key still resolves correctly under its (unchanged)
  `user_id` — AC: a scripted check confirms row counts and spot-checked FK
  resolution match pre-migration
- [ ] Production cutover: backup prod Mongo, run the migration script for real,
  deploy via `scripts/redeploy.sh` (existing auto-rollback-on-failed-health-check
  covers a broken build), distribute `/claim` links to existing users, monitor PM2
  logs — AC: `pm2 jlist` shows both apps online post-deploy; a real login with a
  freshly-claimed account succeeds against production
- [ ] Revoke `CLERK_SECRET_KEY` / delete the Clerk application once no code path
  references it — AC: `grep -rn clerk` across the entire repo (excluding this RFC
  and historical docs) returns zero matches

**Exit criteria**: Production is Clerk-free; RFC goals fully met.

## 🧪 Testing Strategy

- **Unit tests** (`tests/unit/`, existing `@playwright/test`-as-node-runner
  convention): session token generation/hashing determinism, password hash/verify
  round-trip including a wrong-password rejection, session expiry (`getSession`
  returns `null` past `expires_at`), login rate-limiting (N+1th attempt from the
  same IP+email is blocked), Origin-header rejection on `/api/auth/login` and
  `/api/auth/signup`, claim-token single-use enforcement, every new `src/server/*`
  zod schema's rejection of malformed input (enumerated per field, not "some
  tests").
- **Integration tests**: `packages/shared`'s client against a live local
  `next dev` instance (real HTTP, real Mongo) for at least the publish/get/list/
  delete page round-trip.
- **E2E** (`tests/e2e/happy-paths.spec.ts`): rewritten to drive the real
  sign-up → publish → sign-out → sign-in flow through the new forms; this
  replaces, not supplements, the Clerk-driven version.
- **Regression check**: `tests/unit/versions-concurrency.spec.ts`,
  `reactions.spec.ts`, `unlock-token.spec.ts`, `api-key.spec.ts`,
  `slug.spec.ts`, `themes.spec.ts`, `locked-page-metadata.spec.ts`,
  `drafts-sync.spec.ts`, `ssrf-guard.spec.ts` must all stay green unmodified
  (none of them touch Clerk) — any change to their output is a signal something in
  the service-layer extraction (Phase 2) altered behavior, not just structure.
- **Manual verification** (Phase 4, against a local environment first, then
  staged against production before revoking Clerk): full signup → publish →
  version history → analytics view → logout → login → admin dashboard access →
  `readable login` (CLI) → MCP tool call → GitHub Action run → VS Code publish
  command, in that order, on one clean run.

## Key Decisions

1. **Preserve existing Clerk user IDs as the local `users._id`.** Rationale: Clerk
   IDs are already opaque random strings with no external meaning once Clerk is
   gone; keeping them avoids remapping `user_id` across six collections
   (`pages`, `collections`, `collection_members`, `api_keys`, `webhooks`,
   `drafts`). New signups post-cutover get fresh IDs via the existing
   `createId()` helper (`src/lib/id.ts`).
2. **DB-backed opaque sessions, not JWTs.** Rationale: every other credential in
   this codebase (API keys, unlock tokens) already uses generate-raw →
   hash-with-pepper → store-hash pattern; sessions need instant revocation
   (logout, future "log out everywhere") which a stateless JWT can't provide
   without a blocklist — which is the DB-backed approach in disguise, just less
   direct. `jose` (already a dependency) stays reserved for the link-token use
   cases it's already used for (invites, unlock, now claim).
3. **argon2id for user account passwords, not the existing PBKDF2-SHA256** used
   in `src/lib/password.ts` for page-unlock passwords. Rationale: account
   passwords protect real user data (pages, API keys, webhooks) and warrant the
   current OWASP-recommended memory-hard KDF; page-unlock passwords protect
   read-access to a single published document and PBKDF2 there is an existing,
   unrelated, lower-stakes design that this RFC does not touch.
4. **Admin authorization moves from `src/middleware.ts` into
   `src/app/admin/layout.tsx`.** Rationale: DB-backed session lookups need a
   Node.js runtime with driver access; rather than depend on Next.js's
   Node-runtime-middleware feature (uncertain stability/availability, would need
   verification against the installed Next 16.2.10), authoritative checks move to
   where Node runtime + Mongo access are already guaranteed today (every existing
   Route Handler and Server Component). Middleware keeps only the cheap,
   edge-safe IP allowlist and security headers it already does well.
5. **`packages/shared` is both an npm workspace member and an independently
   published npm package** (`readable-api-client`, unscoped — matching the
   existing `readable-cli` precedent rather than an unregistered `@readable` npm
   org). Internal consumers (this monorepo) resolve it instantly via workspace
   symlinking; external consumers who `npm install` the CLI/action standalone get
   it bundled as a normal dependency.

## ❓ Open Questions

- [ ] Does `argon2`'s native module install cleanly on both `ubuntu-latest` (CI)
  and the production Mac's Node/Xcode toolchain? — owner: Ashwin, resolved in
  Phase 0 (spike task), before any other auth code depends on it.
- [ ] Exact wording/UX for the `/claim` link distribution to existing users (in-app
  banner vs. direct message vs. email-you-still-have-from-signup) — owner:
  Ashwin, resolved during Phase 4 planning, does not block Phases 0–3.
- [ ] Whether `readable-api-client` should be scoped (`@readable/api-client`) if
  the `@readable` npm org can be registered before Phase 3 — owner: Ashwin,
  low-cost to decide right before Phase 3 starts, doesn't block anything earlier.

## Follow-up Work (Out of Scope)

- Email verification and password-reset-via-email once/if an SMTP relay is
  configured (schema already accommodates it, per Tradeoffs).
- CAPTCHA/proof-of-work on signup if spam signups are observed in practice.
- Multi-factor authentication.
- Re-evaluating the separate-network-service architecture if/when this app
  outgrows a single machine (explicitly not now, per Alternatives).
