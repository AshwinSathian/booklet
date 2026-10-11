---
title: Limits
description: Size limits, rate limits, and what changes between publishing without an account and with one.
order: 6
---

## With and without an account

| | Without an account | With a free account |
| --- | --- | --- |
| Pages a month | 10 | No cap |
| How long a page is kept | 90 days | Until you delete it |
| Edit a page after publishing | No | Yes, at the same link |
| Custom slug, password, version history, analytics | No | Yes |
| Team spaces, API, CLI, MCP, webhooks | No | Yes |

A page published without an account can be kept: open it in the browser you published it from, sign in, and choose **Keep this page**.

There is no paid plan.

## Sizes

| What | Limit |
| --- | --- |
| A document | 200,000 characters of Markdown |
| A published page as stored | 600,000 bytes |
| Versions kept for a page | 50 |
| Webhooks for an account | 5 |
| Deliveries kept for a webhook | 50 |
| A custom slug | 3 to 60 characters |
| A page password | At least 6 characters |

## API rate limits

Each API endpoint has its own count, per account, per minute.

| Endpoint | Requests a minute |
| --- | --- |
| `POST /api/v1/publish` | 60 |
| `PATCH /api/v1/pages/{id}` | 60 |
| `DELETE /api/v1/pages/{id}` | 60 |
| `GET /api/v1/pages` | 60 |
| `GET /api/v1/pages/{id}` | 120 |

Every response says where you stand:

```text
RateLimit-Policy: "default";q=60;w=60
RateLimit: "default";r=59;t=42
```

`r` is the number of requests left and `t` the seconds until the count starts again. Past the limit the API answers 429 with a `Retry-After` header in seconds. The `RateLimit` headers follow an IETF draft that may still change; `Retry-After` will not.
