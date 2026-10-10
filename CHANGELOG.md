# Changelog

Notable changes to the Booklet app and MCP server. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`booklet-cli` has its own changelog in
[packages/cli/CHANGELOG.md](packages/cli/CHANGELOG.md).

## [Unreleased]

Dashboard and editor (roadmap Phase 5c). No API change, so the CLI, API
client and MCP server keep their versions.

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

Documents (roadmap Phase 5b). MCP server 3.1.0.

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

Earlier in this unreleased cycle:

Programmatic surfaces brought up to current conventions. `booklet-cli` and
`booklet-api-client` are both 2.0.0 (see their own changelogs); the MCP
server is 3.0.0.

### Added

- **OAuth sign-in for MCP clients.** A Claude.ai custom connector pointed at
  `https://booklet-mcp.ashwinsathian.com/mcp` signs in with a Booklet
  account; no API key is pasted anywhere. Authorization code with PKCE
  (S256 only), clients identified by a Client ID Metadata Document or by
  dynamic registration, scopes `pages:read` and `pages:write`, one-hour
  access tokens and rotating 30-day refresh tokens. API keys keep working.
- **Problem details.** `/api/v1` errors are RFC 9457 bodies
  (`application/problem+json`) and keep the `error` string. A 413 says which
  limit was hit: `characters` (200,000) or `stored_bytes` (600,000).
- **Rate-limit headers.** Every `/api/v1` response carries `RateLimit` and
  `RateLimit-Policy`; a 429 adds `Retry-After`.
- **Safe retries.** `POST /api/v1/publish` accepts `Idempotency-Key`. A repeat
  within 24 hours returns the first response and publishes nothing.
- **Conditional requests.** `GET /api/v1/pages/:id` returns an `ETag`;
  `PATCH` and `DELETE` honor `If-Match` and answer 412 when it is stale.
- **Cursor pagination.** `GET /api/v1/pages` returns `next_cursor` and
  accepts `cursor`. `offset` still works.
- **OpenAPI.** `/api/v1/openapi.json` is an OpenAPI 3.1 document generated
  from the same schemas the clients validate with. The examples on
  `/api-docs` are rendered from it.
- **Markdown for agents.** `/p/:id.md`, and `/p/:id` requested with
  `Accept: text/markdown`, return a page's raw Markdown. Password-protected,
  taken-down and expired pages return 404.

### Changed

- **MCP server 3.0.0** runs on `@modelcontextprotocol/server` 2.x and speaks
  protocol 2026-07-28, while still answering 2025-11-25 clients. A request
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
