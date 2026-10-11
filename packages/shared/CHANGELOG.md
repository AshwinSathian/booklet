# Changelog

All notable changes to `booklet-api-client` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [3.1.1] - 2026-10-11

### Changed
- The authorization server metadata's `service_documentation` points at `/docs/guides/mcp`. The old
  address, `/mcp-setup`, redirects there.

## [3.1.0] - 2026-10-11

### Added
- `PatchPageRequestSchema` and `updatePage` take `space`: the slug of a team space to move the page
  into, or `null` to take it out of its space. Needs a Booklet server at 2.1.0 or later.

## [3.0.0] - 2026-10-11

Needs a Booklet server at 2.0.0 or later.

### Removed
- **Breaking:** `offset` on `listPages`, and `offset` in `ListPagesResponse`. The server answers
  400 to it. Walk a list with `cursor` and `next_cursor`, or call `listAllPages`.
- **Breaking:** the `error` member of `ApiErrorSchema`. The server sends RFC 9457 problem details
  only: read `detail`. `BookletApiError.message` is now taken from `detail`.

### Changed
- **Breaking:** `type`, `title`, `status` and `detail` are required in `ApiErrorSchema`, and
  `next_cursor` is required in `ListPagesResponse` (null on the last page).

## [2.1.0] - 2026-10-10

### Added
- `VisibilitySchema` accepts `"team"`: a page in a team space, readable by its members only.
- `DOC_TYPES`, `DocTypeSchema` and `DocType`.
- Page objects carry `doc_type` and `space`.
- `listPages` and `listAllPages` take `type` and `space`.
- `publishPage(raw, { space })`.
- `frontmatterBlock(fields)` builds a frontmatter block for the fields Booklet reads.

### Changed
- **Breaking:** `doc_type` and `space` are required in page responses, so this version needs a
  Booklet server from 2026-10-10 or later.

## [2.0.0] - 2026-10-10

### Changed
- **Breaking:** `publishPage(raw)` creates an unlisted page unless you pass
  `{ visibility: "public" }` or the document's frontmatter says so (the server default changed in
  Booklet 1.1.0).
- **Breaking:** `ApiErrorSchema` is the RFC 9457 problem-details body. `error` is still there.
- `getPage` also returns `etag`.

### Added
- `BookletApiError.problem` (the parsed error body) and `BookletApiError.retryAfter`.
- `retryOnRateLimit` client option: wait for `Retry-After` once on a 429.
- `publishPage(raw, { idempotencyKey })`, so a retry cannot publish twice.
- `updatePage` and `deletePage` take `{ ifMatch }`.
- `listPages({ cursor })`, `next_cursor` in the response, and `listAllPages()`.
- `buildOpenApi()` returns the OpenAPI 3.1 description of the API.
