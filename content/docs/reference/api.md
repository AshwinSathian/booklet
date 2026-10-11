---
title: REST API
description: Publish, update, list, read and delete pages over HTTP. Every endpoint, with request and response examples taken from the API's own schemas.
order: 1
---

The API is under `/api/v1`. Requests and responses are JSON, and timestamps are ISO 8601 in UTC. The whole API is described in OpenAPI 3.1 at [`/api/v1/openapi.json`](/api/v1/openapi.json); the examples on this page are generated from the same schemas.

## Base URL

```text
https://booklet.ashwinsathian.com/api/v1
```

## Authentication

Send an API key in the `Authorization` header:

```text
Authorization: Bearer bklt_your_key
```

Create keys under [Settings, API keys](/settings/api-keys). A key acts as your account, does not expire, and stops working the moment you delete it.

## Publish a page

`POST /api/v1/publish` creates a page and returns its URL.

```json
{{example:PublishRequest}}
```

- `raw` is the Markdown, up to 200,000 characters. It may start with [frontmatter](/docs/reference/frontmatter).
- `visibility` is optional. A new page is `unlisted` unless this, or the frontmatter, says `public`.
- `space` is the slug of a team space you can publish to. With `visibility: "team"`, only members of that space can open the page. `team` without a space is a 422.

Response, 201:

```json
{{example:PublishResponse}}
```

| Status | Meaning |
| --- | --- |
| 400 | Invalid JSON, an empty document, or no `raw` |
| 401 | Missing or invalid API key |
| 403 | You can read the team space but not publish to it |
| 404 | No team space with that slug, or you are not in it |
| 409 | The slug in the frontmatter is taken |
| 413 | Over 200,000 characters, or over 600,000 bytes once parsed |
| 422 | Invalid slug, `team` without a space, or an `Idempotency-Key` reused with a different body |
| 429 | Rate limit reached |

## Update a page

`PATCH /api/v1/pages/{id}` changes a page in place. The URL stays the same, and only the owner can do it. `id` is the page ID or its slug.

Replace the content:

```json
{{example:PatchPageRequest}}
```

Set a slug, remove it, or change visibility, without touching the content:

```json
{{example:PatchPageRequest:1}}
```

```json
{{example:PatchPageRequest:2}}
```

```json
{{example:PatchPageRequest:3}}
```

`space` in the body moves the page into a team space; `null` takes it out.

A slug is 3 to 60 characters: lowercase letters, digits and single hyphens, starting and ending with a letter or digit.

Response, 200:

```json
{{example:PatchPageResponse}}
```

| Status | Meaning |
| --- | --- |
| 401 | Missing or invalid API key |
| 403 | The page belongs to another account |
| 404 | No such page |
| 412 | `If-Match` did not match the page's current `ETag` |
| 413 | Document too large |

## List pages

`GET /api/v1/pages` returns your pages, newest first.

| Parameter | Meaning |
| --- | --- |
| `limit` | 1 to 100, default 20 |
| `cursor` | The `next_cursor` of the previous response |
| `q` | Title contains this text |
| `tag` | Has this frontmatter tag |
| `type` | A [document type](/docs/guides/document-types) |
| `space` | Slug of a team space you belong to. The list is then every page in that space, not only yours |

To read every page, pass each response's `next_cursor` as `cursor` until it is `null`. Pages published or deleted while you walk the list are never repeated or skipped.

```json
{{example:ListPagesResponse}}
```

## Read a page

`GET /api/v1/pages/{id}` returns one page with its Markdown.

```json
{{example:PageDetail}}
```

## Delete a page

`DELETE /api/v1/pages/{id}` deletes a page for good.

```json
{{example:DeletePageResponse}}
```

## Safe retries

Send an `Idempotency-Key` header with `POST /api/v1/publish` when a retry must not publish twice, for example from a job that can be run again. Any unique string up to 255 characters works.

For 24 hours, a repeat with the same key and the same body returns the first response, with `Idempotent-Replayed: true`, and creates nothing. The same key with a different body is a 422. A request that failed does not use up its key.

```bash
curl -X POST "https://booklet.ashwinsathian.com/api/v1/publish" \
  -H "Authorization: Bearer $BOOKLET_API_KEY" \
  -H "Idempotency-Key: $GITHUB_RUN_ID-CHANGELOG.md" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --rawfile raw CHANGELOG.md '{raw: $raw}')"
```

## Conditional requests

`GET /api/v1/pages/{id}` returns an `ETag` header. Send it back as `If-Match` on `PATCH` or `DELETE` to change the page only if nobody changed it first: a stale tag returns 412 and changes nothing. Without `If-Match` the write always applies. `If-None-Match` on a read returns 304 when the page is unchanged.

## Errors

Errors are RFC 9457 problem details, sent as `application/problem+json`. `detail` is the message to show a person.

```json
{{example:Problem}}
```

A 413 also says which limit was hit: `limit` is `characters` or `stored_bytes`, with `max` and `actual`.

## Rate limits

Each endpoint has its own count per account, per minute. [Limits](/docs/reference/limits#api-rate-limits) has the numbers and the headers that report them.
