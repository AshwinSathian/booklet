import { test, expect } from "@playwright/test";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { cleanupPages, seedUserWithKey, useTestEnv } from "./helpers/pages";
import { html } from "./helpers/render";
import { sessionCookieFor, withRequestScope } from "./helpers/request-scope";
import { getDb } from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/db/index-specs.mjs";
import {
  createWebhook,
  deleteWebhook,
  deletePageAssociatedRecords,
  getPagesByUser,
  getPageRecord,
  getWebhook,
  getWebhookDeliveries,
  MAX_DELIVERIES_PER_WEBHOOK,
  recordWebhookDelivery,
} from "@/lib/db";
import { getPageVersions } from "@/lib/db/versions";
import { createId } from "@/lib/id";
import { resolveHostForDelivery } from "@/lib/ssrf-guard";
import { getDoc } from "@/lib/storage";
import { sendToWebhook } from "@/lib/webhook-delivery";
import { deleteAccount } from "@/server/account";
import { importMarkdownFromUrl, pinnedGet, toRawGithubUrl, type ImportDeps } from "@/server/import";
import { POST as v1Publish } from "@/app/api/v1/publish/route";
import { POST as webPublish } from "@/app/api/publish/route";
import { PATCH as webUpdate } from "@/app/api/publish/[id]/route";
import { POST as resend } from "@/app/api/webhooks/[id]/deliveries/[deliveryId]/resend/route";
import { POST as importRoute } from "@/app/api/import/route";
import WebhooksPage from "@/app/settings/webhooks/page";

// Phase 5c: the delivery log and "Resend", publish source, import from URL,
// and restoring a version.

const ORIGIN = "http://localhost";
const userIds: string[] = [];
const pageIds: string[] = [];
const servers: http.Server[] = [];

test.beforeAll(async () => {
  useTestEnv();
  await ensureIndexes(await getDb());
});

test.afterAll(async () => {
  for (const s of servers) s.close();
  const db = await getDb();
  await cleanupPages(pageIds, userIds);
  for (const c of ["webhooks", "webhook_deliveries"]) await db.collection(c).deleteMany({ user_id: { $in: userIds } });
});

async function newUser() {
  const u = await seedUserWithKey();
  userIds.push(u.userId);
  return { ...u, cookie: await sessionCookieFor(u.userId) };
}

function withSession(cookie: string | null, url: string, init: { method?: string; body?: unknown; origin?: string } = {}) {
  return new Request(`${ORIGIN}${url}`, {
    method: init.method ?? "POST",
    headers: {
      host: "localhost",
      origin: init.origin ?? ORIGIN,
      "content-type": "application/json",
      "cf-connecting-ip": `2001:db8::${crypto.randomUUID().slice(0, 4)}`,
      ...(cookie ? { cookie } : {}),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

/** A local HTTP server; `handler` decides each answer. */
async function stub(handler: http.RequestListener): Promise<{ port: number; hits: () => number }> {
  let hits = 0;
  const server = http.createServer((req, res) => {
    hits++;
    handler(req, res);
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { port: (server.address() as AddressInfo).port, hits: () => hits };
}

const loopback = async () => ({ address: "127.0.0.1", family: 4 as const });

function callResend(cookie: string | null, webhookId: string, deliveryId: string, origin?: string) {
  const req = withSession(cookie, `/api/webhooks/${webhookId}/deliveries/${deliveryId}/resend`, { origin });
  return withRequestScope(req, () => resend(req, { params: Promise.resolve({ id: webhookId, deliveryId }) }));
}

test.describe("webhook delivery log", () => {
  test("a receiver answering 500 is logged as a failed delivery, and Resend adds a second row", async () => {
    const owner = await newUser();
    const receiver = await stub((_req, res) => res.writeHead(500).end());
    const webhookId = createId(10);
    await createWebhook(webhookId, owner.userId, `http://hook.test:${receiver.port}/in`, "s3cret", ["page.published"]);
    const webhook = (await getWebhook(webhookId, owner.userId))!;

    const body = JSON.stringify({ event: "page.published", page_id: "p1", title: "T" });
    const first = await sendToWebhook(webhook, "page.published", "p1", body, loopback);
    expect(first).toMatchObject({ status_code: 500, ok: false, error: null });
    expect(receiver.hits()).toBe(1);
    expect(await getWebhookDeliveries(webhookId, owner.userId)).toHaveLength(1);
    // A failed delivery is not a "last fired".
    expect((await getWebhook(webhookId, owner.userId))!.last_triggered_at).toBeNull();

    // Through the route the real resolver runs, and hook.test resolves
    // nowhere public: the attempt is refused, and still logged as a row.
    const res = await callResend(owner.cookie, webhookId, first.id);
    expect(res.status).toBe(201);
    const { delivery } = await res.json();
    expect(delivery).toMatchObject({ status_code: null, ok: false, page_id: "p1", event: "page.published" });
    // The signed body stays on the server.
    expect(delivery).not.toHaveProperty("body");
    expect(await getWebhookDeliveries(webhookId, owner.userId)).toHaveLength(2);
    expect(receiver.hits()).toBe(1);
  });

  test("a 2xx answer is logged as delivered, with the signature header the receiver verifies", async () => {
    const owner = await newUser();
    let signature = "";
    const receiver = await stub((req, res) => {
      signature = String(req.headers["x-booklet-signature"]);
      res.writeHead(204).end();
    });
    const webhookId = createId(10);
    await createWebhook(webhookId, owner.userId, `http://hook.test:${receiver.port}/in`, "s3cret", ["page.updated"]);
    const sent = await sendToWebhook((await getWebhook(webhookId, owner.userId))!, "page.updated", "p2", "{}", loopback);
    expect(sent).toMatchObject({ status_code: 204, ok: true });
    expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/);
    // Written in the background after the delivery row.
    await expect.poll(async () => (await getWebhook(webhookId, owner.userId))!.last_triggered_at).not.toBeNull();
  });

  test("a webhook URL that resolves to a private address is never requested", async () => {
    const owner = await newUser();
    const receiver = await stub((_req, res) => res.writeHead(200).end());
    const webhookId = createId(10);
    await createWebhook(webhookId, owner.userId, `http://127.0.0.1:${receiver.port}/in`, "s", ["page.published"]);
    const sent = await sendToWebhook((await getWebhook(webhookId, owner.userId))!, "page.published", "p3", "{}");
    expect(sent).toMatchObject({ status_code: null, ok: false, error: "The URL does not resolve to a public address" });
    expect(receiver.hits()).toBe(0);
  });

  test("Resend is owner-only: another account, a signed-out caller and another site are refused", async () => {
    const owner = await newUser();
    const other = await newUser();
    const webhookId = createId(10);
    await createWebhook(webhookId, owner.userId, "https://hook.test/in", "s", ["page.published"]);
    const first = await sendToWebhook((await getWebhook(webhookId, owner.userId))!, "page.published", "p4", "{}");

    expect((await callResend(other.cookie, webhookId, first.id)).status).toBe(404);
    expect((await callResend(null, webhookId, first.id)).status).toBe(401);
    expect((await callResend(owner.cookie, webhookId, first.id, "https://evil.example")).status).toBe(403);
    // A delivery id from the owner's log under the other account's own webhook.
    const theirs = createId(10);
    await createWebhook(theirs, other.userId, "https://hook.test/in", "s", ["page.published"]);
    expect((await callResend(other.cookie, theirs, first.id)).status).toBe(404);

    expect(await getWebhookDeliveries(webhookId, owner.userId)).toHaveLength(1);
    // The log itself is read by owner as well as by webhook id.
    expect(await getWebhookDeliveries(webhookId, other.userId)).toHaveLength(0);
  });

  test("the settings page lists a webhook's deliveries to its owner and to nobody else", async () => {
    const owner = await newUser();
    const other = await newUser();
    const webhookId = createId(10);
    await createWebhook(webhookId, owner.userId, "https://hook.test/in", "s", ["page.published"]);
    await sendToWebhook((await getWebhook(webhookId, owner.userId))!, "page.published", "pagesecret1", "{}");

    const render = (cookie: string) => {
      const req = withSession(cookie, "/settings/webhooks", { method: "GET" });
      return withRequestScope(req, async () => JSON.stringify(await WebhooksPage()) + (await html(await WebhooksPage())));
    };
    expect(await render(owner.cookie)).toContain("pagesecret1");
    expect(await render(other.cookie)).not.toContain("pagesecret1");
  });

  test("only the newest 50 deliveries are kept per webhook", async () => {
    const owner = await newUser();
    const webhookId = createId(10);
    await createWebhook(webhookId, owner.userId, "https://hook.test/in", "s", ["page.published"]);
    for (let i = 0; i < MAX_DELIVERIES_PER_WEBHOOK + 3; i++) {
      await recordWebhookDelivery({
        id: `d-${webhookId}-${String(i).padStart(3, "0")}`,
        webhook_id: webhookId,
        user_id: owner.userId,
        page_id: "p5",
        event: "page.published",
        body: "{}",
        status_code: 200,
        ok: true,
        error: null,
        created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
      });
    }
    const kept = await getWebhookDeliveries(webhookId, owner.userId);
    expect(kept).toHaveLength(MAX_DELIVERIES_PER_WEBHOOK);
    expect(kept[0].id).toBe(`d-${webhookId}-052`);
    expect(kept.at(-1)!.id).toBe(`d-${webhookId}-003`);
  });

  test("deleting the webhook, the page or the account removes the deliveries", async () => {
    const db = await getDb();
    const count = (filter: object) => db.collection("webhook_deliveries").countDocuments(filter);
    const owner = await newUser();
    const [a, b] = [createId(10), createId(10)];
    await createWebhook(a, owner.userId, "https://hook.test/a", "s", ["page.published"]);
    await createWebhook(b, owner.userId, "https://hook.test/b", "s", ["page.published"]);
    await sendToWebhook((await getWebhook(a, owner.userId))!, "page.published", "pa", "{}");
    await sendToWebhook((await getWebhook(b, owner.userId))!, "page.published", "pb", "{}");
    await sendToWebhook((await getWebhook(b, owner.userId))!, "page.published", "pc", "{}");

    // Someone else's delete leaves the log alone.
    await deleteWebhook(a, "someone-else");
    expect(await count({ webhook_id: a })).toBe(1);
    await deleteWebhook(a, owner.userId);
    expect(await count({ webhook_id: a })).toBe(0);

    await deletePageAssociatedRecords("pb");
    expect(await count({ webhook_id: b })).toBe(1);

    await deleteAccount(owner.userId);
    expect(await count({ user_id: owner.userId })).toBe(0);
  });
});

test.describe("publish source", () => {
  test("a page shows the client it was last published from", async () => {
    const owner = await newUser();
    const publish = async (source?: string) => {
      const res = await v1Publish(
        new Request(`${ORIGIN}/api/v1/publish`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${owner.rawKey}`,
            "content-type": "application/json",
            ...(source ? { "x-booklet-source": source } : {}),
          },
          body: JSON.stringify({ raw: "# From a client\n\nBody." }),
        }),
      );
      expect(res.status).toBe(201);
      const { id } = await res.json();
      pageIds.push(id);
      return id as string;
    };
    const [cli, mcp, action, api] = [await publish("cli"), await publish("mcp"), await publish("github-action"), await publish()];

    const sources = async () =>
      Object.fromEntries((await getPagesByUser(owner.userId)).pages.map((p) => [p.id, p.last_source]));
    await expect.poll(sources).toEqual({ [cli]: "cli", [mcp]: "mcp", [action]: "github-action", [api]: "api" });

    // Edited in the browser afterwards: the row follows the latest publish.
    const edit = withSession(owner.cookie, `/api/publish/${cli}`, { method: "PATCH", body: { raw: "# Edited on the web\n\nBody." } });
    expect((await withRequestScope(edit, () => webUpdate(edit, { params: Promise.resolve({ id: cli }) }))).status).toBe(200);
    await expect.poll(async () => (await sources())[cli]).toBe("browser");
  });
});

test.describe("restoring a version", () => {
  test("restoring v1 of 3 adds v4 with v1's Markdown and puts the title, type and frontmatter back", async () => {
    const owner = await newUser();
    const v1 = "---\ntype: adr\nstatus: accepted\n---\n\n# ADR-001 First title\n\nOne.";
    const create = withSession(owner.cookie, "/api/publish", { body: { raw: v1 } });
    const created = await withRequestScope(create, () => webPublish(create));
    expect(created.status).toBe(200);
    const { id } = await created.json();
    pageIds.push(id);

    const update = async (raw: string) => {
      const req = withSession(owner.cookie, `/api/publish/${id}`, { method: "PATCH", body: { raw } });
      expect((await withRequestScope(req, () => webUpdate(req, { params: Promise.resolve({ id }) }))).status).toBe(200);
    };
    const versionCount = async () => (await getPageVersions(id)).length;

    await expect.poll(versionCount).toBe(1);
    await update("# Second title\n\nTwo.");
    await expect.poll(versionCount).toBe(2);
    await update("---\ntype: rfc\n---\n\n# Third title\n\nThree.");
    await expect.poll(versionCount).toBe(3);
    expect(await getPageRecord(id)).toMatchObject({ title: "Third title", doc_type: "rfc" });

    // What the version history's "Restore" sends: the stored Markdown of v1.
    await update(v1);
    await expect.poll(versionCount).toBe(4);
    expect((await getDoc(id))!.raw).toBe(v1);
    expect(await getPageRecord(id)).toMatchObject({
      title: "ADR-001 First title",
      doc_type: "adr",
      frontmatter_meta: { type: "adr", status: "accepted" },
    });
  });
});

test.describe("import from URL", () => {
  const ok = (body: string, contentType = "text/plain; charset=utf-8") => ({
    status: 200,
    location: null,
    contentType,
    body: Buffer.from(body),
    truncated: false,
  });
  const publicHost: ImportDeps["resolve"] = async () => ({ safe: true, addresses: [{ address: "203.0.113.7", family: 4 }] });

  test("a github.com blob link is fetched from raw.githubusercontent.com", async () => {
    expect(toRawGithubUrl("https://github.com/owner/repo/blob/main/docs/README.md?plain=1#L3").toString()).toBe(
      "https://raw.githubusercontent.com/owner/repo/main/docs/README.md",
    );
    expect(toRawGithubUrl(" https://raw.githubusercontent.com/o/r/main/a.markdown ").hostname).toBe("raw.githubusercontent.com");
  });

  test("anything but an https GitHub Markdown file is refused before any request", async () => {
    let requests = 0;
    const deps: ImportDeps = {
      resolve: async (h) => (requests++, resolveHostForDelivery(h)),
      get: async () => (requests++, ok("x")),
    };
    for (const url of [
      "http://127.0.0.1/a.md",
      "https://127.0.0.1/a.md",
      "https://10.0.0.5/a.md",
      "https://169.254.169.254/latest/meta-data/a.md",
      "https://[::1]/a.md",
      "https://localhost/a.md",
      "http://raw.githubusercontent.com/o/r/main/a.md",
      "https://raw.githubusercontent.com:8443/o/r/main/a.md",
      "https://user:pw@raw.githubusercontent.com/o/r/main/a.md",
      "https://raw.githubusercontent.com.evil.example/o/r/main/a.md",
      "https://evil.example/raw.githubusercontent.com/o/r/main/a.md",
      "https://gist.github.com/o/abc/raw/a.md",
      "https://github.com/o/r/tree/main/docs",
      "https://github.com/o/r/blob/main/logo.png",
      "https://raw.githubusercontent.com/o/r/main/secrets.env",
      "file:///etc/passwd.md",
      "not a url",
      42,
    ]) {
      await expect(importMarkdownFromUrl(url, deps), String(url)).rejects.toMatchObject({ httpStatus: 422 });
    }
    expect(requests).toBe(0);
  });

  test("a host that resolves to a private address is refused without a request", async () => {
    let gets = 0;
    const deps: ImportDeps = { resolve: () => resolveHostForDelivery("127.0.0.1"), get: async () => (gets++, ok("x")) };
    await expect(importMarkdownFromUrl("https://raw.githubusercontent.com/o/r/main/a.md", deps)).rejects.toMatchObject({
      httpStatus: 422,
      message: "That address cannot be imported from.",
    });
    expect(gets).toBe(0);
  });

  test("a redirect to another host, or off https, is refused; one on the same host is followed and checked again", async () => {
    const redirect = (location: string) => ({ status: 302, location, contentType: "", body: Buffer.alloc(0), truncated: false });
    const to = (location: string): ImportDeps => ({ resolve: publicHost, get: async () => redirect(location) });
    const url = "https://raw.githubusercontent.com/o/r/main/a.md";
    for (const location of ["https://evil.example/a.md", "http://raw.githubusercontent.com/o/r/main/a.md", "//169.254.169.254/a.md", "https://raw.githubusercontent.com:444/a.md"]) {
      await expect(importMarkdownFromUrl(url, to(location)), location).rejects.toMatchObject({ httpStatus: 422 });
    }

    const seen: string[] = [];
    let resolves = 0;
    const sameHost: ImportDeps = {
      resolve: async (h) => (resolves++, publicHost(h)),
      get: async (u) => {
        seen.push(u.pathname);
        return seen.length === 1 ? redirect("/o/r/refs/heads/main/a.md") : ok("# Moved");
      },
    };
    expect((await importMarkdownFromUrl(url, sameHost)).raw).toBe("# Moved");
    expect(seen).toEqual(["/o/r/main/a.md", "/o/r/refs/heads/main/a.md"]);
    expect(resolves).toBe(2);

    // A loop ends.
    await expect(importMarkdownFromUrl(url, to("/o/r/main/a.md"))).rejects.toMatchObject({ httpStatus: 422 });
  });

  test("a public README becomes the draft's text; too large, binary, empty and missing files are refused", async () => {
    const url = "https://github.com/o/r/blob/main/README.md";
    const got = await importMarkdownFromUrl(url, { resolve: publicHost, get: async () => ok("﻿# Read me\n\nHello.") });
    expect(got).toEqual({ raw: "# Read me\n\nHello.", title: "README", source_url: "https://raw.githubusercontent.com/o/r/main/README.md" });

    const withGet = (res: ReturnType<typeof ok>) => importMarkdownFromUrl(url, { resolve: publicHost, get: async () => res });
    await expect(withGet(ok("a".repeat(200_000)))).resolves.toMatchObject({ title: "README" });
    await expect(withGet(ok("a".repeat(200_001)))).rejects.toMatchObject({ httpStatus: 413 });
    await expect(withGet({ ...ok("a"), truncated: true })).rejects.toMatchObject({ httpStatus: 413 });
    await expect(withGet(ok("x", "image/png"))).rejects.toMatchObject({ httpStatus: 422 });
    await expect(withGet({ ...ok(""), body: Buffer.from([0xff, 0xfe, 0x00]) })).rejects.toMatchObject({ httpStatus: 422 });
    await expect(withGet(ok("  \n"))).rejects.toMatchObject({ httpStatus: 422 });
    await expect(withGet({ ...ok(""), status: 404 })).rejects.toMatchObject({ httpStatus: 404 });
    await expect(withGet({ ...ok(""), status: 500 })).rejects.toMatchObject({ httpStatus: 502 });
  });

  test("the pinned GET stops reading at the byte limit and never follows a redirect", async () => {
    const big = await stub((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("a".repeat(5000));
    });
    const res = await pinnedGet(new URL(`http://files.test:${big.port}/a.md`), "127.0.0.1", 4, 1000);
    expect(res.truncated).toBe(true);
    expect(res.body.length).toBeLessThanOrEqual(1000);

    const target = await stub((_req, res) => res.writeHead(200).end("secret"));
    const hop = await stub((_req, res) => res.writeHead(302, { location: `http://127.0.0.1:${target.port}/` }).end());
    const redirected = await pinnedGet(new URL(`http://files.test:${hop.port}/a.md`), "127.0.0.1", 4);
    expect(redirected.status).toBe(302);
    expect(target.hits()).toBe(0);
  });

  test("the route refuses another site's page and a bad URL", async () => {
    const cross = withSession(null, "/api/import", { body: { url: "https://github.com/o/r/blob/main/README.md" }, origin: "https://evil.example" });
    expect((await importRoute(cross)).status).toBe(403);
    const bad = withSession(null, "/api/import", { body: { url: "https://127.0.0.1/a.md" } });
    const res = await importRoute(bad);
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("IMPORT_REFUSED");
  });
});
