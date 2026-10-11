# Changelog

Notable changes to the Booklet app and MCP server. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`booklet-cli` has its own changelog in
[packages/cli/CHANGELOG.md](packages/cli/CHANGELOG.md).

## [Unreleased]

## [2.1.0] - 2026-10-11

`booklet-api-client` and `booklet-cli` are 3.1.0 and the MCP server is 4.1.0.

### Added

- **Change your email address** in Account settings. A link goes to the new
  address and the account moves when the link is confirmed while signed in
  to it. The address it left is told by mail, and password-reset links
  already sent there stop working, and a link proves only the address
  it was mailed to. An account that never confirmed its
  first address (a typo at signup) changes it at once and stays
  unconfirmed. One link a minute, ten a month.
- **Move a page between team spaces** without the web app:
  `PATCH /api/v1/pages/:id` takes `space` (a slug, or `null`),
  `booklet pages move <id> --space <slug>` or `--no-space`, and the MCP
  `update_page` tool takes `space`. The page's `[[Title]]` links are
  resolved again for where it now is.
- **Error tracking, built in.** Every error the app logs is counted by
  fingerprint and listed on `/admin` with its stack, for 30 days. With
  `ERROR_ALERT_EMAIL` set, a new error is also emailed.
- `OAUTH_STATIC_CLIENTS` pins an OAuth client's metadata, so signing in does
  not depend on fetching it.

### Security

- **Scripts run only with a per-request nonce.** The Content-Security-Policy
  no longer has `'unsafe-inline'` for scripts; it has a nonce and
  `'strict-dynamic'`. An injected `<script>` or inline handler does not run.
  Every page is now rendered per request, which a nonce requires.
- One pinned-connection helper (`pinnedRequest`) makes every outbound
  request to a host a user supplied: webhook delivery, import from URL and
  OAuth client metadata. All three now have a deadline for the whole
  exchange, which only one had.

### Changed

- **Rendered documents are set tighter.** Line height is 1.5 (1.55 in the
  serif face), with smaller gaps between blocks and list items. The HTML
  export matches.
- **One error shape.** Every error response is RFC 9457 problem details,
  from the app's own routes as from `/api/v1`. The web UI reads `detail`.
  A script that called the session routes (`/api/webhooks`, `/api/publish`)
  and read `error` has to read `detail`. OAuth endpoints keep RFC 6749's.
- "Referenced by", link resolution and the space home's feed check make a
  fixed number of queries, not one per page.
- The nightly job rotates Booklet's PM2 logs, and a weekly workflow keeps
  the uptime probe from being switched off after 60 days without a commit.
- Lint fails on any warning. The React Compiler rules were reviewed hit by
  hit: most were rewritten, and each effect that still sets state says why.


## [2.0.1] - 2026-10-11

### Security

- **Mermaid diagrams on a page are sanitized before they are mounted.** They
  used to rely on Mermaid's own pass alone, which keeps CSS and images: a
  `themeCSS` in a diagram's init directive, or an `<img>` in a label, made
  every reader's browser fetch from another host. Two changes close that.
  Mermaid is configured so that a directive cannot set `themeCSS` and a
  label cannot contain an element that fetches or submits. And the drawn
  diagram is checked as a parsed tree (styles, images, event handlers,
  script links, form controls) and that tree is what is mounted, for
  Mermaid and Graphviz alike. One route is left: a Mermaid image shape is
  fetched while Mermaid lays the diagram out. That is the same request an
  image in the page's Markdown makes, which is a feature.
- Links inside a diagram to a path on the same site (`/p/...`) and `tel:`
  links are kept. The sanitizer used to remove them from Graphviz diagrams.

### Changed

- **Visibility in the editor** is a menu in the app's own style, with a line
  under each choice saying who can find the page. It was a native select.
- **`npm run deploy` covers the whole deploy.** It builds every workspace
  that has a build (the CLI was left at whatever was last built by hand),
  backs up and restores every build output on a failed health check, records
  the commit of each healthy deploy, and ends by running both
  production-verify suites against the live site. `SKIP_VERIFY=1` skips
  them. It exits 2 when the build is live and a verify suite failed.
- `scripts/health-check.sh` finds `pm2` under whichever nvm Node version
  has it. It used to report three failures for running processes.
- CI checks that every shell script parses.
- The example incident report and ADR linked from the landing page carry
  typed frontmatter, so they show the header strip, and the incident links
  to the ADR.


## [2.0.0] - 2026-10-11

Booklet 2.0.0 is the engineering-documents release: document types, links
between pages, team spaces with team-only pages, accounts with email
verification and passkeys, OAuth for MCP clients, and an API brought up to
current conventions. It also drops every older version of a flow that was
still being carried. `booklet-cli` and `booklet-api-client` are 3.0.0 and
the MCP server is 4.0.0.

### Breaking

Everything that can break a caller or a self-hosted install, from every
round of work since 1.0. The sections below this one describe each round.

API keys

- A key that starts with `rdbl_` is refused. Create a new one under
  Settings, API keys, or run `booklet login --force`.

`/api/v1`

- Error bodies are RFC 9457 problem details and no longer carry an `error`
  member. Read `detail`.
- `GET /api/v1/pages` answers 400 to `offset` and its response has no
  `offset` field. Pass each response's `next_cursor` as `cursor`.
- A page created without a visibility is unlisted. Pass
  `visibility: "public"` for the old behaviour.
- A document over 200,000 characters is refused with 413. It used to be
  stored with its Markdown cut off.
- `raw` in a page response includes the frontmatter the page was published
  with, and updating a page's content also updates its title, type and
  frontmatter fields.
- A publish whose ownership record cannot be written fails with 500.
- An account with an unconfirmed email address gets 403 when it publishes,
  updates, creates an API key, authorizes the CLI or approves an app, where
  the host has email configured.

MCP server 4.0.0

- Protocol 2026-07-28 only. A 2025-era client, one that opens with
  `initialize`, gets the unsupported-protocol-version error.
- `list_pages` takes `cursor` and no longer takes `offset`.
- OAuth dynamic client registration is gone: `POST /api/oauth/register`
  answers 404 and the metadata has no `registration_endpoint`. A client is
  identified by a Client ID Metadata Document, as Claude.ai's connector is.
  A client that can only register itself uses an API key instead.
- A request without a credential gets 401 with a `WWW-Authenticate`
  challenge, and reading an unknown resource is error `-32602`.

CLI and API client

- `booklet-cli` 3.0.0 and `booklet-api-client` 3.0.0 are the versions that
  work with this server. 2.x cannot list pages against it and prints
  `HTTP <status>` in place of an error message.
- Both need Node.js 22 or later.
- `booklet-cli` exit codes say why a command failed (2 usage, 3 not
  authenticated, 4 not found, 5 rate limited), and `pages delete` without
  `--yes` outside a terminal exits 2.

Pages

- `/p/<id>` for a page that does not exist answers 404, and a taken-down
  page answers 410.
- A page published without an account is served for 90 days.
- A page password set before 2026-09-05 no longer opens its page. The
  owner sets the password again from My pages.

Editor

- Drafts saved in a browser by the earliest editor (drafts schema 1) are
  not read. They are replaced the next time a draft is saved.

Self-hosting

- `users.email` is required and its index is unique without `sparse`. The
  app rebuilds the index at its first start. A database that still holds a
  user with no email, or two with the same one, has to be cleaned first.
- The app no longer drops superseded indexes at startup, and the one-time
  scripts `backfill-anonymous-expiry.mjs` and `restore-frontmatter-raw.mjs`
  are gone. `docs/OPERATIONS.md` lists what to remove by hand.

### Added

- **Trust page** at `/trust`: who runs Booklet, where it is hosted, how it
  is backed up, who pays for it, and how to export or delete an account.
- The landing page has a section on team spaces and document types.
- The MCP server has an icon: it serves the app's at `/favicon.ico` and
  `/favicon.svg` on its own host and names it in its server information. A
  client listing its connectors used to show the parent domain's icon.
- `node scripts/build-icons.mjs` rebuilds the static icons from the mark
  the app serves at `/icon`.

### Changed

- Site copy rewritten around engineering documents: landing, pricing,
  about, the setup guides and the README. Claims that could not be checked
  against the code were removed.
- The MCP setup guide starts with choosing a tool, Claude.ai first, and
  shows the API key step for the tools that need a key. It used to open
  with "Get your API key" for everyone, Claude.ai included.
- The browser tab icon, the PWA icons and `/icon` are the same mark. The
  static files were two brand revisions behind.
- Sign-in, sign-up, password reset, email verification, the CLI and OAuth
  consent screens and the team invite page show one centred card with the
  Booklet logo under it. The left-hand branding pane is gone.
- My pages reads each page's publish source from the page record. It used
  to scan the account's whole publish log on every load.
- The SVG sanitizer removes `@import` and external `url()` from a diagram's
  `<style>`.

Dashboard and editor (roadmap Phase 5c).

### Added

- **Settings pages.** API keys are at `/settings/api-keys` and webhooks at
  `/settings/webhooks`, beside Account, with all three in the account menu.
  My pages now holds pages and folders only.
- **Publish source.** Each row on My pages says how the page was last
  published or updated: Web, API, CLI, MCP or Action.
- **Webhook delivery log.** Each webhook lists its last 50 deliveries with
  the status code the receiver answered, or why there was no answer.
  "Resend" sends the same body again and adds the new attempt as its own
  row. Deleting a webhook, a page or the account removes the rows.
- **Version diff.** Version history compares any two versions line by line,
  frontmatter included. "Restore" now asks first, and says that it adds a
  new version and overwrites nothing.
- **Import from URL** in the editor's menu: a link to a public Markdown file
  on GitHub (`github.com/.../blob/...` or `raw.githubusercontent.com`) opens
  as a new draft. Nothing is published. Files over 200,000 characters are
  refused.
- `node scripts/check-contrast.mjs` checks every text colour of the app's
  two themes and the five document themes against every surface it is
  drawn on. CI runs it.

### Changed

- **HTML export includes Mermaid diagrams**, drawn in the browser when you
  export, in the light theme. They used to export as source text. Labels in
  the exported diagram are plain SVG text, so icons and math inside a label
  do not carry over.
- The export menu's PDF option is called "Print to PDF".
- **Accessibility.** Every page passes axe's WCAG 2.2 AA rules in the light
  and the dark theme, and a test fails when a new page is not covered.
  To get there: secondary, muted and accent text colours are darker in the
  light theme and lighter in the dark one, in the app and in all five
  document themes (the Signature theme's dark accent goes from `#a12f3e` to
  `#ca8b93`); status colours and syntax highlighting have light-theme
  values; links inside text are underlined; scrollable code blocks can be
  reached by keyboard; editor toolbar buttons are at least 24 by 24 pixels.
- Creating an API key with an unconfirmed email address now shows why it
  was refused. The button used to do nothing.

### Fixed

- The `page.updated` webhook event is sent. Webhooks could subscribe to it,
  and nothing fired it.
- A page updated in the web editor is counted as an update in the publish
  log. Only API updates were.
- An event handler on the root `<svg>` element of a Graphviz diagram is
  removed like one on any other element.

### Not planned

- **Custom domains for team spaces** (roadmap task 5.13). It depended on
  moving to Cloudflare Workers, and Booklet stays self-hosted (see
  [ADR 0001](docs/adr/0001-hosting-platform.md)).

Documents (roadmap Phase 5b).

### Added

- **Document types.** Frontmatter `type` (`incident`, `postmortem`, `adr`,
  `rfc`, `runbook`, `release-notes`) with `status`, `severity`, `date`,
  `owners` and `supersedes`. A published page shows them in a strip above the
  content. The 21 editor templates, `booklet new` and the 5 MCP prompts start
  with this frontmatter.
- **Links between published pages.** `[[Title]]` becomes a link when a
  published page with that title exists in the same team space, or among
  your own pages outside a space. The linked page lists "Referenced by"
  pages, limited to the ones the reader may see.
- **Team-only pages.** `visibility: team` on a page in a team space: members
  of the space can open it, everyone else gets a 404. Set it in the editor's
  publish menu, on My pages, with `--visibility team --space <slug>` in the
  CLI, or through the API and MCP.
- **Team space home.** `/t/<slug>` groups a space's pages by type, with a
  decision log in ADR-number order and incidents by date. `/t` lists your
  spaces and creates one; "Spaces" is in the account menu. A space with
  public pages has an Atom feed at `/t/<slug>/feed.xml`.
- **API:** `GET /api/v1/pages` takes `type` and `space`; page objects carry
  `doc_type` and `space`; `POST /api/v1/publish` takes `space`.
- **MCP tools** `create_document` (type, fields, space, body) and
  `search_pages` (query, type, space).

### Changed

- **Breaking:** the Markdown the API returns for a page (`raw`) includes the
  frontmatter it was published with. `POST /api/v1/publish` used to drop it.
- **Breaking:** updating a page's content also updates its title, type and
  frontmatter fields from the new document.
- **Breaking:** a publish whose ownership record cannot be written fails
  with 500. It used to return 201 for a page nobody owned.
- A team invite link is accepted only by an account whose confirmed email is
  the invited address. Removing a member cancels the invite links sent to
  them before the removal. Opening an invite again does not change the role
  of someone already in the space.
- Changing a page's visibility resolves its `[[Title]]` links again: a page
  made public loses its links to pages that are not public.
- The owner of a page can always take it out of a team space, including
  after being removed from the space.
- The MCP `publish_page` tool adds `title` and `slug` to a document's
  existing frontmatter instead of putting a second block in front of it.
- Members with the editor role can add their own pages to a team space.
  Before, only the space's owner could.

Accounts (roadmap Phase 5a).

### Added

- **Sign in with GitHub or Google.** Shown when the provider is configured.
  A sign-in whose verified email matches an existing account is linked to it.
- **Passkeys.** Add one in Account settings, then sign in with no password.
- **Email verification.** New and existing accounts confirm their address
  from a link we email.
- **Account settings** at `/settings/account`: change password, sign-in
  methods, connected apps with a Disconnect button, download every page as a
  ZIP of Markdown files, delete the account and its pages.
- **Move local drafts into your account.** After the first sign-in in a
  browser, drafts written before signing in can be moved in with one click.
- **Robot check** (Cloudflare Turnstile) on publishing without an account,
  signup and the report form, where configured.

### Changed

- **Breaking:** an account with an unconfirmed email address gets 403 when
  it publishes or updates a page (editor, API key or OAuth token), creates
  an API key, authorizes the CLI or approves an app. This includes accounts
  created before this release. It applies only where email is configured.
- **Breaking:** `/p/<id>` for a page that does not exist answers 404, not 200.
- Changing a password, like resetting one, signs out other browsers and
  disconnects connected apps.

### Fixed

- The editor saved the open draft about twice a second for as long as it
  was open. For a signed-in user this also kept cloud draft sync from ever
  uploading.

### Not planned

- Custom domains for team spaces (roadmap task 5.13). Booklet stays
  self-hosted; see `docs/adr/0001-hosting-platform.md`.

Programmatic surfaces brought up to current conventions (roadmap Phase 4).

### Added

- **OAuth sign-in for MCP clients.** A Claude.ai custom connector pointed at
  `https://booklet-mcp.ashwinsathian.com/mcp` signs in with a Booklet
  account; no API key is pasted anywhere. Authorization code with PKCE
  (S256 only), clients identified by a Client ID Metadata Document, scopes `pages:read` and `pages:write`, one-hour
  access tokens and rotating 30-day refresh tokens. API keys keep working.
- **Problem details.** `/api/v1` errors are RFC 9457 bodies
  (`application/problem+json`). A 413 says which
  limit was hit: `characters` (200,000) or `stored_bytes` (600,000).
- **Rate-limit headers.** Every `/api/v1` response carries `RateLimit` and
  `RateLimit-Policy`; a 429 adds `Retry-After`.
- **Safe retries.** `POST /api/v1/publish` accepts `Idempotency-Key`. A repeat
  within 24 hours returns the first response and publishes nothing.
- **Conditional requests.** `GET /api/v1/pages/:id` returns an `ETag`;
  `PATCH` and `DELETE` honor `If-Match` and answer 412 when it is stale.
- **Cursor pagination.** `GET /api/v1/pages` returns `next_cursor` and
  accepts `cursor`.
- **OpenAPI.** `/api/v1/openapi.json` is an OpenAPI 3.1 document generated
  from the same schemas the clients validate with. The examples on
  `/api-docs` are rendered from it.
- **Markdown for agents.** `/p/:id.md`, and `/p/:id` requested with
  `Accept: text/markdown`, return a page's raw Markdown. Password-protected,
  taken-down and expired pages return 404.

### Changed

- **The MCP server** runs on `@modelcontextprotocol/server` 2.x and speaks
  protocol 2026-07-28. A request
  without a credential now gets `401` with a `WWW-Authenticate` challenge
  (it used to be a JSON-RPC error body). Reading an unknown resource is
  error `-32602`.
- A password reset now also disconnects apps that were connected through
  OAuth.

### Not planned

- Custom domains for team spaces. They depended on moving to Cloudflare,
  and Booklet stays self-hosted (`docs/adr/0001-hosting-platform.md`).

## [1.1.0] - 2026-10-10

The first tagged release. It covers two rounds of work: fixing known
correctness and exposure problems, then relicensing and removing unused
code.

### Changed

- **License.** The app is now AGPL-3.0-only. `packages/cli`,
  `packages/shared` and `mcp-server` stay MIT, each with its own `LICENSE`
  file. Commit `1839525` is the last MIT commit of the app. The site footer
  links to the source.
- **New pages are unlisted.** A page is reachable by link and kept out of
  Explore, tag pages, the sitemap and search engines unless its author sets
  visibility to `public`. Pages that were already public are unchanged. API
  and CLI callers that relied on the old default must now pass
  `visibility: "public"`.
- **Anonymous pages expire.** A page published without an account is served
  for 90 days and deleted 30 days later. Its author can sign in and keep it
  from the browser that published it. Anonymous pages that existed on
  2026-10-10 expire on 2027-01-08.
- Explore is one list of public pages, newest first, with a tag filter.
- `/mcp` redirects (308) to `/mcp-setup`.
- Production, CI and the publish workflows run Node.js 24. `booklet-cli` and
  `booklet-api-client` declare `engines.node >= 22`, effective from their
  next release.
- `jsdom` 30, `eslint-config-next` 16 with a native flat ESLint config.
- The MCP server reports one version, 2.0.0, in `package.json`, `/health`,
  the MCP handshake and the new `mcp-server/server.json`, matching the
  registry entry.

### Added

- "Report this page" on every published page and embed, an admin review
  queue at `/admin/reports`, and takedown. A taken-down page returns
  410 Gone from the page, its embed and `GET /api/v1/pages/:id`.
- `GET /api/health`, which checks the database, and an optional "Status"
  link in the footer.
- Nightly encrypted MongoDB backup to object storage, with a restore drill
  script.
- The Playwright end-to-end suite runs on every pull request, in Chromium
  and WebKit, against a production build.

### Fixed

- Documents over 200,000 characters are rejected with HTTP 413. They used to
  publish with the stored Markdown cut off at 200,000 characters.
- Undo reverses toolbar formatting, slash-menu inserts, wikilink completion
  and replace-all in the editor.
- Typing in the editor's find box no longer moves focus into the document,
  where the next keystroke replaced the first match.
- User-authored links carry `rel="nofollow ugc noopener noreferrer"`.
- Setup and API pages showed the key prefix and secret names from before
  the project was renamed.

### Removed

- Google Analytics, including its hosts in the Content-Security-Policy. No
  third-party analytics script loads on any page.
- Emoji reactions on published pages, and the `reactions` and
  `reaction_state` collections.
- The Featured toggle, the Trending and Featured tabs on Explore, and the
  `pages.featured` and `pages.remove_attribution_badge` fields.
- The floating "make your own" prompt on published pages.
- The VS Code extension (`packages/vscode`), which was never published.
- The sign-in-provider migration flow: the `/claim` page,
  `POST /api/auth/claim`, `CLAIM_TOKEN_SECRET` and the two migration
  scripts.

[1.1.0]: https://github.com/AshwinSathian/booklet/releases/tag/v1.1.0
[2.1.0]: https://github.com/AshwinSathian/booklet/releases/tag/v2.1.0
[2.0.1]: https://github.com/AshwinSathian/booklet/releases/tag/v2.0.1
[2.0.0]: https://github.com/AshwinSathian/booklet/releases/tag/v2.0.0
