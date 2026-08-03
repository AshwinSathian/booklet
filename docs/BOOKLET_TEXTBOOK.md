---
title: "Booklet: The Complete Technical Textbook"
description: "Everything a subject-matter expert on Booklet should know — product, architecture, code, infrastructure, and the engineering decisions behind all of it."
date: 2026-07-28
author: "Ashwin Sathian"
tags: [booklet, engineering, architecture, reference]
---

# Booklet: The Complete Technical Textbook

*A ground-up guide to the product, the architecture, the code, and the reasoning behind
every major decision — written so that someone with zero prior context can finish it as
a genuine subject-matter expert.*

> This document was written by reading Booklet's own strategic docs (`README.md`,
> `PRODUCT.md`, `BRAND.md`, `docs/OPERATIONS.md`, and three implementation RFCs) end to
> end, then having five parallel research passes read the actual source code —
> `src/app`, `src/lib` + `src/server`, `src/components`, the npm-workspace packages +
> MCP server, and the deployment/test infrastructure — and cite exact files and line
> numbers for everything they found. Where the code disagreed with the docs or with a
> stated assumption, the code won, and the discrepancy is called out explicitly rather
> than smoothed over. Line numbers will drift as the code evolves; treat them as
> "look near here," not permanent coordinates.

---

## How to read this document

It is long on purpose — "spare no detail" was the brief. You don't have to read it
front to back. **Part I** is the 15-minute version: what Booklet is and why it exists.
**Part II** is a glossary for anyone who wants precise definitions of terms used later
without re-deriving them. **Parts III–VII** are the actual textbook: architecture, the
application, the API ecosystem, operations, and — the part most internal docs skip —
*how this specific codebase makes engineering decisions*, illustrated with three real
RFCs it produced. Read those RFCs even if you skim everything else; they teach more
about how to think through a hard tradeoff than any abstract advice would.

---

# Part I — Orientation

## 1. What Booklet is

**One sentence:** Booklet is a free web tool that turns the Markdown a technical person
already writes into a clean, beautifully formatted page that a *non-technical* reader —
a PM, an exec, a customer — can open and read instantly, with no account required.

**The problem it solves.** Markdown is the default writing format for engineers:
READMEs, incident post-mortems, architecture decision records (ADRs), runbooks,
proposals, meeting notes. It's fast and structured for the person writing it. But
Markdown is meant to be *rendered*, not read raw — and the moment a `.md` file gets
forwarded outside the technical team (Slack, email, a support ticket), the asterisks
and hashes and backticks read as noise, not content. Every existing workaround has real
friction: Google Docs needs a Google account and isn't Markdown-native; Notion needs
workspace access; GitHub Gists render poorly for sharing and need a GitHub account to
create; Confluence needs corporate SSO; pasting into Slack destroys all formatting and
produces no permanent link.

**What Booklet actually does, step by step:**
1. You paste Markdown into a live split-pane editor at `/app`.
2. You see it rendered in real time (120ms debounce) exactly as a reader will see it.
3. You hit **Publish** (or press `⌘↵`). Booklet parses the Markdown server-side and
   stores it, generating a random 10-character page ID.
4. You get a public URL back in under a second: `booklet.ashwinsathian.com/p/Ab3k91QxZp`.
5. You send the link. The recipient opens a clean, well-typeset reading page — no
   login, no app, no friction, on any device.

**Positioning, precisely.** Booklet does not compete on "fastest anonymous Markdown
link" — that lane is crowded with near-identical tools. Its actual, narrower claim
(locked July 2026, `BRAND.md`): *it translates an engineer's Markdown into something a
non-technical reader can actually open and understand.* Speed and no-signup are real
and worth stating, but as supporting proof after that translation claim — never as the
headline.

**What it deliberately does not do** (`PRODUCT.md`, `BRAND.md` "Anti-Goals"):

| Omission | Why it's intentional |
|---|---|
| No real-time collaborative editing | Booklet is a publishing surface, not a co-editing surface — collaboration happens via the published link, the way handing someone a finished document does |
| No editing after publish | Published pages are immutable snapshots; the stability of a shared link *is* the feature |
| No rich text / WYSIWYG | Markdown only, by product decision — the formatting toolbar assists with syntax, it doesn't hide it |
| No raw HTML rendering in Markdown | A deliberate security boundary, not a missing feature — see §9 and §27 |
| No embedded media beyond external image URLs | No video/audio/iframe embedding of arbitrary content |
| No public search or content index | No public directory beyond an opt-in `/explore` page |
| No comments or reactions beyond 4 fixed emoji | Read-only for recipients by design |
| No mobile app | The web editor *is* the app |
| No Vercel deployment | Runs as a single PM2 process on a personal Mac behind a Cloudflare Tunnel — see §21 for the two-time journey to that conclusion |

**Anonymous vs. signed-in**, the only two tiers that exist (the product went
*fully free* in May 2026 — no paid plans, see §3):

| | Anonymous | Signed-in (free account) |
|---|---|---|
| Publish pages | ✓ | ✓ |
| Page lifespan | Permanent, no expiry | Permanent, no expiry |
| Pages per month | 10 per IP | Unlimited |
| Custom slugs, unlisted pages, view counts, password protection | — | ✓ |
| My Pages dashboard, version history, REST API + API keys, Team Spaces, webhooks | — | ✓ |

Anonymous pages are not a trial of a temporary product. They're stored exactly the same
way as owned pages and never auto-delete — the only anonymous-tier constraint is the
10-pages-per-month publish quota, enforced per-IP.

**The name.** A booklet is a small, finished publication — something bound and handed
to someone to read, not a rough draft. That's the exact transformation the product
performs. The product was originally named "Readable," and was renamed to Booklet in
July 2026 specifically to resolve a name collision with an unrelated, long-established
readability-scoring SaaS at readable.com. The rename is not fully finished internally —
§28 catalogs exactly where the old name still surfaces in code, config, and docs, since
that's a real and useful thing for a new contributor to know about.

## 2. The brand: Ink & Paper

> **2026-08-01 update:** This section describes "Ink & Paper" and its "The Reveal"
> follow-on, both since superseded by the "Precision" identity (monochrome, single
> amber accent, Geist Sans/Mono, motion-led differentiation via a cursor-aware
> spotlight, a command palette, and view-transitions). See `BRAND.md` for the current
> system and `docs/superpowers/specs/2026-08-01-precision-redesign-design.md` for the
> full rationale. The history below is preserved as-written since it's an accurate
> record of what happened at the time, not a stale claim about the present.

Booklet's stated design north star is **Apple-quality execution**, and the personality
is explicitly "a senior engineer who is also a great writer — direct, clear, no noise,
no filler." (`BRAND.md`) Concretely, that cashes out as a small number of hard rules,
not vibes:

- **Type is the product.** Every layout decision should make the *content* look better,
  not the chrome louder.
- **Three surfaces only.** Base → elevated → glass. No fourth background level, ever.
- **The accent color means action, only.** Never decoration, never a category color.
- **Dark-first.** Dark mode is the primary brand expression; light mode is verified
  against it, not designed independently.
- **One idea per section.** If you can't name a section's one idea, split or cut it.

**Why the palette changed (July 2026, "Ink & Paper" relaunch).** The prior palette —
near-black plus a single bright violet accent — was, on reflection, one of the most
common looks in AI-assisted/template-driven SaaS design of that era (the same lane as
Vercel-style monochrome-plus-accent). It photographed fine, but referenced nothing
about what a booklet actually *is*. The new system is literally named after its own
metaphor: **ink** (a deep oxblood/burgundy, `#a12f3e` dark / `#ab4252` light) **on
paper** (the near-black base, keeping the dark-mode premium feel that already worked)
**and paper** (`#f4ecdc`, a warm cream — the one place the system allows itself to say
"this is a bound document"). Every accent shade was chosen against a *measured* WCAG
contrast target, not eyeballed — `--color-accent` and `--color-accent-soft` are
deliberately different hexes in dark mode because a single burgundy can't simultaneously
be "readable as text directly on black" and "a legible white button label on top of it."

`--color-paper` is reserved for exactly two places in the entire product, on purpose
(diluting it anywhere else would make both feel like an accident rather than a choice):
the logo mark's folded page-corner, and a small rotated paper-colored tab peeking above
the "after" card in the landing page's before/after Markdown comparison
(`ProblemMock` in `src/components/marketing/Landing.tsx:504-508`) — "like a page you'd
flag to find again in a bound booklet."

**The logo mark**: a rounded-rectangle page with its top-right corner folded down —
literally "a page worth flagging and keeping." It replaced an earlier mark that reused
Markdown's own `#` heading glyph, which was a defensible choice for a product called
*Readable* but stopped making sense once the product's own name became about the
physical document rather than the source syntax. Two authorized tile treatments exist
(ink tile for in-product chrome, black tile for favicons/app icons/social avatars) —
see `src/components/ui/AppLogo.tsx` and `src/app/icon/route.ts` for the two live
implementations that must be kept in sync if the mark ever changes again.

**Voice rules**, concretely: short sentences, one idea at a time; confident
declarations, never hedged; concrete use cases ("incident reports, ADRs, READMEs"), not
vague abstractions; specific numbers ("under 30 seconds," "10-character ID"), never
meaningless superlatives. A standing blocklist of words the brand voice never
uses: *revolutionary, game-changing, disrupting, paradigm shift, all-in-one, end-to-end,
seamless, robust, powerful solution, leverage, synergy, we're excited to announce,
delighted to share, next-level, best-in-class.*

## 3. History and the major pivots

Booklet's architecture today is the *result* of two real, deliberate rollbacks — not an
unfinished migration. Understanding both is close to mandatory for making sense of why
the code looks the way it does.

### 3.1 Auth: Clerk → in-house (completed 2026-07-11)

Booklet originally used Clerk (`@clerk/nextjs`) for authentication — Google/GitHub/email
sign-in, session management, the works. An RFC (`PLAN-backend-auth-migration.md`,
status: **IMPLEMENTED**) proposed replacing it entirely with a self-hosted,
dependency-free system: email + password only, `argon2id` password hashing, DB-backed
opaque sessions.

**Why.** The RFC doesn't frame this as "Clerk was bad" — it frames it as removing a
third-party dependency in a product with no PII beyond email and no paid tier to
protect, in exchange for full control and zero per-MAU vendor cost. The investigation
that preceded the RFC found Clerk touching 37 call sites across 26 files, but also found
something that made the migration much cheaper than it looked: **the CLI, GitHub
Action, VS Code extension, and MCP server never touched Clerk at all** — they only ever
held an API key and called `/api/v1/*` over Bearer auth. The *only* place a live Clerk
session mattered outside the web app itself was the one page that minted a CLI API key
after checking `auth()`. That meant the migration could stay entirely inside the
Next.js app with zero changes needed to any of the four external integrations.

**Key decision: preserve Clerk user IDs as the new local user IDs.** Clerk IDs
(`user_2abc...`) are opaque random strings with no external meaning once Clerk is
gone — so the migration kept them as-is rather than remapping the `user_id` foreign key
across six MongoDB collections (`pages`, `collections`, `collection_members`,
`api_keys`, `webhooks`, `drafts`). This was, per the RFC, "the single biggest
scope-reducer."

**Key decision: DB-backed opaque sessions, not JWTs.** Every other credential in this
codebase (API keys, page-unlock tokens) already used a generate-raw-token →
hash-with-server-side-pepper → store-hash-only pattern. Sessions needed instant
revocation (logout, and a future "log out everywhere"), which a stateless JWT can't do
without a blocklist — and a blocklist is the DB-backed approach in disguise, just less
direct. So sessions follow the established pattern rather than inventing a new one.

**Key decision: argon2id for account passwords, PBKDF2-SHA256 for page-unlock
passwords — deliberately two different tiers.** Account passwords protect real user
data (pages, API keys, webhooks) and warrant the current OWASP-recommended memory-hard
KDF. Page-unlock passwords protect read-access to a single published document — a lower
stakes, pre-existing, unrelated design this RFC didn't touch.

**Production cutover, for the record.** At cutover time production had *zero* real
Clerk users (verified via Clerk's own API) — 91 real anonymous published pages existed
with no accounts, so the migration script ran as a genuine no-op against real data.
`docs/OPERATIONS.md` keeps the full cutover runbook not as history but because the same
sequence is what any future from-scratch server setup or disaster-recovery restore has
to follow. It also documents five real incidents the cutover surfaced and fixed — one of
which (a `redirect()` call accidentally caught by a local `try/catch`, silently breaking
every successful CLI login) only got caught by a real user report, not CI, because the
existing e2e suite didn't exercise the CLI's actual browser-driven login flow. That gap
is exactly what `scripts/production-verify/cli-mcp-verify.mjs` exists to close now (§24).

### 3.2 Infrastructure: Cloudflare Workers → plain Node/PM2 (removed 2026-05-25, re-evaluated 2026-07-23)

This is the pivot most worth understanding in depth, because it happened *twice* —
once as an actual removal, and once as a serious re-evaluation of whether to redo it —
and the second pass corrected real gaps in the first pass's own reasoning.

**What happened.** Booklet's backend originally ran on Cloudflare Workers via
OpenNext, with data in Cloudflare D1 (SQL) and KV. That was fully built, deployed to
real production, and then **deliberately removed** in commit `9254448`
("chore(infra): remove all Cloudflare Worker dependencies and CF-specific code",
2026-05-25) — not descoped, not left half-finished. `wrangler.jsonc`,
`open-next.config.ts`, `@opennextjs/cloudflare`, and all Workers-specific code were
deleted; `npm run deploy` was repointed at `scripts/redeploy.sh` (a local build + PM2
reload); the MCP server went from a Worker to a plain Node process. An internal audit
later assumed this looked like an *incomplete* migration — `docs/OPERATIONS.md`
explicitly corrects that assumption, since two of the app's own strategic docs
(`PRODUCT.md`, `PLAN.md`) still contained stale "Infrastructure: Cloudflare Workers"
claims at the time, which is very likely what misled the audit.

**Why it was likely abandoned** (inferred, not stated explicitly in the removal
commit): the app also migrated its entire data layer from Cloudflare D1/KV to MongoDB
around the same time, and MongoDB's standard Node driver needs a real, long-lived TCP
socket — something the Workers runtime of that era categorically didn't support the way
a normal Node process does.

**The second pass — a 2026-07-23 feasibility re-analysis.** Someone later asked
whether Workers + MongoDB Atlas could be redone "without compromise" and with a
permanently zero Cloudflare bill. The resulting document
(`PLAN-cloudflare-workers-feasibility.md`) is a genuinely excellent piece of engineering
writing, and it found that the *first* rollback's own stated reasoning ("Workers
doesn't support arbitrary outbound TCP") had actually become **outdated** by mid-2025 —
workerd gained real `node:net`/`node:tls` support, and the standard `mongodb` driver
does now connect to Atlas from inside a Worker. But re-deriving the problem from
scratch surfaced two load-bearing blockers neither the original removal nor the standing
internal docs had actually named:

1. **`argon2` is a native compiled addon** — it cannot run inside a Workers isolate at
   all, categorically, regardless of compatibility flags. A WASM reimplementation
   exists (`hash-wasm`), but that only solves *loading* it.
2. **Argon2id's own deliberate slowness (50–300ms) blows Cloudflare's Free-plan 10ms
   CPU cap by 5–30×, and that ceiling literally cannot be raised on Free** — it's a
   Paid-plan-only knob. There is no config fix. The two honest choices are downgrading
   the account-password KDF to something CPU-cheap (PBKDF2, ironically the exact tier
   this codebase already uses for the *lower-stakes* page-unlock passwords) or paying
   for Workers Paid ($5/mo) to keep argon2id — and the document is explicit that this
   is a security-posture tradeoff requiring an actual human sign-off, not something to
   silently decide inside an implementation PR.
3. A subtler, previously-uncaught problem: **Workers enforce per-request I/O
   isolation** — a TCP socket opened while handling request A cannot be reused while
   handling request B. This app's `src/lib/mongodb.ts` caches one `MongoClient` at
   module scope and reuses it across every request, which is the *correct* pattern for
   a long-lived Node/PM2 process and *breaks outright* under Workers. The real fix
   would be a Durable-Object-based connection-pool proxy — free-tier-compatible, but a
   genuine data-access-layer rewrite touching roughly 40 Mongo call sites, not a
   redeploy.

The document's honest conclusion: there is no version of "everything works exactly as
today, Workers-only, and costs nothing" that's actually true — the argon2 CPU ceiling is
a real fork in the road, not a paperable-over implementation detail. It lays out three
named options (A: rewrite + downgrade account-password KDF, B: rewrite + pay $5/mo, C:
leave the main app alone and only restore the MCP server as a Worker, since that
component has zero direct MongoDB coupling and is a clean win either way) and explicitly
declines to pick one without the product owner's sign-off. **As of this writing, no
implementation has started** — this is a live, honest "here are the tradeoffs, you
choose" document, not a completed migration.

**What's actually running today**, as a result of both passes: a single PM2 process
(`booklet-app`, fork mode, one instance) plus a second PM2 process (`booklet-mcp`) on a
personal Mac, both reverse-proxied to the public internet through a Cloudflare Tunnel.
Self-hosted MongoDB via Homebrew. No horizontal scaling, no automatic failover for
machine sleep/reboot/OOM/ISP outage. This is a single point of failure *by design*,
documented as such, with a named lower-lift fallback (PM2 cluster mode, `instances: 2+`,
zero new infrastructure) recommended as the next practical step if a real managed-host
migration isn't imminent. See §21 for the full deployment picture.

### 3.3 Monetization: phased pricing plan → fully free (direction change, May 2026)

`PLAN.md` — Booklet's engineering plan document — still contains an entire four-phase
monetization roadmap (quota systems, a `pricing` plan tier, Stripe billing, Team Spaces
gated behind a paid tier, an "upgrade gate" UI pattern) inherited from an earlier
strategic direction. **That roadmap is explicitly superseded.** A direction update
dated May 2026, preserved at the top of `PLAN.md` itself, states: *"Readable is fully
free. No paid plans, no upgrade prompts, no paywalls. All features — version history,
analytics, password protection, the API, webhooks, MCP — are available to all signed-in
users."* The monetization phases are kept in the document for historical context only.

This shows up concretely in the current code: `src/lib/quota.ts` today implements only
a simple two-tier **capability gate** (`FREE_LIMITS` vs `ANONYMOUS_LIMITS`), not the
metered multi-tier quota system `PLAN.md` describes — `UserPlan` is now literally the
single-value type `"free"`. Stripe billing code was removed; the `/pricing` page was
converted to a plain "free forever" feature list rather than a comparison table.
There's no `UpgradeGate` component anywhere in the current tree — a repo-wide search
confirms it, and the only trace of the abandoned plan is a single explanatory comment
at the top of `quota.ts`. This is a genuinely clean removal, not dead code left lying
around — worth noting because it's the opposite of what usually happens when a roadmap
gets abandoned mid-flight.

**The practical lesson for reading `PLAN.md`**: treat it as a historical narrative
document with one still-current section (the MCP server architecture reference at the
top) and one explicit direction-change notice, not as a literal description of the
running system. Where `PLAN.md` disagrees with `docs/OPERATIONS.md`, `README.md`, or
the actual code, the code and `docs/OPERATIONS.md` win.

### 3.4 Rich Markdown Blocks (implemented 2026-07-22)

The newest architectural addition is worth its own short history because it's a good
example of scoped, evidence-gated feature work — see §26 for the full case study. In
short: a widely-discussed essay argued that AI-generated review documents increasingly
need visual structure Markdown alone doesn't provide, and proposed raw HTML as the
fix. Booklet's RFC (`PLAN-rich-markdown-blocks.md`) rejected raw HTML outright (it would
reopen the exact XSS surface the renderer was built to avoid, on an anonymous,
unauthenticated, rate-limit-only publish flow) and instead shipped three new
**Markdown-native** block types — callouts, toggles, columns — plus a second diagram
language (Graphviz, alongside the existing Mermaid), all parsed into the same typed
`Block` AST the renderer already used, with zero new script-execution surface. Phase 5
(stat/dashboard blocks) was deliberately **not** committed, gated behind real adoption
data from the first four phases rather than built speculatively.

---

# Part II — Foundations

Skip this part if the vocabulary below is already familiar. It exists so later parts
don't have to stop and define terms mid-explanation.

## 4. Glossary

**Markdown / GFM** — Markdown is a plain-text formatting syntax (`# heading`,
`**bold**`, `` `code` ``) designed to be readable even unrendered. GFM (GitHub-Flavored
Markdown) is the specific, widely-adopted dialect that adds tables, strikethrough, task
lists, and autolinks on top of the original spec — it's what Booklet supports.

**AST (Abstract Syntax Tree)** — a structured, typed representation of parsed content,
as opposed to the raw text. Booklet never renders Markdown text directly; it parses
Markdown into an AST first (via the `unified`/`remark` ecosystem, producing an "mdast"
tree), converts *that* into Booklet's own simpler typed `Block[]`/`Inline[]` tree
(`src/lib/blocks.ts`), stores *that*, and renders *that* on every view. This detour
through a typed intermediate representation is the entire basis of Booklet's security
model — see §7 and §27.

**`unified` / `remark`** — a widely-used JavaScript ecosystem for building text-processing
pipelines as a chain of plugins. `remark-parse` turns Markdown text into an mdast tree;
`remark-gfm`, `remark-math`, and `remark-directive` are plugins that extend what that
parser recognizes (tables/strikethrough, `$math$`, and `:::directive` container syntax,
respectively).

**JWT (JSON Web Token)** — a signed, self-contained token format. Booklet uses JWTs
(via the `jose` library) specifically for *link-based, no-database, time-limited*
flows: team invites, the post-migration account-claim flow. It deliberately does
**not** use JWTs for regular login sessions — see the session design decision in §3.1
and §9.

**HMAC (Hash-based Message Authentication Code)** — a way to prove a piece of data
hasn't been tampered with, using a shared secret key. Booklet uses HMAC-SHA256
extensively: to hash session tokens and API keys before storing them (so a leaked
database doesn't hand out usable credentials), and to sign outbound webhook payloads
(so a receiver can verify a webhook really came from Booklet).

**Pepper** — like a password salt, but a single secret value shared across *all*
records of a type, stored only in server configuration (an environment variable),
never in the database itself. Booklet's pepper pattern (used for session tokens and API
keys): generate a random raw token, HMAC-hash it with the pepper, store only the hash.
Even a full database leak is useless for authentication without the pepper, which never
touches the database at all.

**argon2id vs. PBKDF2-SHA256** — both are password-hashing algorithms designed to be
deliberately slow (so brute-forcing a leaked hash is expensive). argon2id is the
current OWASP-recommended default — it's *memory-hard*, meaning it resists GPU/ASIC
acceleration, not just CPU-time brute force. PBKDF2-SHA256 is an older, CPU-only-slow
algorithm — still an accepted tier at high iteration counts, but weaker against
specialized hardware. Booklet deliberately uses both, at two different tiers: argon2id
for account passwords (protects real user data), PBKDF2 for page-unlock passwords
(protects read-access to one document — lower stakes).

**SSRF (Server-Side Request Forgery)** — an attack where a server is tricked into
making an outbound request to an internal/private address it shouldn't be able to reach
(e.g. cloud metadata endpoints, internal admin panels) by supplying a malicious URL to a
feature that fetches URLs on the server's behalf. Booklet's webhook feature is exactly
this kind of feature (user supplies a URL, server calls it later), so it has a
dedicated SSRF guard — see §9.

**CSRF (Cross-Site Request Forgery), specifically "login-CSRF"** — an attack where a
malicious site tricks your browser into submitting a request to a *different* site
using your existing credentials. "Login-CSRF" is the specific case where the forged
request is a *login* — tricking a victim's browser into authenticating as an attacker's
account, so the victim unknowingly saves data into the attacker-controlled account.
`SameSite=Lax` cookies stop a cross-site request from *sending* an existing cookie, but
don't stop a cross-site *login* POST from executing and setting a *new* cookie — which
is why Booklet adds an explicit `Origin` header check on top.

**Rate limiting vs. quota** — in this codebase, "rate limit" means a short fixed
window (e.g. 12 requests/minute), and "quota" means a longer fixed window (e.g. 10
pages/month) — both implemented by the *same* underlying mechanism (`src/lib/rate-limit.ts`),
just with different bucket sizes and limits.

**npm workspaces** — a way to manage multiple related npm packages inside one
repository with one root `package.json`/lockfile, so packages can depend on each other
by name and resolve instantly via symlinks during development, without a
publish-and-reinstall cycle. Booklet's repo is one workspace root covering `mcp-server`
and everything under `packages/*`.

**PM2** — a process manager for Node.js applications: keeps a process running, restarts
it on crash, manages logs, and can run multiple named "apps" (Booklet runs two:
`booklet-app` and `booklet-mcp`) from one config file (`ecosystem.config.js`).

**Cloudflare Tunnel (`cloudflared`)** — a way to expose a service running on a private
machine (here: a personal Mac with no public IP) to the public internet through
Cloudflare's edge network, without opening any inbound firewall ports. Booklet's
`booklet.ashwinsathian.com`, `booklet-api.ashwinsathian.com`, and
`booklet-mcp.ashwinsathian.com` are all routed through one tunnel to processes running
on `127.0.0.1`.

**MCP (Model Context Protocol)** — an open protocol that lets AI assistants (like
Claude) discover and call external tools over a standard interface. Booklet's MCP
server exposes "publish a page," "list your pages," etc. as MCP tools, so an AI
assistant can publish content to Booklet on a user's behalf during a conversation.

**JSON-RPC 2.0** — the request/response envelope format MCP itself is built on top of:
every call is `{jsonrpc: "2.0", method, params, id}`, every response is either a
`result` or a structured `error` with a numeric code.

**Next.js App Router vocabulary**, used throughout Parts III–IV without re-explaining
each time:
- **Server Component** — a React component that renders on the server only, can read
  a database or the filesystem directly, and never ships its own code to the browser.
  Most of Booklet's pages (the share page, `/my-pages`, `/admin`) are Server
  Components — this is *why* an authoritative auth check can live directly inside a
  page's own component code (§9.8) rather than needing a separate API call.
- **Client Component** (`"use client"`) — a component that *does* ship to and run in
  the browser, needed anywhere the UI has interactivity (the editor, toasts, the theme
  toggle). Booklet's published-page renderer is mostly Server Components; the editor at
  `/app` is almost entirely Client Components.
- **Route Handler** (`route.ts`) — the App Router's version of an API endpoint: a file
  that exports functions named after HTTP methods (`GET`, `POST`, `PATCH`, `DELETE`)
  instead of rendering a page. Every `/api/*` and `/api/v1/*` endpoint in this document
  is a Route Handler.
- **Edge runtime vs. Node.js runtime** — two different execution environments Next.js
  can run a Route Handler or Middleware in. The Edge runtime is lightweight and
  globally distributed but can't use arbitrary native Node APIs (no direct MongoDB
  driver access, for instance); the Node.js runtime is the full, normal Node.js
  environment. This distinction is *why* `src/middleware.ts` (which runs on the Edge
  runtime) can only do a cheap IP-allowlist check for `/admin`, while the actual
  session-and-database-backed check has to live in `src/app/admin/layout.tsx` (which
  runs as a Server Component under the Node.js runtime) instead — see §9.8.
- **Middleware** (`src/middleware.ts`) — one special file that runs before *every*
  matching request, on the Edge runtime, before any page or Route Handler. Booklet uses
  it for cheap, global checks only (security headers, the API-hostname split, the IP
  allowlist) — never for anything needing a database, for the runtime reason above.

## 5. Tech stack at a glance

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | React 19, TypeScript 5 (strict mode) |
| Styling | Tailwind CSS v4 | CSS-variable design tokens, dark-first |
| UI component library | PrimeReact | Theme synced to dark/light via a `MutationObserver`, see §10 |
| Animation | Framer Motion | Entrance/stagger animations only; hover states use plain CSS transitions |
| Markdown parsing | `unified` + `remark-parse` + `remark-gfm` + `remark-math` + `remark-directive` | See §7 |
| Diagrams | Mermaid (client-side) + `@viz-js/viz` (Graphviz-in-WASM, client-side) | Both sanitized before `innerHTML` insertion |
| Math | KaTeX | Client-rendered, library-sanitized output |
| Syntax highlighting | `highlight.js` core build, explicit per-language registration | Not the "all languages" bundle |
| Auth | In-house — email + password, `argon2id`, DB-backed opaque sessions | No third-party identity provider (Clerk removed, see §3.1) |
| Database | Self-hosted MongoDB (Homebrew) | One database, `booklet`, for everything — pages, users, sessions, analytics, etc. |
| Deployment | PM2 (two processes) on a personal Mac, behind a Cloudflare Tunnel | See §21 for the full story of how this was arrived at twice |
| Package management | npm workspaces (`mcp-server`, `packages/*`) | One root lockfile |
| CI/CD | GitHub Actions | Lint, typecheck, build, unit tests required; full browser e2e is manual-dispatch only |
| Analytics | Google Analytics 4 + a first-party `analytics_events`/`publish_events` MongoDB pipeline | Powers the internal `/admin` dashboard |
| Fonts | Inter (UI/chrome) + Source Serif 4 (published-page reading body) | Both self-hosted via `next/font` |

---

# Part III — Architecture

## 6. System architecture, end to end

```
                         ┌───────────────────────────────────────────┐
                         │              booklet-app (PM2)              │
                         │                 Next.js :3100                │
                         │                                              │
  Browser ──cookie───────▶  Server Components / session-cookie routes   │
  (booklet.ashwinsathian.com)     │                                     │
                         │        ▼                                    │
                         │   src/server/*  (ownership/validation        │
                         │   helpers — small, targeted, not a full      │
                         │   service layer, see §9)                    │
                         │        │                                     │
                         │        ▼                                    │
                         │   src/lib/db/*.ts  (Mongo collection         │
                         │   helpers)          ▲                        │
                         │        │            │ same underlying        │
                         │        ▼            │ functions               │
  CLI / GitHub Action /──Bearer──▶ /api/v1/* routes ──────┘              │
  VS Code / MCP server   key    (parse → resolveApiKey → db helpers)    │
  (booklet-api.ashwinsathian.com) │                                     │
                         └───────────────┬─────────────────────────────┘
                                         │ loopback HTTP / direct driver
                                         ▼
                              MongoDB (self-hosted, single "booklet" DB)

  booklet-mcp (PM2, :8788) ──HTTP (loopback, BOOKLET_API_BASE)──▶ /api/v1/*
    (booklet-mcp.ashwinsathian.com, stateless Streamable-HTTP MCP transport)

  All three public hostnames route through ONE Cloudflare Tunnel to
  127.0.0.1:3100 (booklet-app, serving two hostnames) and 127.0.0.1:8788
  (booklet-mcp). The split between booklet.ashwinsathian.com and
  booklet-api.ashwinsathian.com is enforced entirely in src/middleware.ts
  via a Host-header check — it is the SAME Next.js process on the SAME
  port, not two deployments.
```

Two structural facts fall out of this diagram that are easy to miss just reading
route-by-route code:

1. **There is exactly one source of truth for business logic** — the browser-facing,
   session-cookie-authenticated routes (`/api/publish`, `/api/pages/[id]`, etc.) and the
   API-key-authenticated `/api/v1/*` routes both ultimately call the same underlying
   database helpers. They are not two parallel implementations that happen to agree —
   though as §9 notes, the "service layer" extraction that was supposed to fully unify
   this is real but narrower in scope than an initial RFC proposed.
2. **Every external integration — CLI, GitHub Action, VS Code extension, MCP server —
   is a pure HTTP client of `/api/v1/*`.** None of them embed any auth logic, database
   access, or Markdown-parsing logic of their own. They all depend on one shared
   package, `booklet-api-client` (§16), for the request/response contract. This is why
   the Clerk migration (§3.1) could leave all four completely untouched.

## 7. The Markdown pipeline: from raw text to a rendered page

This is the technical core of the product, and also its primary security boundary. It
deserves the most careful explanation in this document.

### 7.1 Why an intermediate AST exists at all

The naive way to build "paste Markdown, render it" is: parse Markdown to HTML on the
server (or client), and drop that HTML into the page with `dangerouslySetInnerHTML`.
Booklet does not do this, anywhere, for user content — and that single decision is the
reason the product doesn't need an HTML sanitizer library, a Content Security Policy
carve-out for user content, or an ongoing sanitizer arms race.

Instead, the pipeline is:

```
raw Markdown string
      │
      ▼
unified().use(remarkParse, remarkGfm, remarkMath, remarkDirective)
      │   (produces an "mdast" tree — remark's own generic AST)
      ▼
visit(tree, "html", removeRawHtmlNodes)
      │   every literal HTML node in the source is spliced OUT of the tree here
      ▼
blocksFromChildren()  — src/lib/parse.ts
      │   walks the mdast tree and emits Booklet's OWN typed Block[]/Inline[] tree
      ▼
Block[] / Inline[]   (src/lib/blocks.ts — a closed, typed discriminated union)
      │   this is what gets STORED, and it is the only thing ever re-read
      ▼
BlockRenderer / InlineRenderer  (src/components/blocks/*)
      │   a big switch statement mapping each block "t" (type) to a specific
      │   React component — there is no generic "render this HTML" path at all
      ▼
Rendered page
```

Because `removeRawHtmlNodes` runs immediately after parsing and literally deletes every
raw-HTML mdast node from the tree (`src/lib/parse.ts`, using `unist-util-visit`'s
`SKIP` return value), **there is no code path by which arbitrary HTML a user typed can
ever reach the renderer.** It isn't escaped, it isn't sanitized — it's structurally
absent from the very data structure the renderer consumes. The renderer's `switch`
statement only knows how to build React elements for the finite set of `Block`/`Inline`
kinds Booklet itself defines (`heading`, `paragraph`, `list`, `quote`, `callout`,
`toggle`, `columns`, `code`, `table`, `hr`, `image`, `diagram`, `math`, `footnotes`).
There is no `"raw-html"` case in that switch, and there never has been one.

The two places `dangerouslySetInnerHTML` *does* appear in the whole render tree
(`CodeBlock.tsx` for highlight.js output, `MathDisplay.tsx`/`InlineMath.tsx` for KaTeX
output) are both feeding it the output of a *library* that generates its own
escaped/sanitized markup from a constrained input grammar (a code string, a LaTeX
string) — never the user's raw Markdown text directly. §27 covers the full threat model
this supports, including the one place a genuinely new sanitization concern was
introduced (Graphviz diagram SVGs) and how it was closed.

### 7.2 The `Block`/`Inline` type system

`src/lib/blocks.ts` defines the entire vocabulary of what a Booklet document can
contain, as a closed TypeScript discriminated union:

```ts
export type Inline =
  | { t: "text"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "del"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "link"; href: string; c: Inline[] }
  | { t: "image"; src: string; alt: string }
  | { t: "math"; v: string }
  | { t: "footnoteRef"; id: string; n: number };

export type Block =
  | { t: "heading"; level: 1 | 2 | 3 | 4; inl: Inline[] }
  | { t: "paragraph"; inl: Inline[] }
  | { t: "list"; ordered: boolean; items: ListItem[] }
  | { t: "quote"; blocks: Block[] }
  | { t: "callout"; kind: CalloutKind; blocks: Block[] }
  | { t: "toggle"; summary: string; blocks: Block[] }
  | { t: "columns"; columns: Block[][] }
  | { t: "code"; lang?: string; code: string }
  | { t: "table"; head: Inline[][]; rows: Inline[][][]; align: TableAlign[] }
  | { t: "hr" }
  | { t: "image"; src: string; alt: string }
  | { t: "diagram"; lang: string; code: string }
  | { t: "math"; display: true; code: string }
  | { t: "footnotes"; items: FootnoteItem[] };
```

A `PublishedDoc` — the thing actually stored per page — wraps this with a version
number, creation timestamp, per-document `DocSettings` (spacing, width, code-collapse
behavior, sans/serif typeface, a curated theme id), and *optionally* the original raw
Markdown string (added later, so older documents may not have it — this is why the
"Download Markdown" export option on the share page is conditional, per `PRODUCT.md`).

Two constants bound how large a parsed document can get, enforced **during parsing
itself**, not just at the API boundary — because *every* recursive consumer of the tree
(the renderer, the HTML exporter, the table-of-contents builder, the reading-time
estimator, the rich-block-usage tracker) walks it without its own independent depth
guard:

- `MAX_BLOCK_DEPTH = 32` — bounds nesting depth (a blockquote inside a toggle inside a
  callout inside a list, etc.)
- `MAX_BLOCK_COUNT = 20_000` — bounds total block count for a wide-but-shallow document

If either limit is hit, parsing doesn't throw — it stops and appends an explanatory
paragraph block noting the document was truncated. **`parseToBlocks` never throws,
under any input**, including pathological input that would otherwise blow the call
stack before the tree even finishes building — there's a catch-all wrapper around the
entire function that degrades to a single explanatory paragraph on any failure. Every
publish route, the patch/update routes, and the live editor's preview pane all depend
on this never-throw contract; it's the reason a malformed or hostile paste can't 500 the
publish endpoint or crash the live preview.

### 7.3 Rich blocks: callouts, toggles, columns, and a second diagram language

These four additions (the subject of the "Rich Markdown Blocks" RFC, §3.4 and §26) all
follow the same design constraint: **new syntax, not new HTML.** Each is detected from
plain Markdown-native conventions with real ecosystem prior art, parsed into a new
`Block` variant, and rendered with a dedicated React component — never through any kind
of raw-HTML passthrough.

- **Callouts** use the GitHub/Obsidian convention: a blockquote whose first line is a
  bracketed marker, `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!IMPORTANT]`, or
  `> [!CAUTION]` (case-insensitive). An unrecognized marker falls back gracefully to a
  plain `quote` block rather than erroring. Rendered by `Callout.tsx`, with icon and
  color per kind sourced from a single shared table (`src/lib/render-shared.ts`) so the
  live renderer and the static HTML exporter can never disagree on labels.
- **Toggles** (`:::toggle[Optional Summary]` ... `:::`) and **columns**
  (`:::columns` ... `:::`, split into 2–4 groups on top-level `---` separators inside
  the directive) use `remark-directive`'s `:::name` container syntax — the same
  convention Docusaurus/Astro Starlight use for admonitions and tabs. Toggles render as
  a real native `<details>`/`<summary>` element (`Toggle.tsx`) — not an HTML string
  injected anywhere, an actual JSX element. Columns render as a CSS grid (`Columns.tsx`),
  with the grid's column-count classes written as literal strings rather than a
  template literal specifically so Tailwind's static class scanner can see and generate
  them at build time (a dynamically-interpolated class name wouldn't survive Tailwind's
  build-time purge).
- **A second diagram language, Graphviz (`dot`/`graphviz` fences)**, alongside the
  existing Mermaid, compiled client-side via `@viz-js/viz` (Graphviz-in-WASM) — no
  server-side rendering dependency, matching the same client-side-only constraint
  Mermaid already followed. Because Graphviz's DOT language supports HTML-like labels
  that *can* carry arbitrary markup (including, in principle, `<script>` or event-handler
  attributes), its compiled SVG output is run through a dedicated sanitizer
  (`src/lib/svg-sanitize.ts`, `sanitizeCompiledSvg`) before being handed to
  `innerHTML` — a DOMParser-based sanitizer, deliberately *not* regex-based (the file's
  own comment explicitly calls out regex-based HTML sanitization as a known "mutation
  XSS" risk vector), stripping `<script>`/`<foreignObject>`/`<iframe>`/`<embed>`/`<object>`
  tags, all `on*` attributes, and restricting `href`/`xlink:href` to `#`, `http(s)://`,
  or `mailto:`. This closes the one genuinely new attack surface the rich-blocks effort
  introduced, mirroring the guarantee Mermaid's own `securityLevel: "strict"` setting
  already provided for years.

A container-recursion mechanism (`containerChildGroups()` in `blocks.ts`, walked
uniformly by a single shared `walkBlocks()` helper in `src/lib/block-tree.ts`) is what
lets the table-of-contents builder, the reading-time estimator, and the HTML exporter
all correctly descend into *any* nested container kind — quote, callout, toggle,
columns, footnotes — instead of each hand-rolling its own recursion (which is exactly
what caused a real, documented gap during rich-blocks development: the table of
contents originally only recursed into `quote`, so a heading nested inside a brand-new
callout block would render fine but silently vanish from the sidebar TOC with no
error).

Adoption of the new block kinds is tracked, not assumed — a lightweight counter
(`RICH_BLOCK_KINDS`/`collectRichBlockKinds()` in `block-usage.ts`) records which rich
block kinds appear in each publish event, specifically so a still-undelivered fifth
phase (stat/dashboard blocks — deliberately not committed, see §26) can be gated on
real usage data rather than built speculatively.

### 7.4 Two other notable parser behaviors

- **A false-positive fix for inline math.** `remark-math`'s single-`$` tokenizer can
  mis-pair two unrelated dollar amounts in one paragraph into one bogus math span (e.g.
  "*that costs $5 and this costs $10*" reading as a math expression between the two
  `$`s). Booklet detects the Pandoc-documented heuristic for this (a closing `$`
  immediately followed by a digit) and re-parses the affected fragment without the math
  plugin, recovering the literal dollar signs.
- **Footnotes** are collected up front (visiting `definition`/`footnoteDefinition`
  nodes before the main walk), resolved in reference order, and appended as a single
  trailing `{t: "footnotes", items}` block — with back-reference anchors wired up on
  render so clicking a footnote number jumps to its definition and back.

## 8. Data layer: MongoDB

Booklet runs one self-hosted MongoDB instance holding one database, `booklet`, with
roughly a dozen collections. `src/lib/mongodb.ts` caches the `MongoClient` connection
differently in dev vs. production for two different reasons worth understanding:

- **In development**, the client is cached on a `global` variable specifically so
  Next.js's Hot Module Reload doesn't open a fresh connection on every file save (a
  bare module-level variable would be re-initialized on every HMR reload).
- **In production**, it's cached in a plain module-level variable — appropriate now
  that the app is a long-lived Node/PM2 process with one connection per process
  lifetime, rather than a Cloudflare Worker where a "module-level" variable would have
  meant something different (a fresh scope per isolate) — see §6.

### 8.1 Collections

| Collection | Purpose |
|---|---|
| `users` | Account records — email, `password_hash` (nullable, for migrated-but-unclaimed accounts), `display_name`, `plan` (always `"free"`) |
| `sessions` | Opaque session tokens — see §9; TTL-indexed, expires automatically |
| `pages` | Metadata for *owned* pages — slug, title, visibility, collection/team id, view count, password hash, featured flag, parsed frontmatter. **Anonymous publishes never get a row here at all** — see §12 |
| `docs` | The actual content — `{_id: pageId, doc: PublishedDoc}` — every page, owned or anonymous, has exactly one row here |
| `api_keys` | Hashed API keys, see §9 |
| `webhooks` | User-registered webhook URLs + per-webhook signing secret |
| `collections` / `collection_members` | Personal page collections *and* Team Spaces — a team is a `collections` row with `is_team_space: true`, not a separate table (see §13) |
| `drafts` | Cloud-synced editor drafts (distinct from local-only `localStorage` drafts) |
| `page_versions` | Immutable version-history snapshots, one row per publish/patch |
| `reactions` / `reaction_state` | Per-page emoji reaction counts and per-browser-session dedupe state |
| `analytics_events` | View/scroll-depth/CTA-click events, TTL-expired after 90 days |
| `publish_events` | Internal funnel telemetry powering `/admin` — source (browser/api/cli/etc.), content-length bucket, rich-block-kind usage |
| `rate_limits` | Shared fixed-window counters backing both rate limiting and monthly quota enforcement |
| `view_dedupe` | Per-session view-count dedupe state |

Every index across all of these lives in one deliberately plain `.mjs` file,
`src/lib/db/index-specs.mjs` — plain JavaScript, not TypeScript, specifically because it
needs to be importable from two different runtimes with no shared build step: the
standalone `node scripts/setup-mongodb.mjs` bootstrap script, and `src/instrumentation.ts`
(which calls the same `ensureIndexes()` once automatically at server startup). Index
creation is idempotent and safe to call repeatedly.

### 8.2 Storage-layer decisions worth knowing about

- **`docs` has no TTL index.** Every published page — anonymous or owned — is kept
  indefinitely. This is a deliberate product decision (§1), not an oversight, and
  every publish/patch route re-derives the size limit from `src/lib/constants.ts` at
  write time rather than trusting a client-supplied size.
- **Sparse unique indexes need `$unset`, not `$set: null`.** The `slug` field on both
  `pages` and `collections` is uniquely but *sparsely* indexed — meaning `null` still
  counts as an indexed value under a sparse index, so clearing a slug by setting it to
  `null` would collide with every other cleared slug. The update helpers explicitly use
  Mongo's `$unset` operator to actually remove the field instead.
- **`snapshotPageVersion` uses a bounded compare-and-swap-via-retry loop**, not a
  single unguarded read-then-insert, specifically to close a real race condition: two
  concurrent publishes to the same page could otherwise both read the same "current max
  version number" and then both try to insert the same next version, one silently
  clobbering data if not caught. The unique index on `(page_id, version_number)`
  converts the second writer's insert into a catchable duplicate-key error, which
  triggers a retry (bounded at 5 attempts) with a freshly-read version number.
- **View counts and reactions use upsert-based idempotent dedupe**, not blind
  `$inc`, keyed by a per-browser-session hash — so a page refresh or a repeated
  reaction click doesn't inflate the count.
- **A regex-injection fix worth knowing about as a pattern, not just a fact**: an
  earlier version of the reactions lookup built a MongoDB `$regex` prefix query directly
  from an unvalidated route parameter (`pageId`). That's since been replaced with an
  equality match against an explicitly indexed `page_id` field, plus a defense-in-depth
  format check (`/^[0-9A-Za-z]{1,64}$/`) on the parameter itself before it's ever used
  in a query at all.

## 9. Auth, identity, and the security primitives underneath everything

This section documents the shared cryptographic patterns Booklet reuses across
sessions, API keys, page-unlock tokens, and team invites — because once you see the
pattern once, every individual mechanism becomes a variation on it rather than a new
thing to learn.

### 9.1 The core pattern: generate-raw → hash-with-pepper → store-hash-only

Every long-lived credential in this codebase — session tokens, API keys — follows
exactly the same recipe:

1. Generate a long, cryptographically random raw token (`createId(n)` in
   `src/lib/id.ts`, built on `crypto.getRandomValues`).
2. Hash it with HMAC-SHA256, keyed by a **server-only pepper** read from an environment
   variable (`SESSION_TOKEN_PEPPER` for sessions, `API_KEY_PEPPER` for API keys).
3. Store *only the hash* in the database. Hand the raw token to the client once (a
   cookie for sessions, a one-time-displayed string for API keys) and never again.

Because the pepper lives only in server configuration and never touches the database,
**a full database leak alone is not enough to authenticate as anyone** — an attacker
would also need the pepper, which is a separate secret in a separate place. Every
pepper-keyed module in this codebase is deliberately **fail-closed**: if its
environment variable is unset, the function throws rather than falling back to a
hardcoded or shared default. This is enforced for every one of `SESSION_TOKEN_PEPPER`,
`API_KEY_PEPPER`, `INVITE_JWT_SECRET`, `UNLOCK_TOKEN_SECRET`, and `CLAIM_TOKEN_SECRET` —
five independent secrets, each scoped to exactly one purpose, none of them sharing a
fallback value with any other.

*A fair question this raises*: session tokens and API keys are already long, random,
high-entropy strings — a plain unkeyed hash of one is effectively unforgeable on its
own (you can't brute-force or reverse a 40-character random token from its hash
regardless of whether a pepper is involved). So what does the pepper actually add, here
specifically, beyond the general "don't store secrets in plaintext" habit? Two concrete
things: first, **it's insurance against the token-generation code itself ever
regressing** — if `createId()`'s entropy were ever accidentally weakened in a future
change, a peppered hash would still be unforgeable without the pepper, where an
unkeyed hash would immediately become brute-forceable; the pepper makes token strength
depend on two independent things instead of one. Second, and more operationally
useful in practice: **a pepper is a single rotation point for mass revocation.** If a
database were ever suspected compromised, rotating `SESSION_TOKEN_PEPPER` alone
instantly invalidates every existing session across every user in one action, with no
need to touch per-user records — the same incident-response lever `API_KEY_PEPPER`
gives for every issued API key.

### 9.2 Sessions

- **Cookie name**: `booklet_session`. `httpOnly`, `SameSite=Lax`, 30-day max age.
- **`secure` flag derivation is a subtle, deliberate choice**: it's set based on
  whether the request carries `x-forwarded-proto: https`, *not* based on
  `NODE_ENV === "production"` — because `next start` always forces `NODE_ENV=production`
  regardless of whether the process is actually reachable over HTTPS (e.g. a local CI
  smoke test running `next start` over plain HTTP). Checking the forwarded-proto header
  correctly distinguishes "really behind the Cloudflare Tunnel" from "just running in
  production mode."
- **Sliding expiry, written back lazily.** A session's expiry is only refreshed once
  more than half its 30-day TTL has already elapsed — not on every single request —
  specifically to avoid a database write on every authenticated page load.
- **`getSession()`** reads the cookie, hashes it, looks up the hash, checks expiry, and
  conditionally refreshes it. It returns `null` — never throws — for a missing,
  expired, or forged session, which is why every protected route treats "no session"
  as the default, safe case.
- **"Log out everywhere"** (`destroyAllSessions(userId)`) deletes every session row for
  a user, including the caller's own — the mechanism that makes instant revocation
  possible, which a stateless JWT session design could not offer without an equivalent
  server-side blocklist (§3.1's key decision).

### 9.3 Passwords: two tiers, one file each

| | Account passwords | Page-unlock passwords |
|---|---|---|
| Algorithm | argon2id | PBKDF2-SHA256, 100,000 iterations |
| File | `src/lib/auth/password.ts` | `src/lib/password.ts` |
| Protects | Real user data — pages, API keys, webhooks | Read access to one published document |
| Why this tier | Current OWASP-recommended, memory-hard (GPU/ASIC-resistant) | An accepted, lower tier for a lower-stakes secret; a pre-existing, unrelated design |

Both `hashUserPassword`/`verifyUserPassword` and their page-unlock equivalents fail
*safe* on malformed input — a corrupted or foreign hash produces a verification
mismatch, not a crash.

### 9.4 API keys

Format: `bklt_` followed by 40 random characters (`src/lib/api-key.ts`). The prefix
`rdbl_` (from the pre-rename "Readable" name) is still accepted as a **legacy** prefix
for already-issued keys — new keys are never minted with it. Keys follow the exact same
generate-raw/hash-with-pepper/store-hash-only pattern as sessions, keyed by
`API_KEY_PEPPER`. `resolveApiKey(req)` (`src/lib/api-key-auth.ts`) reads the
`Authorization: Bearer <key>` header, validates its format, hashes it, looks it up, and
non-blockingly records last-used-at — this is the sole auth mechanism for every
`/api/v1/*` route.

### 9.5 The Origin-header check (login-CSRF defense)

`isSameOriginRequest()` (`src/lib/auth/origin-check.ts`) compares the `Origin` header
against the `Host` header and rejects a mismatch — applied specifically to
`/api/auth/login` and `/api/auth/signup` (not logout or claim, which don't need it: logout
is idempotent and low-risk, claim's own single-use token is itself the CSRF-equivalent
proof). As the glossary entry explains, this exists because `SameSite=Lax` alone stops
a cross-site request from *sending* an existing cookie but doesn't stop a forged
cross-site login POST from *executing and receiving* a new one. If the `Origin` header
is absent entirely, the request is allowed through — treated as coming from a
legitimate non-browser client (like the CLI or a script) rather than a browser subject
to CSRF at all.

### 9.6 SSRF defense on webhooks

Because webhooks are a "user supplies a URL, server calls it later" feature, they're
the one place in the app that needs a dedicated SSRF guard
(`src/lib/ssrf-guard.ts`). It maintains a hand-rolled denylist (not allowlist) of
non-routable/internal IP ranges — RFC1918 private ranges, loopback, link-local
(explicitly including the cloud-metadata address `169.254.169.254`), CGNAT, and IPv6
equivalents including embedded-IPv4 forms — and checks **every** DNS-resolved address
for a hostname, not just the first one returned. Two enforcement points exist, both
using the same check: at webhook *registration* time, and again immediately before
every *delivery*, specifically to defend against **DNS rebinding** — a hostname that
resolved to a public address when the webhook was registered but resolves to an
internal address by the time it's actually called. Delivery also uses `redirect:
"manual"` (a webhook receiver returning a redirect is treated as a delivery failure
rather than followed) — because *following* a redirect could route around the safety
check that had just been performed on the original URL.

### 9.7 Rate limiting and quota

One mechanism, `src/lib/rate-limit.ts`, backs both concepts — a fixed-window counter
per bucket, stored in the shared `rate_limits` collection, using an atomic
`findOneAndUpdate`-with-`$inc` (so concurrent requests can't race past the limit). Rate
limiting uses a one-minute bucket key; monthly quota (the anonymous 10-pages/month cap)
uses a year-month bucket key. Both reuse the same collection's single TTL index for
automatic cleanup.

Rate limits in effect today: 12 publishes/minute per IP on the browser-facing publish
route, 60 requests/minute per user on the API-key-authenticated `/api/v1/*` surface, 5
signup attempts/minute per IP, 10 login attempts/minute per IP *and* 5/minute per email
(layered), 5 page-unlock attempts/minute per page+IP composite key, 100 analytics
beacons/minute per IP, 30 reaction toggles/minute per IP.

### 9.8 Defense in depth on `/admin`

Two independent checks must both pass to reach `/admin`, deliberately layered rather
than relying on either alone:

1. **`src/middleware.ts`** — a cheap, Edge-runtime-safe IP allowlist check
   (`ADMIN_IPS`, comma-separated). This runs first and is fail-closed: an empty or
   unset allowlist means *nobody* passes, not "no restriction."
2. **`src/app/admin/layout.tsx`** — the authoritative check: a real session lookup
   (which needs a Node.js runtime and MongoDB access, which Edge middleware can't
   provide) plus a check against `ADMIN_USER_IDS`. Also fail-closed on an empty
   allowlist. It returns Next.js's `notFound()` rather than a 403 — deliberately, so an
   unauthorized visitor sees a plain 404 and doesn't even learn that `/admin` exists at
   all, since Server Components can't return a raw HTTP response with a custom status
   the way a Route Handler could.

The same "cheap non-authoritative check in middleware, real check where a database is
reachable" pattern repeats for `/my-pages`: middleware does a bare cookie-*presence*
redirect purely as a UX shortcut (no valid-session check, just "is there a cookie at
all"), while every actual `/my-pages` page independently calls `getSession()` as the
real gate.

## 10. The rendering layer and design system

`BlockRenderer.tsx` is the single component every published page and every live editor
preview routes through — one large `switch` over `Block["t"]`. A deliberate,
documented lesson shapes its lazy-loading strategy: only `DiagramBlock` (Mermaid and
Graphviz, both of which genuinely need a live DOM, and in Graphviz's case WASM) is
loaded via `next/dynamic(..., {ssr: false})`. `CodeBlock` (highlight.js) and
`MathDisplay`/`InlineMath` (KaTeX) are pure, synchronous string-transform components
that render correctly during server-side rendering and are imported eagerly — an
earlier version blanket-excluded all three from SSR, and a comment in the code
explicitly calls that out as a past regression (code blocks and math rendered invisible
in the server's initial HTML response, only appearing after client-side hydration).

The design system (`src/components/ui/`) is intentionally small: a polymorphic
`Button`, a portal-rendered `ToastProvider` with coalescing/dedup for rapid-fire
notifications, an `ActionDrawer` bottom-sheet primitive reused across export/publish/
more-actions menus, an `Icon` component backed by one inline SVG sprite (no external
icon library, no emoji in UI copy, per `BRAND.md`), a `SegmentedControl`, and a
`ThemeToggle` built on `next-themes` with an explicit SSR-hydration-mismatch guard.
PrimeReact (used for a handful of heavier components) has its own CSS theme file that
must independently track dark/light mode — `PrimeStyles.tsx` does this by watching the
`<html>` element's class list via a `MutationObserver` and swapping the PrimeReact
stylesheet `<link>` accordingly, since PrimeReact's theming isn't natively aware of
`next-themes`' class-based toggle.

One piece of UI worth flagging as an example of the product's own honesty norm: an
`AppLoader` component that shows a branding flash while the editor mounts used to
display four fake sequential "loading" status messages on a timer — a comment in the
current code explicitly calls that out as dishonest UX (there was nothing actually
happening in four stages) and it's since been simplified to a single, real,
`prefers-reduced-motion`-aware flash.

---

# Part IV — The Application

## 11. The route map

| Area | Path | What lives there |
|---|---|---|
| Marketing | `/` | Landing page — hero, before/after comparison, features, API pitch, integrations, templates, FAQ |
| Editor | `/app` | The split-pane Markdown editor (client component) |
| Share page | `/p/[id]` | The published, read-only rendering of a page — the actual product output |
| Embed | `/p/[id]/embed` | A stripped-down, iframe-embeddable variant with no chrome |
| Dashboard | `/my-pages` | Pages, API keys, webhooks, collections, analytics, version history — signed-in only |
| Admin | `/admin` | Internal metrics dashboard — funnel, retention, referrers — IP + user-ID gated (§9.8) |
| Explore | `/explore` | Opt-in public directory of featured pages |
| Templates | `/templates`, `/templates/[slug]` | ~20 starter documents, several with full SEO landing-page copy |
| Auth | `/sign-in`, `/sign-up`, `/claim`, `/cli-auth` | See §9 and §17 |
| Team Spaces | `/t/[slug]`, `/t/[slug]/admin`, `/t/join` | Public team page, owner-only admin, invite acceptance |
| Public profile | `/u/[id]` | Deterministic-hue avatar, no external gravatar dependency |
| Collections | `/c/[id]` | Public view of a personal page collection |
| API surface | `/api/*`, `/api/v1/*` | See §12 and §15 |

The share page (`src/app/p/[id]/page.tsx`) resolves either a canonical page ID or a
custom slug through the same lookup path, and its `generateMetadata` function is worth
calling out specifically: for a password-protected page, it returns deliberately
*generic, non-identifying* metadata — computed **before** any content is touched —
closing a real, previously-shipped bug where a locked page's real title and description
leaked through Open Graph/Twitter card meta tags even though the page body itself was
correctly gated. (`tests/unit/locked-page-metadata.spec.ts` is the regression test for
exactly this.)

## 12. The publish flow, end to end

There are three ways to publish content, and they deliberately share the same
underlying parser and storage functions while differing in what metadata gets attached:

**Browser, anonymous or signed-in** (`POST /api/publish`):
1. Rate-limited 12/minute per IP (best-effort — a rate-limiter failure never blocks a
   publish, since availability is prioritized over the limit itself here).
2. Session checked, but optional.
3. **Blocks are always derived server-side from the raw Markdown** — never accepted
   directly from the client. This is a deliberate hardening: an earlier design accepted
   a pre-built block tree from the client, which was a real stack-overflow
   denial-of-service vector (a malicious deeply-nested tree could be submitted directly,
   skipping the parser's own recursion guards).
4. Size-checked against a 600,000-byte cap (`STORAGE.maxDocBytes`).
5. If the requester is **not** authenticated, the monthly anonymous quota (10/IP) is
   checked — but this check is explicitly skipped for authenticated requests, so a
   signed-in user is never penalized by anonymous burst activity from the same IP.
6. A random 10-character ID is generated and the document is stored.
7. **If authenticated**: a `pages` metadata row is created, a version snapshot is taken,
   and webhooks fire. **If anonymous: none of that happens** — anonymous pages get a
   `docs` row and nothing else. No ownership record exists for them at all, which is
   also why an anonymous page can never appear in a dashboard, be edited in place, or be
   deleted via the API — the only "identity" an anonymous page has is its content and
   its ID.

**API key** (`POST /api/v1/publish`): always authenticated, rate-limited 60/minute per
user (not per IP, and this check is *not* best-effort — a limiter failure here throws
rather than silently passing). The one real behavioral difference: **frontmatter is
parsed and applied here**. If the raw Markdown's YAML frontmatter specifies a `slug`,
it's validated and collision-checked *before any database write happens at all* — a
deliberate fix for an earlier version of the equivalent UI code path, which applied an
unvalidated frontmatter slug with no feedback to the user if it silently failed.

**In-place edit of an owned page** (`PATCH /api/publish/[id]`): content-only —
metadata like slug and visibility go through a separate `PATCH /api/pages/[id]`
endpoint with a genuinely different contract. Notably, this preserves the *original*
`createdAt` timestamp across edits rather than resetting it, since the publish date
shown to readers is meant to reflect the page's actual first-publish history even as
its content changes.

Every successful publish or patch, across all three paths, fire-and-forgets a version
snapshot and (for signed-in users) fires configured webhooks — see §8.2 for the
concurrency-safe snapshot mechanism and §9.6 for the webhook delivery security model.

## 13. Team Spaces

Team Spaces are implemented as `collections` rows with `is_team_space: true` — not a
separate database table. This is a deliberate reuse, not a shortcut: personal
collections and team spaces share almost all of their access-control and CRUD logic,
and `getOwnedTeamSpace()` (`src/server/collections.ts`) is literally
`getOwnedCollection()` plus one additional `is_team_space` check.

The invite flow has no email-sending step at all, by design (§3.1's "no email
infrastructure for v1" decision) — inviting someone signs a 72-hour JWT (via
`INVITE_JWT_SECRET`) embedding the team ID and invited email, and returns a
shareable `/t/join?token=...` URL that the team owner copies and sends manually through
whatever channel they'd already use. When the invited person visits that link, the
server checks the JWT, redirects to sign-in if needed, and — importantly — verifies the
*signed-in* email matches the *invited* email (case-insensitively) before granting
membership, so a forwarded invite link can't be claimed by the wrong account.

Publishing a page *into* a team isn't a distinct "publish to team" endpoint — it's the
same generic collection-membership mechanism used for personal collections
(`POST /api/collections/[id]/pages`), requiring the caller to own both the collection
and the page being attached.

---

# Part V — The API & Ecosystem

## 14. Why the ecosystem exists, and its one shared contract

Booklet's product surface extends well past the web editor: a REST API, a CLI, a
GitHub Action, a VS Code extension, and an MCP server for AI assistants. All five of
these — including the web app's own client-side code — ultimately talk to one thing:
the `/api/v1/*` REST surface, authenticated by Bearer API key. And four of them (every
external client except the browser itself) share **one TypeScript package** for that
contract, `booklet-api-client`, so the request/response shapes are defined exactly
once and can't silently drift between clients.

## 15. The REST API v1 surface

All endpoints are under `/api/v1/` and authenticated via `Authorization: Bearer
rdbl_...` (documentation still shows the legacy prefix in places; both `bklt_` and the
legacy `rdbl_` prefix work).

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/publish` | Create a new page from raw Markdown (frontmatter honored) |
| `GET` | `/api/v1/pages` | List your pages, paginated |
| `GET` | `/api/v1/pages/:id` | Get one page (accepts a canonical ID or a custom slug) |
| `PATCH` | `/api/v1/pages/:id` | Update content and/or metadata (slug, visibility) |
| `DELETE` | `/api/v1/pages/:id` | Delete a page |
| `GET` | `/api/v1/keys` | List your API keys (session-cookie auth, not key auth — you can't manage keys with a key) |
| `POST` | `/api/v1/keys` | Create a new API key (raw value shown exactly once) |
| `DELETE` | `/api/v1/keys/:id` | Revoke a key |

**Publish example:**
```bash
curl -X POST https://booklet-api.ashwinsathian.com/api/v1/publish \
  -H "Authorization: Bearer bklt_..." \
  -H "Content-Type: application/json" \
  -d '{"raw": "# Hello\n\nThis is my page."}'
```

`booklet-api.ashwinsathian.com` is a dedicated hostname purely for external API
consumers — it is the exact same Next.js process and port as
`booklet.ashwinsathian.com`, split entirely by a `Host`-header check in
`src/middleware.ts`: any request to the API hostname for a path outside `/api/*` gets a
bare 404. The main hostname continues to serve both the UI and `/api/*` — the API
hostname exists to give external tools one stable, minimal-surface entry point rather
than as a genuinely separate deployment.

Error responses follow a consistent shape across the surface: `400` for malformed
input, `401` for a missing/invalid key, `403` for a valid key acting on someone else's
resource, `404` for a nonexistent resource, `413` for a document over the size cap
(currently 600,000 bytes stored; the API's own error message still cites an older
350KB figure in one place — a minor doc/behavior drift worth being aware of, not a bug
that affects functionality).

## 16. `packages/shared` — `booklet-api-client`

Published to npm as **`booklet-api-client`** (not `readable-api-client` — several
internal docs, including `README.md` and `docs/OPERATIONS.md`, still say the old name;
see §28). This package is the single place the `/api/v1/*` contract is defined: Zod
schemas for every request/response shape, plus a thin typed `fetch` wrapper
(`createClient({baseUrl, apiKey, source, fetchTimeoutMs})`). The `source` field is
sent as an `X-Booklet-Source` header and takes one of `"cli"`, `"github-action"`,
`"vscode"`, or `"mcp"` — this is how `/admin`'s publish-source breakdown metric knows
whether a page came from the browser, a script, or a specific integration.

It's built as **dual CJS+ESM output** — deliberately, because its consumers have
different constraints: the CLI and GitHub Action bundle it in as CommonJS (their
runtime environments have no `npm install` step at all, so everything must be inlined
into one file), while the MCP server and the main Next.js app resolve it normally
through `node_modules` as a long-lived process would. It's both an npm-workspace member
(for instant local resolution while developing all five packages together) *and* an
independently published npm package (so someone who installs just the CLI standalone
still gets it as a normal transitive dependency) — a deliberate dual-purpose choice
documented in the original migration RFC.

The client's own design note, worth internalizing if you're integrating against it: **it
throws on any non-2xx response or network failure** (`BookletApiError`, carrying the
HTTP status — `status: 0` specifically signals a network-level failure rather than an
HTTP error). Consumers that need non-throwing control flow (the CLI, for command exit
codes; the MCP server, for structured JSON-RPC error responses) each wrap it in their
own thin adapter rather than the shared client trying to serve every calling
convention itself.

## 17. The CLI — `booklet-cli`

Published to npm, confirmed live at v0.1.0: `booklet-cli`, bin name `booklet`. Built as
a single bundled CommonJS file via `tsup` (ESM was tried and rejected — the bundled
CommonJS output internally needs `require("events")`, which throws under pure ESM
without a require shim).

**Command surface:**

| Command | Flags |
|---|---|
| `booklet login` | `--key <key>` (non-interactive/CI), `--api-url <url>`, `--force` |
| `booklet logout` | — |
| `booklet whoami` | — |
| `booklet publish [file]` (`-` for stdin) | `--slug`, `--visibility`, `--update <id>`, `--watch`, `--open` |
| `booklet pages list` | `--json` |
| `booklet pages open <id>` | `--print` |
| `booklet pages delete <id>` | `-y, --yes` |

Config lives at `~/.booklet/config.json` (`0o600` file / `0o700` directory
permissions, re-tightened on every write to retroactively fix keys saved with looser
permissions by older CLI versions). `BOOKLET_API_KEY` and `BOOKLET_API_URL` environment
variables take precedence over the config file, which is what makes CI usage
(`booklet publish CHANGELOG.md`, no interactive login) work.

**Why the CLI defaults to the main hostname, not the API hostname** (unlike the GitHub
Action and VS Code extension, which both default to `booklet-api.ashwinsathian.com`):
`booklet login`'s browser flow opens `${base}/cli-auth`, which is a real *web page*, not
an API route — and `src/middleware.ts` restricts the dedicated API hostname to `/api/*`
paths only. The CLI is the one client that needs a base URL serving both a UI page and
the API, so it defaults to the hostname that does both.

**The login handshake, in detail** — worth understanding closely since it's a small,
well-designed local OAuth-like flow:
1. The CLI binds to an OS-assigned free local port and generates a 40-character random
   hex `state` value.
2. It opens `${base}/cli-auth?port=<port>&state=<state>` in the user's default browser
   (and prints the URL as a fallback for headless environments).
3. It starts a one-shot local HTTP server on that port and waits (5-minute timeout) for
   a `GET /callback?key=...&state=...` request.
4. Server-side, `/cli-auth` (`src/app/cli-auth/page.tsx`) requires an authenticated
   session (redirecting to sign-in and back if needed), mints a fresh API key labeled
   `"booklet-cli"`, and 307-redirects the browser to
   `http://127.0.0.1:<port>/callback?key=...&state=...` — deliberately plain HTTP to
   localhost, which is exempt from HSTS per the relevant RFC.
5. The CLI's local server receives that request, serves a static "you can close this
   tab" page immediately (so the browser doesn't hang), **then** validates that the
   returned `state` matches what it generated — rejecting with an explicit
   "State mismatch — possible CSRF" error if not — before accepting the key.
6. The received key is live-validated with one real API call (`listPages()`) before
   being saved, so `booklet login` never reports success for a key that doesn't
   actually work.

`--watch` mode uses `fs/promises`' async-iterator `watch()` API (not the older
callback-based `fs.watch`), debounces file-change events by 80ms to let an editor
finish writing, and always re-publishes via `PATCH` to the *same* page ID after the
first publish — so the shared link a team is watching never changes even as the file
underneath it does.

## 18. GitHub Action

`packages/github-action`, published to the GitHub Marketplace as an action consuming a
**committed** `dist/main.js` — GitHub's Node 20 action runner executes that file
directly with no install step, so every dependency (`@actions/core`,
`booklet-api-client`, `zod`) is bundled into it at build time, and CI explicitly guards
against the committed build going stale relative to source (`git diff --quiet` on the
`dist/` directory is a required check).

Inputs: `file` (required), `api-key` (required), `page-id` (optional — supplying it
switches to update-in-place), `visibility` (default `"unlisted"` — notably different
from the CLI's default of `"public"`), `base-url` (defaults to the dedicated API
hostname, since a GitHub Actions runner never loads a web page). Outputs: `url`, `id`.

The action's `action.yml` lives at `packages/github-action/` inside this same
repository — research for this document did not confirm a separate, independently
published GitHub Marketplace listing for it (worth verifying directly rather than
assuming, if you need to depend on it from another repo). The actual, current,
maintainer-endorsed way to publish from CI today is the plain-bash template committed
at `.github/examples/publish-to-booklet.yml`, which doesn't invoke the action at all —
it calls the CLI directly via `npx`:

```yaml
# .github/examples/publish-to-booklet.yml (illustrative excerpt — see the real file for the full trigger/setup)
- name: Publish to Booklet
  env:
    BOOKLET_API_KEY: ${{ secrets.BOOKLET_API_KEY }}
    PAGE_ID: ${{ vars.BOOKLET_PAGE_ID }}   # optional: update the same page/URL every run
  run: |
    if [ -n "$PAGE_ID" ]; then
      npx booklet-cli publish CHANGELOG.md --update "$PAGE_ID"
    else
      npx booklet-cli publish CHANGELOG.md --slug release-notes --visibility public
    fi
```

If you specifically want the `uses:`-step form (a real Action, with typed
inputs/outputs, rather than a shell script), reference it by path within this
repository (`AshwinSathian/booklet/packages/github-action@main` is the standard GitHub
syntax for an action living in a subdirectory of a public repo) rather than a
Marketplace slug, unless you've independently confirmed one exists.

## 19. VS Code extension

`packages/vscode`, contributing three commands (`Booklet: Publish Current File`,
`Booklet: Publish Selection`, `Booklet: Set API Key`) and two settings
(`booklet.defaultVisibility`, default `"unlisted"`; `booklet.baseUrl`, defaulting to
the API hostname). The API key is stored via VS Code's `SecretStorage` API — the OS
keychain — never in `settings.json`, matching the general principle that a credential
never lives in a place that gets synced/committed/shared by accident. Setting a key
validates it live before saving, but treats a network-unreachable API as non-blocking
("don't refuse to save a key just because the API was briefly unreachable — only a real
auth rejection should stop you").

## 20. The MCP server

The most architecturally interesting of the five integrations, because it went through
a real protocol-version overhaul worth understanding on its own terms.

**Current transport: stateless Streamable HTTP (MCP spec 2025-03-26)** — one POST per
request to `/mcp`, auth (an API key, exactly like every other `/api/v1/*` consumer)
re-validated on every single call, **no session state kept anywhere in the server**.
This is a deliberate architectural property, not a missing feature: an earlier
implementation used the older SSE transport with an in-memory session `Map` and a
keepalive-ping mechanism, and that in-memory approach was explicitly identified as
"broken across stateless [deployment] instances" and removed. The commit that made this
change (`e5a5184`, "feat(mcp): overhaul to Streamable HTTP, add Resources, Prompts,
get_page") also expanded the tool surface and added two new MCP protocol capabilities.

**Five tools**, not four (an easy assumption to get wrong from older docs):
`publish_page`, `update_page`, `get_page`, `list_pages`, `delete_page` — each backed by
one call into `booklet-api-client`, constructed fresh per-request (since the server
holds no persistent state across calls, there's nothing to reuse). Upstream calls to
the Booklet API time out after 10 seconds. Errors from the underlying REST API are
mapped to structured JSON-RPC application error codes — 401→unauthorized,
403→forbidden, 404→not-found, 413→document-too-large, 429→rate-limited — with the
original REST API's own error message passed through verbatim, specifically so an AI
assistant calling the tool gets an actionable message rather than a generic failure.

**Resources and Prompts** are the two capabilities added in the same overhaul that
weren't part of the original 4-tool design: pages are exposed as MCP Resources under
`booklet://pages/<id>` URIs (`mimeType: "text/markdown"`), and five built-in Prompt
templates (`incident_report`, `adr`, `release_notes`, `rfc`, `runbook`) return
ready-to-fill Markdown starting points an AI assistant can offer a user before ever
calling `publish_page`.

Underneath the MCP-specific logic, `src/node-server.ts` is a thin Node
`http.createServer` adapter that converts each incoming request into a Web-standard
`Request`/`Response` pair and hands it to a `fetch(request, env, ctx)` handler — the
same shape a Cloudflare Worker export uses. That's a deliberate leftover from the
component's Workers-era history (§3.2): the actual protocol logic never needed to
change when the deployment target moved from a Worker to a plain PM2-managed Node
process, only the thin adapter around it did.

---

# Part VI — Operations

## 21. Deployment topology

One Mac. Two PM2-managed Node processes. One Cloudflare Tunnel exposing three public
hostnames. Self-hosted MongoDB via Homebrew. That's the entire production
infrastructure, and it's the result of the two pivots documented in §3.2 — not the
starting design.

```
Internet
   │
   ▼
Cloudflare edge / Tunnel  (cloudflared, LaunchAgent-managed, auto-restarts)
   │
   ├── booklet.ashwinsathian.com ─────┐
   ├── booklet-api.ashwinsathian.com ─┤──▶ 127.0.0.1:3100  (PM2: booklet-app, fork, 1 instance)
   │                                  │
   └── booklet-mcp.ashwinsathian.com ────▶ 127.0.0.1:8788  (PM2: booklet-mcp, fork, 1 instance)

Both PM2 apps ──▶ self-hosted MongoDB on 127.0.0.1:27017 (Homebrew, no replica set)
```

`ecosystem.config.js` configures both apps with staged restart behavior (a short
restart delay, a minimum uptime before a restart counts as "successful," a cap on
restart attempts before PM2 gives up), separate log files per app, and — worth calling
out as a real historical bug fixed here — `booklet-mcp`'s startup script deliberately
invokes `tsx` via `npx` rather than a hardcoded path into `mcp-server/node_modules/`.
npm workspace hoisting can move `tsx` (a shared transitive dependency) to the
repo-root `node_modules` unpredictably across different `npm install` runs, and a
hardcoded path once caused a silent `ENOENT` crash-loop in production the moment
hoisting shifted underneath it.

A second, independent watchdog (`scripts/pm2-startup.sh`, run via a `launchd`
LaunchAgent at login) exists specifically because PM2's own `autorestart` gives up
after a configured number of restart attempts — the watchdog polls PM2's status every
15 seconds indefinitely and restarts either app if it's found not `online`, covering
the case where PM2 itself considered the app permanently failed.

## 22. The deploy pipeline and bootstrap scripts

**`scripts/redeploy.sh`** is the actual deploy mechanism, and it's designed around one
central idea: **never leave production in a worse state than before the deploy
started.**

1. Install dependencies (`npm ci`, covering all workspaces).
2. Build `packages/shared` first, specifically because `mcp-server` imports its
   *compiled* output — skipping this step doesn't fail the build, it fails silently
   later as a `MODULE_NOT_FOUND` crash in the MCP process.
3. **Copy** (not move) the current `.next` build directory to `.next.previous` before
   building — so the currently-running PM2 process never sees its own build directory
   disappear mid-request.
4. Build. If the build itself fails, the script stops immediately — nothing has been
   touched in a way that needs rolling back yet.
5. Reload both PM2 apps, wait 6 seconds to let them settle, then run
   `scripts/health-check.sh`.
6. **On success**: delete the backup, done.
7. **On failure**: restore `.next.previous` back over `.next`, reload PM2 again, wait
   again, and **re-run the health check a second time** to confirm the rollback itself
   actually left things healthy — not just assume it did. Either way, the script
   exits non-zero on any health-check failure, even after a successful rollback, so
   whatever triggered the deploy (the pre-push git hook, or a manual run) correctly
   reports the deploy as failed, even though live traffic has already been restored to
   a working state.

**`.githooks/pre-push`** wires this directly into the git workflow: a push that
includes `main` as a target ref synchronously triggers a full `redeploy.sh` run
*before* the push is allowed to complete (skippable with `git push --no-verify`, and
skipped automatically if PM2 isn't yet managing the app at all — e.g. on a fresh
machine that hasn't finished initial setup). This means, concretely: **pushing to
`main` on this project is deploying to production**, not just updating a remote
branch.

**`scripts/setup-server.sh`** is the from-scratch bootstrap for a brand-new machine —
idempotent throughout (every step checks existing state before acting). It installs
Homebrew/Node/MongoDB if missing, seeds MongoDB indexes, validates every required
production secret is present and non-placeholder in `.env.production.local` before
proceeding at all, builds the app, registers both PM2 apps and verifies they report
`"online"`, installs `cloudflared`, creates (or reuses, resolved strictly by UUID —
never by name, since name-based tunnel routing has a documented history of silently
routing to the wrong tunnel) a Cloudflare Tunnel, writes its ingress config mapping all
three public hostnames to the two local ports, registers DNS, and installs two
`launchd` LaunchAgents (one for `cloudflared`, one for the PM2 watchdog) so both
survive a machine reboot.

**`scripts/health-check.sh`** is what both `redeploy.sh` and `setup-server.sh` call to
decide "is this actually working," and it's meaningfully more thorough than a bare
"does port 3100 respond" check: MongoDB process + port reachability, PM2-managed
status for both apps (not just "a process happens to be listening," but specifically
*PM2-managed and reporting online*), the MCP server's own `/health` endpoint plus a
grep of its own startup logs to confirm it resolved the correct API base URL, the
Cloudflare Tunnel's LaunchAgent and live connector count, PM2's persistence dump,
git-hook configuration, and — the check that most directly proves the
`booklet-api.ashwinsathian.com` host-header split actually works end to end over the
live tunnel, not just in a unit test — that the API hostname returns `401` for an
unauthenticated `/api/v1/*` request and a bare `404` for anything outside `/api/*`.

**Data migration scripts**: `scripts/migrate-clerk-users.mjs` (the one-time Clerk→
in-house auth migration, §3.1 — idempotent, prints claim links, never touches a
password hash that's already set) and `scripts/migrate-from-atlas.sh` (a general Atlas↔
self-hosted MongoDB migration utility, using `mongodump`/`mongorestore` with a
per-collection count-diff sanity check afterward — deliberately leaves the dump files
on disk rather than auto-deleting them, on the theory that a completed migration is not
the moment to be automatically destroying your only recent backup).

**One piece of now-vestigial infrastructure worth knowing about**:
`scripts/stub-og.cjs`, still wired into `package.json`'s `postinstall` hook. It exists
to work around a Cloudflare Workers-era bundle-size problem (OpenNext's bundler pulling
in `@vercel/og`'s ~1.5MB WASM dependencies and pushing the Worker over Cloudflare's
free-tier 3MiB script-size limit, even though the app never used `ImageResponse` at
all) — a problem that stopped existing the moment the app moved off Workers back onto
plain Node (§3.2). It's harmless to leave running (it just neuters an unused API), but
it is dead weight relative to its original purpose, and a reasonable candidate for
cleanup precisely because it's a small, safe example of exactly the kind of
infrastructure debt a completed-but-not-fully-swept migration leaves behind.

## 23. CI/CD

Every pull request into `main` runs, as required gates: lint, a root TypeScript
typecheck, a matrix typecheck across every workspace package (building
`packages/shared` first, since every other package imports its compiled output), a
production build, a check that the GitHub Action's committed `dist/` output hasn't gone
stale relative to its source, and the full unit test suite against a real ephemeral
MongoDB service container (not a mock — nothing in this codebase mocks MongoDB
anywhere; every test that touches the database uses a real connection).

**Full browser end-to-end tests are explicitly *not* a required PR gate** — they only
run on manual workflow dispatch. This is a stated, deliberate tradeoff for a
solo-maintained project: the flake risk and wall-clock cost of full browser e2e on
every single push outweighs the value, for this team size, of blocking merges on it.
The CI secrets used for that manual e2e run are dedicated CI-only values, unrelated to
production secrets, backed by their own throwaway per-run MongoDB container.

Two auto-publish workflows (`publish-cli.yml`, `publish-shared.yml`) share an identical
pattern: trigger on a push to `main` touching the relevant package's `package.json` or
source, build it, check whether the *current* `package.json` version is already
published to npm (`npm view <pkg>@<version>`), and only publish if it isn't — i.e.
**publishing is driven by bumping the version number in a commit**, not by any manual
trigger. A third workflow, publishing the VS Code extension to the Marketplace,
intentionally no-ops (not a failing red build) if its required publisher token isn't
configured — reasoning explicitly documented in the workflow itself: a permanently red
check for a manual, one-time, account-owner-only setup step would just be noise on
every future push.

## 24. Testing strategy — three distinct layers, each solving a different problem

**Unit tests** (`tests/unit/`, ~24 files) reuse Playwright purely as a Node test
runner — no browser, no dev server — specifically to avoid adding a second test
framework (Jest/Vitest) just for pure-function and database-integration tests. Two
sub-categories exist: genuinely pure-function tests (parsing, slug validation, SSRF
IP-range checks, safe-redirect checks) and tests that open a real MongoDB connection
(session/API-key CRUD, version-snapshot concurrency, reactions). A striking number of
these tests exist as **regression tests for real, previously-shipped bugs** discovered
in production or during development — worth reading a few of them directly as case
studies in what actually goes wrong in a system like this:
- `unlock-token.spec.ts` — regression for a password-protected page whose unlock cookie
  used to be the unsigned literal string `"1"`, meaning `curl -H "Cookie:
  booklet_unlock_<id>=1"` bypassed the password entirely with no password ever entered.
- `locked-page-metadata.spec.ts` — regression for real content (title, description) of
  a locked page leaking through Open Graph tags before any password check ran.
- `reactions.spec.ts` — regression for a `$regex`-built-from-unvalidated-input query
  (§8.2).
- `versions-concurrency.spec.ts` — regression for the version-snapshot race condition
  (§8.2).

**Browser end-to-end tests** (`tests/e2e/`) drive real Chromium against a running app —
the full signup→publish→view→logout→login cycle, security regressions like an
`X-Forwarded-For` spoofing attempt *not* granting a fresh rate-limit bucket, and a
site-wide crawl (`console-errors.spec.ts`) checking every public route for any uncaught
JS exception or React hydration-mismatch warning — added specifically after a real bug
(a doubly-nested `<a>` tag causing a hydration failure) that a route-by-route testing
approach would have caught one page at a time instead of in one sweep.

**Production verification** (`scripts/production-verify/`) is a third, distinct
category most projects don't have at all: **manual, opt-in, self-cleaning tests that
run against the live production hostnames after a real deploy**, deliberately excluded
from CI and from the regular test directories. `prod-smoke.spec.ts` tags every account
and page it creates with a timestamped prefix and deletes precisely what it created in
an `afterAll` hook, explicitly never touching pre-existing production data.
`cli-mcp-verify.mjs` goes further — it spawns the *actual compiled CLI binary* as a
real child process with an isolated `$HOME` (so it never touches a real user's
`~/.booklet/config.json`) and a stripped `PATH` (so the CLI's own browser-opening logic
can't actually pop a browser tab on the machine running the check), and drives the
*real* browser-redirect login handshake end to end against production, plus the MCP
server's full JSON-RPC surface. This is precisely the layer that would have caught the
`redirect()`-inside-`try/catch` bug from the auth migration (§3.1) before a real user
hit it — and now exists so a *class* of bug like it gets caught automatically after
every deploy that touches CLI or auth code, not just the one instance that already
happened.

## 25. Environment variables, by purpose

Every required secret in this codebase follows the same convention: documented inline
in `.env.example` with its exact generation command, and **fails closed** (throws) if
unset — none of them has a fallback or default value.

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | The one required database connection string |
| `SESSION_TOKEN_PEPPER` | HMAC key for hashing session tokens before storage (§9.1–9.2) |
| `API_KEY_PEPPER` | HMAC key for hashing API keys before storage — rotating it invalidates every issued key |
| `CLAIM_TOKEN_SECRET` | Signs the post-migration account-claim JWT |
| `INVITE_JWT_SECRET` | Signs team-invite JWTs |
| `UNLOCK_TOKEN_SECRET` | Signs the page-unlock cookie token |
| `NEXT_PUBLIC_SITE_URL` | Canonical site origin — used to build correct shareable URLs even for requests arriving over an internal hop (§6, `src/lib/site-url.ts`) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics; blank disables it entirely |
| `ADMIN_IPS` / `ADMIN_USER_IDS` | Both required (and both fail-closed) for `/admin` access — see §9.8 |

---

# Part VII — Engineering Culture

## 26. How decisions get made here: reading an RFC as a case study

This codebase's most distinctive trait, more than any specific technology choice, is
**how thoroughly its own hard decisions are written down before they're built** — every
major change lives as a structured RFC with the same shape: Goals, Background,
Non-Goals, Architecture, Alternatives Considered (with an explicit Verdict per
alternative), Tradeoffs, Risks (scored by likelihood × impact), Phases with concrete
exit criteria, and Open Questions that are explicitly left open rather than
silently assumed. Three of these RFCs live in the repo root
(`PLAN-backend-auth-migration.md`, `PLAN-cloudflare-workers-feasibility.md`,
`PLAN-rich-markdown-blocks.md`) and are worth reading in full, not just summarized —
but here's what each one teaches as a *pattern*, independent of its specific subject:

**From the auth migration RFC**: the single biggest lesson is that investigating
*before* committing to scope can shrink a project dramatically. The RFC didn't start
from "replace Clerk" — it started from "where does Clerk actually touch this codebase,"
and that investigation found that four of the five things that would need to change
(CLI, GitHub Action, VS Code extension, MCP server) actually needed *zero* changes,
because they'd already been built as pure API-key HTTP clients with no direct
dependency on the auth provider. Scope was earned by evidence, not assumed from the
feature's name.

**From the Cloudflare Workers feasibility RFC**: the lesson is intellectual honesty
under pressure to give a simple answer. The person asking wanted a single yes/no on
"can we do this for free, without compromise" — and the honest answer, after real
investigation, was that those two constraints (zero cost, zero compromise) were
mutually exclusive in exactly one specific place (the argon2 CPU ceiling), and that
this needed to be surfaced explicitly for a human decision rather than silently
resolved either direction inside an implementation. The document also modeled genuine
intellectual revision: it re-examined its *own prior* removal's stated reasoning
("Workers can't do outbound TCP") and found that reasoning had gone stale, without
using that finding to paper over the *new* problems the re-investigation surfaced.
Being wrong-then-right about the easy part didn't get treated as license to be sloppy
about the hard part.

**From the Rich Markdown Blocks RFC**: the lesson is disciplined evidence-gating on
top of an already-good idea. The proposal responded to a real, externally-argued case
for more document structure — but rather than accepting or rejecting that case
wholesale, it decomposed a 20-example essay into what was actually "documents" (8
examples, addressable with static Markdown-native syntax) versus what was actually
"mini-apps" (12 examples, which would require exactly the raw-HTML/JS surface the
architecture had already rejected on security grounds) — and built only the addressable
40%. It then explicitly declined to build the next, riskier tier (stat/dashboard
blocks) until real usage data justified it, instrumenting adoption from day one of the
cheaper features specifically so that later decision wouldn't have to be a guess.

The throughline across all three: **alternatives get a named verdict, not just a
mention; risks get a likelihood × impact score, not just a list; and "we're not doing
this yet" is treated as a legitimate, explicitly-justified decision, not an
unaddressed gap.**

## 27. Security posture, as a single coherent model

Pulling every mechanism documented separately above into one picture, Booklet's
security model rests on four independent boundaries, each doing one specific job:

1. **XSS on published content** — closed structurally, not by sanitization. User
   Markdown is parsed into a closed, typed `Block`/`Inline` AST that has no
   "arbitrary HTML" variant; raw HTML nodes are deleted during parsing, before the
   tree that gets stored or rendered even exists (§7.1). The renderer's only two uses
   of `dangerouslySetInnerHTML` consume *library-generated* output from a constrained
   grammar (KaTeX, highlight.js), never user text directly. The one place a new,
   comparable risk was introduced later (Graphviz SVG output, which can carry
   HTML-like labels) got its own dedicated DOMParser-based sanitizer before shipping
   (§7.3).
2. **Credential storage** — closed by the pepper pattern (§9.1). Every long-lived
   secret (sessions, API keys) is stored as a hash keyed by a server-only pepper that
   never touches the database, so a full database compromise alone doesn't yield usable
   credentials. Every pepper-dependent module fails closed rather than degrading to a
   shared or hardcoded fallback.
3. **Login-CSRF** — closed by an explicit `Origin` header check on the two endpoints
   where a forged cross-site request could do real damage (§9.5), layered on top of
   (not instead of) `SameSite=Lax` cookies.
4. **SSRF via user-supplied URLs (webhooks)** — closed by a denylist-based IP-range
   check applied at both registration and delivery time, specifically to catch DNS
   rebinding between those two moments, plus a refusal to follow redirects during
   delivery (§9.6).

Two structural principles recur across all four: **defense in depth** (the `/admin`
gate, §9.8, requires two independent checks to pass; middleware-layer checks are
consistently treated as cheap UX shortcuts, never as the actual security boundary) and
**fail closed** (every credential-pepper module, the `/admin` allowlists, the anonymous
publish quota check) — an unset configuration value or an unexpected error state
consistently defaults to *denying* access rather than granting it.

## 28. Known rough edges — naming drift and small live bugs

Worth documenting explicitly, both because a future contributor will run into these
and because it's a realistic picture of what a mid-rename, actively-evolving codebase
actually looks like — not every corner of a real system is perfectly consistent, and
pretending otherwise would make this document less useful, not more polished.

**The Readable → Booklet rename is functionally complete but not textually complete.**
The product, the npm packages, the PM2 process names, the session cookie name, the API
key prefix, and the CLI's config directory are all correctly "Booklet" in the live
code. Several *documentation* references still say "Readable" in places, including:
`README.md` and `docs/OPERATIONS.md` both still describe the shared client package as
`readable-api-client` (its real, live npm name is `booklet-api-client`); CI's MongoDB
connection string still points at a database literally named `readable`; and
`docs/OPERATIONS.md` throughout uses `readable-app`/`readable-mcp`/`readable_session`/
`READABLE_API_BASE`, which are all now `booklet-*`/`BOOKLET_*` in the actual running
system. None of this affects behavior — it's a documentation-currency gap, not a code
bug — but it's exactly the kind of thing worth fixing the next time any of those files
are touched for another reason.

**Two small, real, currently-live bugs worth flagging** (found during code research,
not previously documented anywhere):
- `packages/cli/src/commands/auth.ts` reads `process.env.READABLE_API_KEY` (the stale
  pre-rename variable name) when deciding what to print as the key's *source* in
  `booklet whoami`'s output — the actual authentication path correctly reads
  `BOOKLET_API_KEY` (in `config.ts`), so this doesn't break auth, but `whoami` will
  always claim the key came from the config file even when it was actually supplied via
  the environment variable.
- `packages/vscode/src/commands/setApiKey.ts`'s input-box placeholder text still shows
  `rdbl_...` as the example key format; new keys are minted with the `bklt_` prefix
  (the legacy prefix still works, so this is cosmetic, but it's a misleading example
  for a new user copying a key from the dashboard).
- `scripts/production-verify/cli-mcp-verify.mjs` asserts a freshly-generated API key
  matches the *legacy* `rdbl_` prefix pattern rather than the current `bklt_` pattern
  used everywhere else (including the equivalent assertion in `prod-smoke.spec.ts`) —
  almost certainly a leftover from before the rename that the verify script's own
  regex wasn't updated alongside.

**Two components exist in the editor's source tree that aren't reachable from the UI**:
`TemplatesDialog.tsx` (a fully-built, two-panel template picker with a live preview)
has zero import references anywhere in `src/` — the template picker actually wired up
in the editor's "More" menu (`DrawerTemplatesView` inside `TopBar.tsx`) is a separate,
simpler, no-preview implementation. Similarly, the drafts-list UI is implemented
*twice* — once as a dialog (`DraftsDialog.tsx`, reachable via `⌘D`) and once as a
drawer view inline inside `TopBar.tsx` (reachable via the "More" menu), duplicating
nearly identical rename/duplicate/delete logic. Neither is a bug exactly — both live
code paths work — but they're a real, findable case of parallel implementations that
have drifted apart, worth consolidating.

**`scripts/stub-og.cjs`** is still wired into `postinstall` (§22) despite its stated
purpose (a Cloudflare Workers bundle-size workaround) no longer applying now that the
app runs on plain Node — harmless, but a clear artifact of the Workers-era migration
that a cleanup pass would reasonably remove.

None of the above is disqualifying or alarming — a solo-maintained, actively-evolving
product with this much surface area (five external integrations, three completed
infrastructure pivots, one abandoned monetization direction) *will* accumulate small
drift like this, and the fact that it's this easy to enumerate precisely is itself a
signal of a codebase that's legible rather than one where this kind of drift is hidden.

---

# Appendix A — File index by area

A quick-reference map from "I want to understand X" to "start reading here."

| If you want to understand… | Start with |
|---|---|
| The Markdown → AST parsing pipeline | `src/lib/parse.ts`, `src/lib/blocks.ts`, `src/lib/block-tree.ts` |
| How a page gets rendered | `src/components/blocks/BlockRenderer.tsx`, `InlineRenderer.tsx` |
| The publish flow | `src/app/api/publish/route.ts`, `src/app/api/v1/publish/route.ts`, `src/lib/storage.ts` |
| Sessions and passwords | `src/lib/auth/session.ts`, `session-token.ts`, `password.ts`, `claim-token.ts` |
| API keys | `src/lib/api-key.ts`, `src/lib/api-key-auth.ts` |
| Rate limiting and quota | `src/lib/rate-limit.ts`, `src/lib/quota.ts` |
| SSRF/webhook safety | `src/lib/ssrf-guard.ts`, `src/lib/webhook-delivery.ts` |
| MongoDB collections and indexes | `src/lib/db/*.ts`, `src/lib/db/index-specs.mjs` |
| The editor | `src/app/app/AppClient.tsx`, `AppShell.tsx`, `src/components/app/PasteInput.tsx`, `TopBar.tsx` |
| The design system / brand tokens | `src/app/globals.css`, `src/components/ui/*`, `BRAND.md` |
| Route-level auth gating | `src/middleware.ts`, `src/app/admin/layout.tsx` |
| The shared API client contract | `packages/shared/src/schemas.ts`, `client.ts` |
| The CLI | `packages/cli/src/index.ts`, `commands/auth.ts`, `commands/publish.ts` |
| The MCP server | `mcp-server/src/index.ts`, `tools.ts`, `auth.ts` |
| Deployment | `ecosystem.config.js`, `scripts/redeploy.sh`, `scripts/setup-server.sh` |
| Test strategy | `tests/unit/`, `tests/e2e/`, `scripts/production-verify/` |

# Appendix B — The three RFCs, one line each

- **`PLAN-backend-auth-migration.md`** — Clerk removed, replaced with in-house
  email+password auth. Status: implemented and cut over to production. Read for the
  session/pepper design pattern and for a model of scoping a migration by evidence.
- **`PLAN-cloudflare-workers-feasibility.md`** — a rigorous, unimplemented feasibility
  analysis of redoing the Cloudflare Workers migration this app already rolled back
  once. Read for a model of surfacing a real security tradeoff instead of silently
  resolving it.
- **`PLAN-rich-markdown-blocks.md`** — callouts, toggles, columns, and a second diagram
  language, added as a scoped, evidence-gated response to an external argument for
  richer document structure — explicitly not raw HTML. Status: phases 1–4 implemented;
  phase 5 deliberately deferred pending adoption data.

---

*This document reflects the codebase as researched on 2026-07-28. Line numbers and
exact file contents will drift; the architecture, the security model, and the
reasoning behind the major pivots are the durable part.*
