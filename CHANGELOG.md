# Changelog

Notable changes to the Booklet app and MCP server. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`booklet-cli` has its own changelog in
[packages/cli/CHANGELOG.md](packages/cli/CHANGELOG.md).

## [Unreleased]

## [3.2.0] - 2026-10-11

Three audits of the site (what it claims against what the code does, its
wording, and what a crawler or a link preview gets) and the fixes they led
to. `booklet-cli`, `booklet-api-client` and the MCP server changed too; the
packages are released separately.

### Added

- **PNG link previews**, 1200 by 630, at `/og/*.png`: the site's card, one
  per published page (its title and document type), one per docs page and
  one per template. What a card says is looked up from its path. The SVG
  routes they replace took their text from the query string, and no chat
  app or social network drew them.
- **One template set.** Six engineering templates (incident report,
  postmortem, ADR, RFC, runbook, release notes) are written once in
  `booklet-api-client` and used by the editor, `booklet new` and the MCP
  prompts. New: an RFC template in the editor, a `postmortem` template in
  the CLI and a `postmortem` prompt. The other 16 editor templates were
  rewritten.
- **Team invites are sent.** With mail configured the invite is emailed;
  either way the owner is shown the link. Inviting needs a confirmed
  account and is rate limited.
- oEmbed (`/api/oembed`) with a discovery link on published pages; a native
  share button where the browser has one; `TechArticle` and
  `BreadcrumbList` structured data on public pages and docs.
- The editor's preview shows the header strip.
- `infra/fallback-worker`: a Cloudflare Worker that answers with a short
  page, or a 503 problem document for the API, when the origin behind the
  tunnel cannot be reached.
- A "Public beta" label, `/.well-known/security.txt`, and a "Run your own
  copy" section in the README.

### Changed

- A page with a custom URL has one address: `/p/<id>` redirects (308) to
  `/p/<slug>`, which is the canonical URL, `og:url`, the embed address and
  the sitemap entry.
- `robots.txt` no longer disallows `/_next/`. Pages marked `noindex` are
  now `follow`. The sitemap lists public pages, drops `/app`, and gives a
  date only where one is known.
- Pages are sent with `Cache-Control: no-transform`.
- `/admin` from an address outside `ADMIN_IPS` is the site's 404, not a
  bare 403.
- Copy across the site, the docs, the emails, the CLI and the MCP server:
  one name per thing, British spelling in site copy, errors that say what
  to do next. Page titles use "·" as the separator.
- The homepage's three specimens are rendered by `DocHeaderStrip`,
  `BlockRenderer`, `ReferencedByList` and `SpaceGroups`, the components
  the published site uses.

### Fixed

- An update that sent no `settings` (the API, the CLI, the MCP server and
  the GitHub Action never send a theme or typeface) reset the page's
  settings to the defaults. Settings from a request are now validated and
  merged over what is stored.
- Cloudflare's email obfuscation rewrote addresses in the HTML, which broke
  hydration (React error 418) on Privacy, Terms, Trust and Account settings,
  on the live site only. `no-transform` turns that rewriting off.
- Deleting a team space unlinked only the owner's pages and left the
  membership rows.
- `:::toggle Label` in the docs and the editor's Toggle snippet did not
  parse (the label goes in brackets); the Columns snippet became a heading
  as soon as text was typed into it.
- `/p/<missing>/embed` answered 200; a path with a malformed escape
  answered 500; the published page's fallback description praised itself.
- Many statements in the docs and on Trust, Privacy and Terms that did not
  match the code: where the header strip is, which ID `--update` takes,
  which frontmatter keys the web editor reads, how long an anonymous page
  is kept, which emails are sent, what the ZIP leaves out.

## [3.1.1] - 2026-10-11

The close-out of the redesign: what a last look at every screen, in both
themes at 390, 768 and 1440, and a keyboard-only pass through the editor
turned up. No routes changed. In stored and returned documents an ordered
list block may now carry `start`.

### Fixed

- The editor's startup overlay could stay on screen for good, covering the
  editor. Its entrance waited on animation frames and its exit on timers, so
  when the browser held frames back (a tab opened in the background, a busy
  machine) the entrance ran last and nothing was left to dismiss it.
- `/c/[id]` listed a public page that has a password. It no longer does,
  like the author page, Explore and tags.
- The custom URL bar shown after publishing lay over the Write and Preview
  tabs, the formatting toolbar and the first line of the draft. It is in the
  flow under the top bar now.
- The drafts dialog was rendered inside the top bar, whose
  `backdrop-filter` made it the dialog's containing block: on a phone it was
  cut off at the top of the screen. It and Import from URL are outside the
  bar now.
- The editor pane kept a transform after its entrance animation, so the
  slash menu and link suggestions opened below the caret by the pane's
  offset and could run off the screen.
- An ordered list that does not begin at 1 lost its start number, so
  numbered steps with a code block between them all read "1.". List blocks
  carry an optional `start`.
- The editor was a keyboard trap: Tab and Shift+Tab both indent. Escape,
  then Tab, leaves it. The formatting toolbar acted on `mousedown` only, and
  closing the command palette left focus on `<body>`.
- A published page's link to the editor had no name in the compact header
  on a phone, and the full header was wider than a 320px screen.
- Meta rows on My pages, API keys and webhooks left a separator hanging at
  the end of a line when they wrapped.
- The MCP client picker's plan notice laid each bold word out as a column.
- `ViewsChart` indexed an empty array when given no days.
- Import from URL opened in the top corner of the screen: the CSS reset
  removes a dialog's own centring margin.
- The graph of drafts could not be scrolled to its left edge on a phone, and
  its labels were scaled down to 6px.
- A footnote's link back dropped to a line of its own. Site header labels
  wrapped at tablet width when signed in.

### Changed

- The 410 notice has a heading, a link home and follows the system's dark
  setting. The password
  gate uses the sign-in card. The error page of a published page uses the
  site's header and footer.
- Date-times are written "11 Oct 2026, 18:53".
- The formatting toolbar shows an edge shade where it scrolls. The find
  bar's case toggle is inverted when on and has `aria-pressed`. An active
  menu item with no label of its own shows a tick.
- On a phone the focus-mode button is not in the editor's top bar, which
  leaves room for the draft's title. The command palette and its shortcut
  still switch it.
- Team settings renders its header while loading, and its two refusals
  have an `h1`.
- The preview's live dot pulses twice instead of forever. The glow behind
  the startup logo is gone.
- `scripts/visual-qa-app.mjs` covers fourteen more states and the admin
  pages, and fails when a state cannot be reached.
  `scripts/visual-qa-prod.mjs` takes signed-in screenshots of a live
  instance with an account it deletes.

## [3.1.0] - 2026-10-11

The second half of the redesign: the signed-in app. No routes, API or data
changed.

### Changed

- **One header on every page behind the editor.** My pages, analytics,
  version history, Settings, Spaces and admin share a header with links to
  My pages, Spaces and Settings, the theme toggle and the account menu. A
  visitor to a public space sees Sign in there. There were six headers with
  four widths.
- **Collection pages (`/c`) and author pages (`/u`) use the public site's
  header and footer** and list pages with the card Explore uses.
- **Serif page titles, rectangular buttons and one input style** across the
  app and the auth forms. Sign in, sign up and the password pages have a
  title. Text in the app is 12px or
  larger; 11px is kept for keyboard hints and small-caps labels. The smallest
  was 10px.
- **Colour only where it means something.** Avatars are an ink initial on a
  soft tile. "Unlisted" is plain text and "Public" and "Team only" are
  neutral chips. Version history has one primary button, Compare.
- **Dates read "11 Oct 2026"** on My pages, API keys and webhooks.
- **On a phone or tablet an empty draft opens on Write.** It used to open
  on Preview.
- The second "Theme" setting in the editor is named "Page colour".

### Fixed

- My pages was wider than a phone screen, and its page menu opened
  off-screen.
- The editor's settings panel and account menu ran off the left edge of a
  phone, and the draft title's rename icon covered the button beside it.
- A hydration error on My pages, API keys and webhooks when the browser's
  locale or time zone differed from the server's.
- Command palette items were in capitals.
- The analytics chart cut off its last date, drew its labels at about 5px
  on a phone, and repeated a tick when a page had one view.
- The Publish button had no accessible name on a phone, where it shows only
  an icon.
- The site header's "Write a page" button wrapped onto two lines on a phone
  when signed in.
- The docs menu on a phone closes when a link in it is followed.
- The homepage product shot no longer shows a half-typed table as a line of
  pipes.

### Removed

- The two bridge rules that underlined accent-coloured links while the app
  still used the old accent. A test now fails if app or site chrome uses the
  accent as a text colour; published pages keep it, since there it is the
  document theme's link colour.

### Added

- `scripts/visual-qa-app.mjs`: a screenshot sweep of the signed-in app in
  both themes at three widths. It creates data, so it runs against localhost
  only.

## [3.0.0] - 2026-10-11

A redesign of every surface and a new documentation site. The major version
is for the URLs that moved; the API, the CLI and the MCP server are unchanged.

### Added

- **Docs at `/docs`**, written as Markdown files under `content/docs` and
  rendered by the same parser and renderer as a published page. A
  quickstart, eight guides, seven recipes and six reference pages. Each page
  is also served as Markdown at its address with `.md` added, and can be
  copied as Markdown. Search opens with `/` or `⌘K`.
- **Request and response examples in the docs come from the OpenAPI
  schemas.** `{{example:PublishRequest}}` in a docs file is filled in when
  the file is read, and a name with no example fails the docs tests.
- **`/llms.txt` and `/llms-full.txt` are generated** from the docs tree.
- **A product shot on the homepage**: a document typed in Markdown beside
  the page it becomes, for four document types. The parser runs on the
  server; the browser plays the frames. It can be paused and does not play
  under `prefers-reduced-motion`.

### Changed

- **The design system is "Typeset".** Paper and ink, Source Serif 4 for
  display type, Geist for the interface, and one yellow highlighter
  (`--color-highlight`) used behind ink text. `--color-accent` is now ink.
  `:root` holds the light palette and `html.dark` the dark one; it was the
  other way round. Document themes follow: light tokens by default, dark
  under `html.dark`.
- **The default document theme matches the site**, so pages on it change
  appearance. The other themes are unchanged.
- **A published page keeps its reading width beside a table of contents.**
  The container grows by the contents column instead of the text shrinking
  to 29rem.
- One `SiteHeader` and `SiteFooter` on every marketing and docs page.
  Pricing, templates, changelog, about, trust, privacy, terms, explore, tags
  and the 404 pages are rebuilt on shared primitives
  (`src/components/marketing/primitives.tsx`).
- The homepage is seven blocks instead of eleven sections, and about 7,000
  pixels tall on a desktop instead of 12,600.
- `highlightCode` returns plain text for a language that is not registered
  instead of asking highlight.js for it, which logged an error. Markdown is
  now a registered language.
- `service_documentation` in the OAuth metadata, and the MCP server's
  website URL, point at `/docs/guides/mcp`.

### Removed

- `/api-docs`, `/integrations` and `/mcp-setup`, with permanent redirects to
  `/docs/reference/api`, `/docs` and `/docs/guides/mcp`. `/mcp` redirects to
  the MCP guide. A fragment from an old link is mapped to the page that has
  that section now (`LEGACY_HASHES` in `src/lib/docs-nav.ts`).
- Explore and the tag pages from the footer, the sitemap and search
  indexing. The routes still work.
- `public/llms.txt` (now a route), the scroll-driven hero and the cursor
  spotlight.

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
