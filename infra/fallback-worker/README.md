# Fallback Worker

Booklet is served from one machine through a Cloudflare Tunnel. When that
machine or its connection is down, Cloudflare has nothing to forward to and
shows its own error page (530, error 1033). This Worker sits on the same
hostnames and answers in the origin's place when that happens:

- a browser gets a short page (status 503, `Retry-After: 120`) that tries
  again every minute;
- an API client gets a 503 problem document in the API's usual shape.

At every other time it passes the request to the origin and the response
back, unchanged. `src/index.js` says exactly when it steps in.

## Deploy

```bash
cd infra/fallback-worker
npx wrangler deploy
```

## Try it without touching the live site

```bash
npx wrangler deploy --env preview --var ORIGIN:https://<a hostname that is down>
curl -i -H 'accept: text/html' https://booklet-fallback-preview.<your-subdomain>.workers.dev/
npx wrangler delete --env preview
```

## Remove it

```bash
npx wrangler delete
```

The hostnames then go straight to the tunnel again, as before.

## Limits

On the free Workers plan an account gets 100,000 requests a day, midnight
to midnight UTC, and every request to these hostnames counts, static files
included.

The Worker keeps the day's count in a Durable Object (`RequestCounter`).
From 95,000 requests to the end of that UTC day it answers every request
itself: a page that says Booklet is closed until midnight UTC, or a 503
problem document for the API, with `Retry-After` set to the seconds left.
Nothing reaches the origin in that time. The count is reported in batches
of ten, so the cut-off is approximate by a few dozen requests.

Those answers are requests too. If the remaining 5,000 are also used, the
routes fail closed (Cloudflare's error 1027) until midnight UTC, which is
the default and what is wanted here: the site stays closed. Do not set the
routes to "fail open", or traffic over the limit would reach the origin.

To try the cut-off on the preview copy, give it a small limit:
`npx wrangler deploy --env preview --var DAILY_LIMIT:20`.

To open the site again before midnight, deploy with a higher limit for the
day (`npx wrangler deploy --var DAILY_LIMIT:99000`) and deploy again without
it afterwards.

The MCP hostname is not routed through the Worker: its clients hold long
streaming connections and already report an unreachable server themselves.
