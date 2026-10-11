---
title: Webhooks
description: Receive a signed HTTP request when one of your pages is published or updated.
order: 4
---

A webhook is a URL that Booklet sends a POST request to when you publish or update a page. An account can have five.

## Register one

Open [Settings, Webhooks](/settings/webhooks), enter an HTTPS URL, and choose the events: `page.published`, `page.updated`, or both. The signing secret is shown once, when the webhook is created. Copy it then.

The URL has to be reachable from the internet. Addresses on a private network or on localhost are refused.

## What is sent

```json
{{example:WebhookDelivery}}
```

That is the whole body. It is the same for every receiver and cannot be reshaped, which matters for services that expect their own format: see [the Slack recipe](/docs/recipes/slack-after-publish).

## Check the signature

Each request has an `X-Booklet-Signature` header: `sha256=` followed by the HMAC-SHA256 of the raw request body, keyed with the webhook's secret. Compute the same value and compare before trusting the body.

```js
const crypto = require("node:crypto");

function isFromBooklet(rawBody, secret, header) {
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header ?? "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
```

Use the body exactly as it arrived. Parsing it and serialising it again changes the bytes and the signature will not match.

## Delivery

Booklet tries once and waits up to 10 seconds for an answer. Any 2xx status counts as delivered. There is no automatic retry.

[Settings, Webhooks](/settings/webhooks) keeps the last 50 deliveries of each webhook with the status that came back, and a **Resend** button that sends the same body again.

## From the API

Webhooks can also be listed, created and deleted over HTTP with a signed-in session: `GET /api/webhooks`, `POST /api/webhooks`, `DELETE /api/webhooks/{id}`.
