# booklet-api-client

[![npm version](https://img.shields.io/npm/v/booklet-api-client)](https://www.npmjs.com/package/booklet-api-client)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](https://github.com/AshwinSathian/booklet/blob/main/packages/shared/LICENSE)

Typed client and [zod](https://zod.dev) schemas for the [Booklet](https://booklet.ashwinsathian.com)
REST API (`/api/v1`). Booklet publishes Markdown as web pages. The CLI, the MCP server and the GitHub
Action are all built on this package, so its schemas are the ones the server's OpenAPI document is
generated from.

It needs Node.js 22 or later and a Booklet server at 2.0.0 or later.

## Install

```bash
npm install booklet-api-client
```

## Use

```ts
import { createClient, BookletApiError } from "booklet-api-client";

const booklet = createClient({
  baseUrl: "https://booklet-api.ashwinsathian.com",
  apiKey: process.env.BOOKLET_API_KEY!, // from Settings, API keys
  source: "my-script", // sent as X-Booklet-Source
});

try {
  const { id, url } = await booklet.publishPage("# Release notes\n\nWhat changed.", {
    visibility: "unlisted",
    idempotencyKey: "release-2.4.0", // a retry with the same key publishes nothing new
  });
  console.log(id, url);
} catch (e) {
  if (e instanceof BookletApiError) console.error(e.status, e.message, e.problem?.code);
  else throw e;
}
```

| Method | What it does |
|---|---|
| `publishPage(raw, { visibility?, space?, idempotencyKey? })` | Creates a page. A new page is unlisted unless you say otherwise |
| `updatePage(id, { raw?, slug?, visibility? }, { ifMatch? })` | Updates a page in place |
| `getPage(id)` | A page's metadata, its Markdown and its `etag` |
| `listPages({ limit?, cursor?, query?, tag?, type?, space? })` | One page of results, with `next_cursor` |
| `listAllPages({ query?, tag?, type?, space? })` | Every page, following `next_cursor` |
| `deletePage(id, { ifMatch? })` | Deletes a page |

A failed request throws `BookletApiError`. `status` is the HTTP status (0 for a network error),
`message` is the server's `detail`, `problem` is the RFC 9457 body, and `retryAfter` is set on a 429.
Pass `retryOnRateLimit: true` to `createClient` to wait for `Retry-After` and try once more.

The package also exports the schemas themselves (`PublishRequestSchema`, `PageDetailResponseSchema`
and the rest), `MAX_RAW_CHARS`, `DOC_TYPES`, `frontmatterBlock(fields)` and `buildOpenApi`.

Full API reference: <https://booklet.ashwinsathian.com/docs/reference/api>. Changes: [CHANGELOG.md](https://github.com/AshwinSathian/booklet/blob/main/packages/shared/CHANGELOG.md).

## License

MIT
