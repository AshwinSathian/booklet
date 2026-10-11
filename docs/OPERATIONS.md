# Operations notes

Punch-list style, not a full runbook. Written 2026-07 as part of closing out
an internal audit remediation effort. Updated 2026-07 with the in-house
auth migration (the original design RFC has since been removed from the repo;
this document is the durable operational record).

## Backups and restore

`scripts/backup-mongo.sh` runs nightly at 03:30 from launchd
(`scripts/com.booklet.backup.plist`). Log: `~/.booklet-deploy-logs/backup.log`.
The same run rotates the MongoDB log and deletes rotated logs older than 14
days.

It has two forms.

**Local (the default, no configuration).** A gzip `mongodump` archive goes to
`~/.booklet/backups`, and all but the newest 30 are deleted. This protects
against a bad migration or an accidental delete. It is on the same disk as
the database, so it does not protect against losing the disk.

**Off-site.** With `BACKUP_REMOTE` and `BACKUP_AGE_RECIPIENT` set in
`~/.booklet/backup.env` (mode 600), the archive is encrypted with `age` and
uploaded with `rclone`, to R2 or any other rclone remote. The script refuses
to send an unencrypted archive off this Mac. The private key is not needed
for backups and should not be stored next to the remote's credentials: with
it kept elsewhere, a leaked token exposes ciphertext only. Losing the
private key makes every archive unreadable, so keep a second copy of it
somewhere that is not this Mac. A failed run emails `BACKUP_ALERT_EMAIL`
through Resend and exits non-zero.

Restore the newest local archive over the live database:

```bash
LATEST=$(ls ~/.booklet/backups/booklet-*.archive.gz | sort | tail -1)
mongorestore --uri="mongodb://127.0.0.1:27017/?directConnection=true" --archive="$LATEST" --gzip --drop
```

These three commands do the same from the off-site archive. `--drop` replaces each collection that exists in the archive.

```bash
source ~/.booklet/backup.env
LATEST=$(rclone lsf --files-only --include "booklet-*.archive.gz.age" "$BACKUP_REMOTE" | sort | tail -1)
rclone cat "$BACKUP_REMOTE/$LATEST" \
  | age --decrypt --identity /path/to/age-private-key.txt \
  | mongorestore --uri="mongodb://127.0.0.1:27017/?directConnection=true" --archive --gzip --drop
```

The `mongorestore` URI must not name a database. Given one, it restores
only namespaces already in that database and reports success having
restored nothing.

**Restore drill.** `bash scripts/backup-restore-drill.sh -` (local archive)
or `bash scripts/backup-restore-drill.sh /path/to/age-private-key.txt`
(encrypted archive) restores the newest archive into a scratch
database (`booklet_restore_drill`), prints the `pages`, `docs` and `users`
counts beside production's, and drops the scratch database. Run it right
after a backup; anything published in between makes the counts differ.

## Monitoring

`GET /api/health` pings MongoDB and returns `{"ok":true}`, or 503 within 3
seconds if the database does not answer. The home page is static and
returns 200 with the database down, so it is not a useful probe.

The external monitor probes these every 5 minutes and emails on failure:

- `https://booklet.ashwinsathian.com/api/health`
- `https://booklet-api.ashwinsathian.com/api/health`
- `https://booklet-mcp.ashwinsathian.com/health`

`NEXT_PUBLIC_STATUS_PAGE_URL` in `.env.production.local` puts a "Status"
link in the site footer. It is read at build time, so changing it needs a
redeploy. `scripts/health-check.sh` also checks `/api/health`, which means
a deploy that cannot reach the database now rolls back.

**MongoDB version (outage of 2026-10-09).** The data files are at
`featureCompatibilityVersion` 8.0. On 2026-10-09 the `mongodb-community@7.0`
Homebrew service was started against them; 7.0 refuses 8.0 data files and
exits with code 62, and the site returned 500 on every database-backed page
until it was noticed on 2026-10-10. MongoDB must be started from the 8.0
launch agent, `~/Library/LaunchAgents/homebrew.mxcl.mongodb-community@8.0.plist`.
`brew services start mongodb-community@8.0` does not work (the formula has
no service definition), and the 7.0 formula should stay stopped or be
uninstalled.

## Keeping this Mac serving

Production is this one Mac (decision and reasons: `docs/adr/0001-hosting-platform.md`).
`bash scripts/health-check.sh` reports each item below under "Staying Up".

**Sleep.** A sleeping Mac drops the tunnel and every page returns 530.
`scripts/com.booklet.awake.plist` runs `caffeinate -ims` as a launch agent,
which needs no admin rights. The system-wide setting is better, because it
holds before login and without the agent:

```bash
sudo pmset -a sleep 0 disksleep 0 powernap 0
```

**Power cuts.** `sudo pmset -a autorestart 1` makes the Mac start again when
power returns. It then stops at the FileVault unlock screen (next item).

**Restarts need a person.** The disk is encrypted with FileVault and there is
no automatic login. MongoDB, PM2 and `cloudflared` are launch agents of the
logged-in user, so after any restart nothing serves until someone unlocks
the Mac at its keyboard. Three ways to live with that:

- Stop macOS installing updates and restarting by itself, and restart on
  purpose: System Settings, General, Software Update, Automatic Updates,
  "Install macOS updates" off. Then for a planned restart
  `sudo fdesetup authrestart` unlocks the disk once across that one reboot.
- Accept it. The uptime probe below tells you within about 20 minutes.
- Turn FileVault off and automatic login on. The site then survives a power
  cut unattended, and the disk, with the database and every secret in
  `.env.production.local`, is readable by anyone who takes the Mac.

**MongoDB.** Its launch agent has `KeepAlive` off, so launchd does not
restart `mongod` after a crash. The PM2 watchdog (`scripts/pm2-startup.sh`,
every 15 seconds) starts the 8.0 agent when nothing listens on 27017, at
most once a minute. Before stopping `mongod` on purpose (a repair, a
file-level restore), `touch ~/.booklet/mongod-maintenance`, and remove the
file afterwards.

**Noticing an outage.** `.github/workflows/uptime.yml` probes the three
health URLs from a GitHub-hosted runner every 10 minutes and fails the run
when one is down twice a minute apart. GitHub emails the person who last
edited the schedule. It has no status page and can start late; a real
monitor (see "Monitoring") is still the better answer. GitHub switches a
scheduled workflow off after 60 days with no commits to a public
repository; `.github/workflows/keepalive.yml` re-enables `uptime.yml` and
itself every Monday through the API, which also resets that clock.

**Logs.** The nightly job (`scripts/backup-mongo.sh`) rotates Booklet's two
PM2 logs: one over 5 MB is moved aside with the date, `pm2 reloadLogs`
makes PM2 reopen its files, and rotated copies older than 14 days are
deleted. Other apps on this Mac's PM2 daemon are not touched.

**After a restart**, once logged in:

```bash
bash scripts/health-check.sh
```

Everything should start by itself within a minute. If MongoDB did not, use
`launchctl start homebrew.mxcl.mongodb-community@8.0` and nothing else (see
"MongoDB version" below).

## Node.js runtime

Since 2026-10 production, CI and the publish workflows run Node 24 (`.nvmrc`).
Node 20 reached end of life on 2026-04-30.

- `ecosystem.config.js` names the interpreter for both PM2 apps
  (`~/.nvm/versions/node/v24.19.0/bin/node`), so the version does not depend
  on which Node the PM2 daemon was started under. `pm2 describe booklet-app`
  shows it. `scripts/redeploy.sh`, `scripts/pm2-startup.sh` and
  `.githooks/pre-push` put the same directory first on `PATH`. To move to a
  newer 24.x, install it with nvm and change that path in those four files.
- The `pm2` CLI itself can stay installed under another nvm version; the
  scripts search every nvm version for it.
- `jsdom` 30 and `eslint-config-next` 16 (with a native flat config) landed
  with this change. Both were reverted in 2026-09 for Node 20 reasons
  recorded under "Dependency audit" below. `eslint-config-next` 16 enables
  four rules that are switched off in `eslint.config.mjs` because the
  existing code has not been reviewed against them.
- `PORT` must stay set for `booklet-app` (see "How the 410 is produced").
- `pm2 reload` does not re-read `script` for a process PM2 already knows; it
  keeps the path it resolved at first start. After any change to `script` in
  `ecosystem.config.js` (the Node 24 change was one), run this once after
  the deploy. It drops both apps for a few seconds:

  ```bash
  pm2 delete booklet-app booklet-mcp && pm2 start ecosystem.config.js && pm2 save
  ```

**Data dropped with the 2026-10 cleanup.** The code stopped reading these in
v1.1.0. They were removed from production by hand, after a `mongodump`:

```js
db.pages.updateMany({}, { $unset: { featured: "", remove_attribution_badge: "" } })
db.reactions.drop()
db.reaction_state.drop()
```

A database restored from a backup taken before that date has them again;
they are harmless, and the same three commands remove them.

**Data dropped with 2.0.0 (2026-10-11).** Version 2.0.0 keeps one version
of each flow and reads nothing older. These were removed from production by
hand, after a `mongodump` (`~/.booklet/backups/booklet-pre-phase6-*.archive.gz`):

```js
// API keys issued with the rdbl_ prefix: the three labelled "readable-cli", created 2026-07-22.
db.api_keys.deleteMany({ label: "readable-cli", created_at: { $lt: "2026-07-23" } })
// The one page password in the 100,000-iteration format ("salt:hash", no count).
// The page stays locked; its owner sets a new password from My pages.
db.pages.updateOne({ _id: "vqInYRN7Gh" }, { $set: { password_hash: "reset:2026-10-11:set-a-new-password" } })
// Indexes the app used to drop at startup, and the superseded pages index.
db.collections.dropIndex("user_id_1_name_1")                                   // already gone in production
db.pages.dropIndex("featured_1_visibility_1_password_hash_1_created_at_-1")    // already gone in production
db.pages.dropIndex("user_id_1_created_at_-1")
// Read by nothing since My pages stopped scanning the publish log.
db.publish_events.dropIndex("user_id_1_created_at_1")
// Dynamic client registration is gone; the collection held two test clients.
db.oauth_clients.drop()
// My pages reads pages.last_source. Fill it once from the publish log.
db.publish_events.aggregate([{ $sort: { created_at: 1 } }, { $group: { _id: "$page_id", source: { $last: "$source" } } }])
  .forEach((r) => db.pages.updateOne({ _id: r._id }, { $set: { last_source: r.source } }))
```

`users.email` went from unique and sparse to unique. Nothing is run by hand
for that: `ensureIndexes` rebuilds an index whose options have changed, at
the first start of the new build.

Production had no user without an email and no draft in the schema-1
format on the server (that format only ever lived in browsers). A database
restored from an older backup needs the same commands run again. Removed
with the same release: `scripts/backfill-anonymous-expiry.mjs`,
`scripts/restore-frontmatter-raw.mjs`, the `dropIndex` list in
`src/lib/db/index-specs.mjs`, and `upsertUser`.

## Abuse reports and takedown

Every share page and embed links to `/report?page=<id>`. A report is stored
in the `reports` collection and emailed to `ABUSE_REPORT_EMAIL` (plain
text, through Resend). If that variable or `RESEND_API_KEY` is unset the
report is still stored, and a warning is logged.

To act on a report: open `/admin/reports` from an IP in `ADMIN_IPS`, signed
in as a user in `ADMIN_USER_IDS`. "Take down" sets `taken_down_at` on the
document and its page record, makes the page unlisted, and closes every
open report for that page. "Dismiss" closes the one report. From then on
`/p/:id`, `/p/:id/embed` and `GET /api/v1/pages/:id` return 410 with a
one-line notice. The document is kept, not deleted, and its owner can no
longer edit, re-list or delete the page (those requests return 410), so a
custom slug stays attached to the taken-down page.

There is no "restore" button. To reverse a takedown, unset the field by
hand:

```js
db.docs.updateOne({ _id: "<id>" }, { $unset: { taken_down_at: "" } })
db.pages.updateOne({ _id: "<id>" }, { $set: { taken_down_at: null } })
```

**How the 410 is produced.** A Server Component cannot return 410, and
`src/middleware.ts` runs on the Edge runtime with no MongoDB driver. So the
middleware calls `http://127.0.0.1:$PORT/api/pages/:id/gone` for each
`/p/...` request and answers 410 itself when that says the page is gone. If
the call fails or takes over 2 seconds the request continues, and the page
renders its own notice with status 200 instead. `PORT` must be set to the
port the app listens on (`ecosystem.config.js` sets 3100).

## Team spaces and team-only pages

A team space is a `collections` row with `is_team_space: true` and a slug.
A page is in a space when its `collection_id` is the space's id. Members
are `collection_members` rows; the space's owner is always a member.

`visibility: "team"` on a page means only its owner and the members of its
space can open it. `canViewPage` in `src/server/access.ts` is the one check,
and the share page calls `notFound()` when it fails, so a non-member gets
the same 404 as for a page that does not exist. The Markdown route
(`/p/<id>.md`) and the embed never serve a team-only page, to anyone.

A team-only page is not on Explore, tag pages, profiles, the sitemap or the
space's Atom feed: all of those select `visibility: "public"`. "Referenced
by" on a share page lists a page only to someone who could find it anyway
(`canListPage`).

If the space is deleted, or stops being a team space, its team-only pages
can be opened by their owners alone. Nothing makes them unlisted.

To see who can open a page:

```js
const p = db.pages.findOne({ _id: "<id>" }, { visibility: 1, user_id: 1, collection_id: 1 })
db.collection_members.find({ collection_id: p.collection_id }, { user_id: 1, email: 1, role: 1 })
```

**Invites.** `POST /api/teams/:id/invite` returns a link signed with
`INVITE_JWT_SECRET`, valid for 72 hours. `/t/join` accepts it only from an
account whose email is the invited address, and, where email is configured,
only once that address is confirmed. Removing a member adds their address
to `collections.invite_revocations`, which cancels the links sent to that
address before the removal. Other people's unused links keep working. An
address the owner listed before it had a confirmed account is a
`collection_members` row with `user_id: "pending:<email>"`; it grants
nothing, and its role is applied when that person joins by invite.

**Links between pages.** `page_links` holds one row per `[[Title]]` that
resolved when the source page was published (`src/server/links.ts`). Links
are resolved again when the source page's visibility changes, because a
public page may only link to public pages. They are not when a target's
title or visibility changes; that waits for the source to be published
again. Deleting a page removes its rows.

**Document types.** Frontmatter `type` is stored as `pages.doc_type`
(indexed) and the other fields in `pages.frontmatter_meta`. Pages published
before 2026-10-10 from the editor have neither until they are published
again; they sit under "Other pages" in a space.

## Anonymous page expiry

A page published without an account gets `docs.expires_at` = publish time +
90 days and is served until then. `src/instrumentation.ts` runs a purge one
minute after each start and every 24 hours after that; it deletes documents
more than 30 days past `expires_at` that have no `pages` record.

The publisher's browser holds a `booklet_claim_<id>` cookie. With it, the
share page shows the expiry date, and after sign-in a "Keep this page"
button that creates the page record and removes `expires_at`.

Anonymous pages published before 2026-10-10 were given an `expires_at` of
2027-01-08 at that deploy. They have no claim cookie, so nobody can claim
them from the site. To keep one, give it
an owner by hand before it expires:

```js
db.docs.updateOne({ _id: "<id>" }, { $unset: { expires_at: "" } })
```

## Running tests on this Mac

`src/lib/mongodb.ts` always uses the database named `booklet`, whatever
database name is in `MONGODB_URI`. Production's MongoDB is on this Mac at
port 27017, so `npm run test:unit` with the default URI reads and writes
production data. Point tests at a separate `mongod`:

```bash
mongod --dbpath /tmp/booklet-test-db --port 27018 --bind_ip 127.0.0.1 &
MONGODB_URI="mongodb://127.0.0.1:27018/booklet?directConnection=true" npm run test:unit
```

Production also serves from this checkout: `next start` reads `.next/` here
and the MCP server runs from `mcp-server/src`. Running `next build` or `next
dev` in this directory replaces files the live site is reading. Build and
run feature branches in a separate `git worktree`.

## Accounts: verification, provider sign-in, passkeys, Turnstile

All four are in `src/server/verification.ts`, `src/server/sso.ts`,
`src/server/passkeys.ts` and `src/lib/turnstile.ts`. Each is off until its
settings exist, and the app runs without any of them.

**Email verification.** On whenever `RESEND_API_KEY` is set. An account
whose `users.email_verified_at` is empty can sign in and write drafts. It
gets 403 (`code: EMAIL_UNVERIFIED`) when it publishes or updates a page,
through the editor, an API key or an OAuth token, and when it creates an API
key, authorizes the CLI or approves an app. The link is mailed at signup and
at the first sign-in after that, works for 24 hours, and is confirmed by a
button on `/verify-email` (a POST, so a mail scanner opening the link
confirms nothing). The button only works while signed in to the account the
link was sent for: otherwise the owner of an address could be led into
confirming an account whose password someone else chose. Finishing a
password reset also verifies the address, and is the way back for someone
whose address was registered by another person.

Accounts that existed before this shipped were not exempted (owner decision,
2026-10-10): each has to confirm once. To verify one by hand:

```js
db.users.updateOne({ email: "<address>" }, { $set: { email_verified_at: new Date().toISOString() } })
```

**GitHub and Google sign-in.** A provider's button appears only when both
`<PROVIDER>_CLIENT_ID` and `<PROVIDER>_CLIENT_SECRET` are set
(`.env.example` has the callback URLs to register). Identities are in
`user_identities`. A sign-in whose verified email matches an existing
account is linked to it, but only if that account's own address is
verified. Otherwise the sign-in is refused with an explanation: whoever
created the account may not be the address's owner, and linking would hand
them the owner's sign-in. The person signs in with the password and
confirms the email, or resets the password, and then connects the provider
from Account settings. On an install with no mail configured no address is
ever verified, so providers are always connected from Account settings.
An unverified account cannot add a passkey or a webhook, and can only
connect a provider account that has its own email address.

**Passkeys.** Added from `/settings/account`, used from the sign-in page.
The relying-party ID is the hostname in `NEXT_PUBLIC_SITE_URL`, so passkeys
stop working if the site moves to another hostname. Stored in `passkeys`
(public key and counter only).

**Turnstile.** On when both `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and
`TURNSTILE_SECRET_KEY` are set. It guards anonymous publish, signup and the
report form; the API, CLI and MCP server are not affected. The site key is
read at build time and adds `challenges.cloudflare.com` to the CSP, so
changing it needs `npm run deploy`. If Cloudflare's verification endpoint
cannot be reached, those three forms refuse until it can: remove
`TURNSTILE_SECRET_KEY` and reload PM2 to switch the check off.

**Account page.** `/settings/account`: change or set a password (signs out
other browsers and disconnects apps), connect or disconnect providers, add
or remove passkeys, disconnect an app that signed in through OAuth, download
every page as a ZIP of Markdown files, and delete the account. Deletion
removes the user's pages, versions, drafts, API keys, webhooks, sessions,
identities and passkeys, and the team spaces they own; other people's pages
in those spaces stay with their owners. A page that was taken down is kept,
without an owner, so its URL goes on answering 410 and its slug stays
taken. The export leaves taken-down pages out.

`/p/<id>` for a page that does not exist now answers 404. It used to answer
200 with a "doesn't exist" notice.

**Changing an email address.** Account settings, "Email address". A link
goes to the new address (`email_verification_tokens`, with `change: true`)
and the account moves when it is confirmed from that account's session; the
address it left is told by mail. An account with a password must type it.
An address that is another account's gets the same answer and no mail.
Without `RESEND_API_KEY` the address changes at once. Team invites are
bound to the address they were sent to, so one sent to the old address no
longer admits the account.

**Pinned OAuth clients.** `OAUTH_STATIC_CLIENTS` is a JSON array of Client
ID Metadata Documents. A client listed there is used as written and its URL
is never fetched. Unset in production: Claude.ai's document is fetched.

## Auth: in-house (Clerk removed)

**Current state:** Email + password, with optional GitHub and Google
sign-in and passkeys (see the section above).
Passwords are hashed with `argon2id` (`src/lib/auth/password.ts`). Sessions
are opaque, DB-backed tokens (`sessions` collection, TTL-indexed, 30-day
sliding window), hashed with an HMAC pepper before storage — the same
generate-raw/hash-with-pepper/store-hash-only pattern already used for API
keys (`src/lib/api-key.ts`) — and delivered via an httpOnly/Secure/
SameSite=Lax cookie (`booklet_session`). See `src/lib/auth/session.ts`.

**Required env vars** (fail closed if unset, no fallback — see
`.env.example` for generation commands): `SESSION_TOKEN_PEPPER`,
`PASSWORD_RESET_TOKEN_PEPPER`. `ADMIN_USER_IDS` is a comma-separated list of
user IDs.

**Admin gating is split across two layers**, not one: `src/middleware.ts`
does a cheap, Edge-safe IP allowlist check (`ADMIN_IPS`) only; the
authoritative session + `ADMIN_USER_IDS` check lives in
`src/app/admin/layout.tsx`, which needs Node.js runtime for the Mongo-backed
session lookup. Both must pass. `/my-pages`'s cookie-presence redirect in
middleware is similarly non-authoritative — the real check is
`getSession()` inside each page/route.

**Email delivery.** `src/lib/email.ts` sends mail through Resend
(`RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`): the password-reset link, abuse
reports to `ABUSE_REPORT_EMAIL`, the backup-failure alert, and the
email-verification link.

## Auth cutover (2026-07-11)

The move from the third-party sign-in provider to in-house auth ran against
production on 2026-07-11. Production had zero accounts with that provider
and 91 anonymous published pages, so the user migration was a no-op. The
migration flow (the `/claim` page, `POST /api/auth/claim`,
`src/lib/auth/claim-token.ts`, `scripts/migrate-clerk-users.mjs`,
`CLAIM_TOKEN_SECRET`) and `scripts/migrate-from-atlas.sh` were deleted in
2026-10. They are in git history at commit `1839525` if a record is needed.
`CLAIM_TOKEN_SECRET` can be removed from `.env.production.local`.

**Incidents found and fixed during this cutover** (all verified against live
production afterward):
- `ecosystem.config.js` hardcoded `mcp-server/node_modules/.bin/tsx`, which
  npm workspace hoisting had moved to the repo root — `booklet-mcp` (then `readable-mcp`) was
  silently crash-looping (`Script not found`) from the moment this
  session's workspaces conversion ran `npm install`. Fixed by resolving
  `tsx` via `npx` instead of a hardcoded path.
- `scripts/redeploy.sh` and `scripts/setup-server.sh` both still ran
  `npm ci --prefix mcp-server`, which requires a lockfile workspaces
  deleted — every real deploy from that point would have failed at that
  step. Removed; the root `npm ci` already covers it.
- `cloudflared tunnel route dns <NAME> <hostname>` routed
  `booklet-api.ashwinsathian.com` to the *wrong* tunnel on the first
  attempt (a different project's tunnel happened to share a name-resolution
  quirk) — `scripts/setup-server.sh`'s own header comment already warned
  about this exact pitfall and uses UUIDs for this reason; the live
  troubleshooting session didn't, hit it, and fixed it with
  `-f <TUNNEL_UUID>` instead.
- Every `/api/v1/*` route (and the outbound webhook payload) built its
  `url`/`page_url` from the request's own origin — correct only when called
  directly from a browser/external client, and *wrong* whenever a request
  arrives over an internal hop, which is exactly what the MCP server does
  (`BOOKLET_API_BASE=http://localhost:3100`, loopback, no tunnel round
  trip). A page published through the MCP server got back
  `"url": "http://localhost:3100/p/..."`. Fixed centrally in
  `src/lib/site-url.ts`'s `getSiteOrigin()`. `/api/publish` (the browser
  route) already had a narrower version of this fix from an earlier
  incident — see the "Publish URL bug fix" note this doc's sibling files
  reference — but it was never extended to `/api/v1/*`, and was itself
  inconsistently applied (the webhook payload didn't use it even there).
- `src/app/cli-auth/page.tsx` created the CLI's API key and then called
  `redirect(callbackUrl)` **inside** the same `try` block as the key
  creation. Next.js's `redirect()` (from `next/navigation`) works by
  throwing an internal `NEXT_REDIRECT` error that the framework's own
  machinery catches further up the render tree — wrapping it in a local
  `try/catch` swallows that throw instead, so the `catch` rendered
  "Something went wrong" on *every single successful login*, not just
  failures. The API key was actually created correctly each time; the
  browser just never got redirected back to the CLI's local callback
  server, so `booklet login` hung until its 5-minute timeout. Found live
  from a real user report (not caught by CI, since the existing e2e suite
  didn't exercise `booklet login`'s real browser-driven flow). Fixed by
  moving `redirect()` outside the `try` block. Verified against production
  with `scripts/production-verify/cli-mcp-verify.mjs` — see below.

## Adversarial security review (2026-09-05)

Full-surface adversarial review (web app, `/api/v1` + webhooks, the Mongo
data-access layer, the CLI, the MCP server, app UI, and infra scripts) —
seven scoped passes, each hunting a different surface for auth bypass,
injection, IDOR, and SSRF. Verified with `tsc`, `eslint`, the full unit
suite, a production build, and live browser testing (including publishing
pages with Mermaid/KaTeX/Graphviz content) before and after each change.
Confirmed clean: token/session handling, page/collection/team ownership
checks, and the Markdown→HTML rendering pipeline (dedicated XSS/prototype-
pollution/YAML-injection hunt came back with nothing exploitable — the
block-tree-based renderer already closes the classic "sanitize source, get
bypassed by re-parse" bug class).

**Fixed:**
- `packages/cli/src/fmt.ts`'s `openUrl()` built a shell command string from
  a server-returned URL and ran it via `exec` — a malicious/compromised API
  server could achieve RCE on `booklet publish --open` / `pages open`.
  Switched to `execFile` with an argv array (no shell spawned at all) plus
  an http(s)-only scheme check. Published as `booklet-cli@1.0.2`.
- `src/app/cli-auth/page.tsx` minted a live API key and redirected to
  `http://127.0.0.1:<port>/callback?key=...` on a bare GET — a hidden
  `<img>`/cross-site navigation to that URL, with no user interaction, was
  enough to exfiltrate a fresh key to an attacker-chosen local port for any
  signed-in visitor. Rewritten as an explicit confirmation screen; the key
  is now only minted by a same-origin POST from a real button click
  (`POST /api/auth/cli-authorize`, new file).
- `src/app/api/auth/claim/route.ts` (deleted 2026-10 with the rest of the
  migration flow) was the one session-minting endpoint
  missing the `isSameOriginRequest` check every other one
  (login/signup/reset-password) already has — a login-CSRF gap.
- `src/lib/webhook-delivery.ts`'s DNS-rebinding defense re-checked the
  hostname immediately before delivery but then handed the URL to `fetch`,
  which re-resolves DNS independently — two separate lookups a few ms
  apart, exploitable by an attacker's own authoritative DNS answering each
  one differently. Rewritten to resolve once (`resolveHostForDelivery` in
  `src/lib/ssrf-guard.ts`) and pin the actual TCP connection to that
  address via `node:http(s)`'s `lookup` option.
- NoSQL operator injection: `analytics/view`, `collections/[id]/members`,
  and `teams/[id]/members` typed JSON body fields via `as` casts with no
  runtime check, so `{"$ne": null}` could land as a query operator instead
  of a string. Added runtime type guards at the route layer and in
  `removeCollectionMember` (`src/lib/db/index.ts`).
- Webhook/API-key creation limits (`MAX_WEBHOOKS`, `MAX_KEYS_PER_USER`) used
  a non-atomic count-then-insert, so concurrent requests could exceed the
  cap. Added a re-count-and-compensate step after insert in all three
  creation paths (`api/webhooks`, `api/v1/keys`, `api/auth/cli-authorize`).
- `src/middleware.ts`'s CSP allowed `'unsafe-eval'` in production for no
  reason (nothing in the codebase calls `eval`/`new Function`) and had no
  `Strict-Transport-Security` header at all. Dropped `unsafe-eval` (kept
  `wasm-unsafe-eval` for `@viz-js/viz`'s WASM Graphviz renderer) and added
  HSTS. `'unsafe-inline'` on `script-src` stayed until 2026-10-11, when the
  policy moved to a per-request nonce with `'strict-dynamic'` (see "Content
  Security Policy" below).
- Raw DB/driver error messages (`e.message`) were forwarded straight to API
  clients on several unhappy paths (`api/publish`, `api/v1/publish`,
  `api/pages/[id]`, `api/v1/pages/[id]`) and in the shared `toErrorResponse`
  helper (`src/server/errors.ts`, used by 14 routes) — could leak internal
  driver detail on a genuine DB failure. All now log server-side and return
  a fixed generic message.
- Page deletion left `analytics_events`/`reactions`/`reaction_state`/
  `publish_events` rows orphaned (never a real authz issue given
  `createId()`'s keyspace, but real data hygiene debt). Added
  `deletePageAssociatedRecords` (`src/lib/db/index.ts`), wired into both
  delete routes.
- A team could claim the slug `join`, permanently shadowing it behind the
  static `/t/join` invite-acceptance route. Added a reserved-slug check
  (`src/app/api/teams/route.ts`).
- `src/lib/svg-sanitize.ts` didn't strip SMIL elements (`<set>`/`<animate>`
  etc.) — a known sanitizer-bypass class, not currently reachable through
  Graphviz's DOT grammar (the only producer of this SVG) but shouldn't rely
  on that. Added to the denylist.
- Page-unlock password hashing (`src/lib/password.ts`) was fixed at 100k
  PBKDF2 iterations, below current OWASP guidance. Bumped to 600k with the
  iteration count now encoded in the stored hash (`iterations:salt:hash`).
  The older two-part format stopped verifying in 2.0.0.
- `scripts/migrate-from-atlas.sh` (deleted 2026-10)'s dump directory (a plaintext copy of the
  full production DB) was created with default permissions; now `chmod
  700`. Also warns when the Atlas URI is passed via argv, visible to other
  local users via `ps`/`/proc` for the process's lifetime.

**Noted, not changed** — architectural/acceptable trade-offs, not bugs: the
CSP nonce overhaul above; the MCP server's mutating tools have no human-in-
the-loop confirmation against prompt injection from page content read back
into the same session; `setup-server.sh`'s Homebrew `curl | bash` and
auto-`eval` of `pm2 startup`'s output are standard one-time local-admin
setup patterns; `health-check.sh`/`redeploy.sh`'s `eval "$*"` is only ever
called with hardcoded strings today (a latent foot-gun, not a live path).

**Deploy pipeline bug found while pushing the above** (2026-09-05): the
pre-push hook's `pm2 jlist` guard silently reported "PM2 does not have
booklet-app — skipping redeploy" on a real push to `main`, even though PM2
was demonstrably running `booklet-app`/`booklet-mcp` at the time — `pm2`
lives under a specific nvm Node version (`v20.19.5`) that isn't on PATH for
whatever shell git happens to invoke the hook with, and the hook conflated
"can't find the pm2 binary" with "this isn't the production host." Both
`.githooks/pre-push` and `scripts/redeploy.sh` now fall back to scanning
installed nvm Node versions for a `pm2` binary (same approach
`pm2-startup.sh` already used for the launchd watchdog) before deciding.
Verified by reproducing the exact failure and confirming the hook then
finds `pm2` and proceeds. The fixes from this review sat undeployed on
`main` for a few minutes before this was caught and `redeploy.sh` was run
manually — worth knowing this class of "push succeeded, hook silently
no-op'd" failure could recur for a different missing-binary reason.

## Dependency audit (2026-09-05)

`npm audit` found 13 vulnerabilities (1 low, 3 moderate, 9 high) after the
security review above; several were on real attack surface, not just build
tooling — `js-yaml` (frontmatter parsing takes untrusted YAML: quadratic
CPU DoS via `!!omap`, CVE-2026-59870, fixed at 4.3.1+), `mermaid`/`dompurify`
(prototype pollution + CSS injection in the diagram renderer), `next` itself
(middleware/proxy bypass, Server Actions DoS + SSRF), and `mongodb`.

`npm update` (safe, in-range for every caret-ranged dependency) closed 10 of
the 13 outright. The remaining `next` (exact-pinned, no caret) was bumped
16.2.10 → 16.3.4 — a minor version per npm's own `isSemVerMajor: false`
assessment, and it transitively fixed the `sharp`/`postcss` entries too
(both bundled by Next). `react`/`react-dom` (exact-pinned) went 19.1.5 →
19.2.8 (an official minor; checked `useId()`'s output-format change
specifically since it's the one documented behavioral difference — the
codebase's one `useId()` call is an SVG gradient id referenced by the same
render, format-agnostic, so unaffected). Left one low-severity `esbuild`
advisory open — Windows-dev-server-only arbitrary file read, and this
codebase only ever runs esbuild as tsup's bundler on macOS, never its dev
server; an `overrides` entry to force a patched version didn't actually
take for this deeply-nested transitive path, and forcing it further isn't
worth the effort for a non-exploitable low.

**Two bumps reverted after breaking things — both caught by testing under
the actual target Node version, not assumed safe:**
- `eslint-config-next` 15.4.6 → 16.3.4 (to match the `next` major already
  in use) crashed `eslint` outright (`TypeError: Converting circular
  structure to JSON` inside `@eslint/eslintrc`'s config validator,
  incompatible with the current `eslint.config.mjs`'s `FlatCompat` shim).
- `jsdom`/`@types/jsdom` 29/28 → 30 (dev/test-only) installed and typechecked
  fine, and even *passed the full unit suite* — but only because that first
  verification pass ran under this machine's default shell Node (v24). A
  follow-up push's CI run (Node 20, matching `NODE_VERSION` in `ci.yml` and
  what production actually runs under) failed outright: jsdom 30 bundles an
  `undici` that calls `webidl.util.markAsUncloneable`, which doesn't exist
  on Node 20 — `require('jsdom')` throws immediately, before any test even
  runs. jsdom 30's own `engines` field says `^22.22.2 || ^24.15.0 ||
  >=26.0.0`; `npm install`/`npm ci` only *warn* (`EBADENGINE`) on an
  unsatisfied engines range rather than failing, so this shipped past local
  verification undetected. Reverted to 29/28. **Lesson applied**: every
  verification step for this dependency pass was re-run explicitly under
  `$HOME/.nvm/versions/node/v20.19.5/bin` (the CI/production
  version at the time; it is Node 24 now) before calling any of it confirmed, not just under whatever
  Node happens to be active in the current shell.

**Deliberately left on their current major** — no CVE driving any of these,
and each carries real regression risk for a cosmetic "newer version exists"
result: `typescript` (5.9 → 7.0, skips 6.x entirely, used across every
workspace), `commander` (12 → 15, `packages/cli`'s argument parser — a
published tool real external users run), `@napi-rs/keyring` (1 → 2,
`packages/cli`'s OS-keychain wrapper for the stored API key), `argon2`
(0.44 → 0.45, account password hashing — no advisory, and a botched bump
here risks locking out real users). `@types/node` was *not* bumped to its
`latest` (26.x) despite `npm outdated` suggesting it — this project's
runtime was Node 20.x at the time, so 26.x types would describe API surface
that doesn't exist on the machine running this code. (`@types/node` moved to
24.x with the runtime in 2026-10; see "Node.js runtime" above.)

Verified with `tsc`/`eslint`/the full unit suite across every workspace,
a production build, and a live browser pass (KaTeX display + inline math,
Mermaid, and the WASM Graphviz renderer all re-tested end to end on both
the editor preview and a real published page) — zero console errors.
`packages/cli` and `packages/shared`/`booklet-api-client` don't depend on
any of the packages this fixed, so neither needed a version bump or
republish this round.

## booklet-api.ashwinsathian.com

Dedicated hostname for external API consumers (CLI, GitHub Action, MCP server), added alongside the cutover. It is **not** a
separate backend service or process — same `booklet-app` PM2 app, same
port 3100, routed through the same Cloudflare Tunnel
(`~/.cloudflared/booklet-config.yml`) under a second hostname.
`src/middleware.ts` enforces the separation: requests with
`Host: booklet-api.ashwinsathian.com` get a 404 for anything outside
`/api/*`. `booklet.ashwinsathian.com` is unchanged and still serves both
the UI and `/api/*` (the web app's own client-side code calls same-origin
`/api/*` routes, and `booklet login`'s browser flow needs a UI page on
whatever base the CLI uses — see `packages/cli/src/config.ts`'s comment for
why the CLI deliberately keeps the main hostname as its default while
the GitHub Action, which never loads a web page, defaults to the API
hostname). `scripts/health-check.sh` checks both that the hostname routes
correctly *and* that it actually rejects a non-API path, not just that DNS
resolves.

## Deploying

`npm run deploy` (`scripts/redeploy.sh`) is the whole deploy. In order: `npm
ci`; a copy of every build output (`.next`, `packages/shared/dist`,
`packages/cli/dist`); a build of every workspace that has one, then the
app; a PM2 reload of both processes; `scripts/health-check.sh`; and both
production-verify suites against the live hostnames.

| Exit | Meaning |
|---|---|
| 0 | Live, healthy, verified |
| 1 | Health check failed. The previous builds were restored (or could not be: read the log) |
| 2 | Live and healthy, and a verify suite failed. Nothing was rolled back |

`SKIP_VERIFY=1 npm run deploy` skips the suites, for when the tunnel or npm
is known to be down. The log is in `~/.booklet-deploy-logs/`.

A rollback restores builds. It does not restore source: the MCP server runs
from `mcp-server/src`, and the checkout stays at the new commit.
`~/.booklet/deployed-commit` holds the commit of the last deploy that passed
its health check, and the rollback log prints it. Data changed by the new
build is not undone either, which is why a failed verify suite never rolls
back by itself.

## Production verification

`scripts/production-verify/prod-smoke.spec.ts` is a scoped, self-cleaning
Playwright suite for verifying a live deployment end-to-end — signup,
editor publish, my-pages, logout/login, CSRF rejection, admin gating, the
and the full v1 API surface via `booklet-api.ashwinsathian.com`. Deliberately kept outside `tests/e2e/` (it has
its own `playwright.config.ts`) so it's never picked up by the normal
dev/CI test run — every account/page it creates is tagged
`e2e-verify-<timestamp>` and deleted in `afterAll`, scoped precisely to
what that run created. `npm run deploy` runs it; to run it by hand:

```bash
TEST_BASE_URL=https://booklet.ashwinsathian.com \
TEST_API_BASE_URL=https://booklet-api.ashwinsathian.com \
MONGODB_URI="mongodb://127.0.0.1:27017/booklet?directConnection=true" \
npx playwright test --config=scripts/production-verify/playwright.config.ts
```

`scripts/production-verify/cli-mcp-verify.mjs` covers what the Playwright
suite above doesn't: the real `booklet login` browser-redirect handshake,
the rest of the CLI's command surface (`whoami`, `pages list/delete`,
`publish`, `logout`), and the MCP server's JSON-RPC tool surface
(`initialize`, `tools/list`, `publish_page`, `list_pages`, `get_page`,
`update_page`, `delete_page`) — all against the live hostnames, using a
real signed-up throwaway account. It drives the CLI as an actual child
process with an isolated `$HOME` (so it never touches your real
`~/.booklet/config.json`) and feeds the session cookie through
`/cli-auth` and `POST /api/auth/cli-authorize` as a browser would, then
calls the CLI's loopback callback server with the returned URL — this is
the flow that would have caught the `redirect()`-inside-`try` bug above
before a real user hit it. (Updated 2026-10-10: the script still expected
the pre-September `GET /cli-auth` redirect, the pre-rename key prefix and a
plain-JSON MCP response, so it had been failing since 2026-09-05 without
anyone running it.)
Same self-cleaning discipline: everything is tagged
`e2e-cli-verify-<timestamp>` and deleted at the end, scoped to what the run
created. Run it after any deploy touching `src/app/cli-auth`,
`packages/cli`, or `mcp-server`:

```bash
MONGODB_URI="mongodb://127.0.0.1:27017/booklet?directConnection=true" \
node scripts/production-verify/cli-mcp-verify.mjs
```

## npm workspaces + the shared API client

The repo is an npm workspace (`mcp-server`, `packages/*`) — one root
`package.json`/lockfile covers every package; there's no more
`packages/*/package-lock.json`. `packages/shared` (published to npm as
`booklet-api-client`) is the single source of truth for the `/api/v1/*`
request/response contract (zod schemas + a thin typed fetch client) —
`mcp-server` and `packages/cli` both depend on it instead
of hand-rolling their own fetch calls, as does the GitHub Action
([`AshwinSathian/publish-to-booklet`](https://github.com/AshwinSathian/publish-to-booklet),
extracted from this monorepo into its own repo so it can carry a real
Marketplace listing — it depends on the published `booklet-api-client` npm
package rather than the workspace). `cli` and the Action both
bundle it at build time via `tsup` (`noExternal`) into a single
self-contained output file, since neither gets a real `npm install`
step where it runs (a published npm package, a GitHub Actions
runner with no install step). `mcp-server`
resolves it normally
via `node_modules` since it runs as a regular long-lived Node process under
PM2.

## Error tracking

`logError` (`src/lib/logger.ts`) writes a JSON line to PM2's log, and counts
the error in the `error_events` collection (`src/lib/db/error-events.ts`):
one row per distinct error, by scope, message, error name and the first
frame of its stack, with a count and first and last sighting. A row is
removed 30 days after its last sighting.

- `/admin` lists the 25 most recent, each with its stack.
- With `ERROR_ALERT_EMAIL` set (and `RESEND_API_KEY`), a new error is
  mailed once when first seen, then at most once a day for that error, and
  ten mails an hour in all. Unset, nothing is mailed and nothing else changes.
- Recording never throws and is never awaited: a database that is down
  costs the count, not the request.

There is no outside tracker. If one is wanted later, `recordErrorEvent` is
the one place to send from.

## Infrastructure: single-machine deployment

**Current state:** one PM2 process (`booklet-app`, `fork` mode, 1 instance)
plus a second PM2 process (`booklet-mcp`) on a personal Mac, both reverse-
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
5. This needs an actual Cloudflare account with Workers access. Documented
   here as a reference for if/when that migration is revisited, not scheduled
   work.

**Lower-lift fallback, achievable with zero new infrastructure:** run 2+ PM2
instances in `cluster` mode on the *same* machine (`instances: 2` or more,
`exec_mode: "cluster"` in `ecosystem.config.js`, currently `instances: 1` /
`"fork"`). This doesn't protect against the machine itself sleeping,
rebooting, or losing power/ISP connectivity, but it does protect against a
single Node process OOM-ing or crashing under load — a real, if partial,
reliability improvement with no new moving parts. Recommended as the
practical next step unless a Cloudflare Workers (or other managed-host)
migration is actually imminent.

## Content Security Policy

`src/middleware.ts` builds the policy per request. Scripts run only with
that request's nonce (`script-src 'self' 'nonce-…' 'strict-dynamic'
'wasm-unsafe-eval'`); there is no `'unsafe-inline'` for scripts. The nonce is
set on the request too, as `x-nonce` and in a `Content-Security-Policy`
request header: Next.js reads the header to put the nonce on its own
scripts, and the root layout reads `x-nonce` for the theme script.

Consequences:

- No page is prerendered. A nonce differs per request, so every page is
  rendered when asked for. Most already were.
- A `<script>` added to a page by hand needs `nonce={nonce}` from
  `headers().get("x-nonce")`. JSON-LD blocks do not: they are data.
- Cloudflare's injected script (`/cdn-cgi/challenge-platform/…`) is given
  the nonce by Cloudflare, which reads it from the response header. If the
  browser console shows it blocked, that is where to look.
- Styles still allow `'unsafe-inline'`: the document themes and KaTeX set
  inline styles.

## OAuth for MCP clients

Added 2026-10. The Booklet app is an OAuth authorization server and the MCP
server is its one resource server. A Claude.ai custom connector uses it to
sign in; nothing changes for clients that send an API key.

The flow, by URL:

1. The client calls `https://booklet-mcp.ashwinsathian.com/mcp` with no
   credential and gets `401` with `WWW-Authenticate: Bearer
   resource_metadata="…/.well-known/oauth-protected-resource/mcp"`.
2. That document names the app as the authorization server. The app's own
   metadata is at `/.well-known/oauth-authorization-server`.
3. The client identifies itself with a Client ID Metadata Document (its
   `client_id` is an https URL the app fetches through the SSRF guard).
   There is no client registration: 2.0.0 removed it, after a Claude.ai
   connector was seen signing in with its metadata document alone.
4. The browser opens `/oauth/authorize`. That page only shows a consent
   screen. The code is issued by `POST /api/oauth/authorize`, which needs
   the session cookie and a same-origin `Origin` header.
5. `POST /api/oauth/token` exchanges the code (with the PKCE verifier) for
   an access token (`bkat_…`, 1 hour) and a refresh token (`bkrt_…`, 30
   days, replaced on every use).
6. The MCP server asks `GET /api/oauth/tokeninfo` whether the token is live
   and which resource it was issued for, then forwards it to `/api/v1`.

Code: `src/lib/oauth/server.ts` (codes, tokens, PKCE), `src/lib/oauth/clients.ts`
(client lookup, redirect URI rules), `mcp-server/src/auth.ts` (the resource
server's check). Collections: `oauth_codes`, `oauth_tokens`.
Codes and tokens are stored as HMACs under `API_KEY_PEPPER`, so rotating
that pepper signs every connected app out, as it invalidates every API key.

**Configuration.** Tokens are issued for one resource:
`MCP_PUBLIC_URL`, default `https://booklet-mcp.ashwinsathian.com/mcp`. The
MCP server reads the same variable and `BOOKLET_PUBLIC_URL` (default
`https://booklet.ashwinsathian.com`). Production needs neither set. The
issuer is `NEXT_PUBLIC_SITE_URL`, which must stay the public https origin.

**Disconnecting an app.** There is no screen for it yet (planned with the
account page in Phase 5). The user can remove the connector in the client,
or reset their password, which withdraws every grant. By hand:

```js
db.oauth_tokens.deleteMany({ user_id: "<user id>" })   // one user
db.oauth_tokens.deleteMany({ client_id: "<client id>" }) // one app, everyone
```

**What is deliberately simple.** The Client ID Metadata Document cache is
per process (10 minutes). An access
token issued for the MCP server is also accepted by `/api/v1` directly,
because the MCP server forwards it; both are Booklet and the scopes are the
same.

**Running the MCP server by hand.** Never `pkill -f node-server.ts`: the
production process matches that pattern too. Stop a test instance by its
port, `lsof -ti :<port> | xargs kill`.
