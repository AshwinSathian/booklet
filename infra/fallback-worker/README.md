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

On the free Workers plan an account gets 100,000 requests a day, and every
request to these hostnames counts, static files included. Past that, a
route fails closed by default (error 1027). Set the routes to "fail open"
in the Cloudflare dashboard (Workers Routes, Request limit failure mode) so
that traffic over the limit bypasses the Worker and goes to the origin.

The MCP hostname is not routed through the Worker: its clients hold long
streaming connections and already report an unreachable server themselves.
