# Changelog

Notable changes to the Booklet app and MCP server. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`booklet-cli` has its own changelog in
[packages/cli/CHANGELOG.md](packages/cli/CHANGELOG.md).

## [Unreleased]

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
