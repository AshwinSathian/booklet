import { test, expect } from "@playwright/test";
// The Worker is plain JavaScript with no build step; this is its one export besides the handler.
import worker, { originIsDown } from "../../infra/fallback-worker/src/index.js";

const CSP = { "content-security-policy": "default-src 'self'" };
const res = (status: number, headers: Record<string, string> = {}) => new Response(status === 204 ? null : "x", { status, headers });

test("the Worker steps in only when the origin did not write the response", () => {
  // Cloudflare's own errors: the tunnel has no connection (530), and its neighbours.
  for (const status of [520, 521, 522, 523, 524, 530]) expect(originIsDown(res(status)), String(status)).toBe(true);
  // A gateway error without the header Booklet puts on every response is not Booklet's.
  for (const status of [502, 503, 504]) expect(originIsDown(res(status)), String(status)).toBe(true);
  // The app's own 5xx, and everything that is not an outage, passes through.
  for (const status of [502, 503, 504]) expect(originIsDown(res(status, CSP)), `${status} from the app`).toBe(false);
  for (const status of [200, 204, 301, 404, 410, 429, 500]) expect(originIsDown(res(status)), String(status)).toBe(false);
});

test("an unreachable origin gives a browser a page and an API client a problem document, both 503", async () => {
  // A port nothing listens on: the fetch throws.
  const env = { ORIGIN: "http://127.0.0.1:9" };
  const page = await worker.fetch(new Request("https://booklet.test/p/some-page", { headers: { accept: "text/html" } }), env);
  expect(page.status).toBe(503);
  expect(page.headers.get("retry-after")).toBe("120");
  expect(page.headers.get("cache-control")).toBe("no-store");
  expect(page.headers.get("content-type")).toContain("text/html");
  const html = await page.text();
  expect(html).toContain("Booklet is not reachable right now");
  expect(html).toContain("public beta");

  const api = await worker.fetch(new Request("https://booklet.test/api/v1/pages", { headers: { accept: "application/json" } }), env);
  expect(api.status).toBe(503);
  expect(api.headers.get("content-type")).toBe("application/problem+json");
  expect(await api.json()).toMatchObject({ status: 503, title: "Service Unavailable" });

  // A form post is not answered with a page, whatever it accepts.
  const post = await worker.fetch(new Request("https://booklet.test/api/publish", { method: "POST", body: "{}", headers: { accept: "text/html" } }), env);
  expect(post.headers.get("content-type")).toBe("application/problem+json");
});

test("the day's count starts again at midnight UTC and is over from 95% of the limit", async () => {
  const { tally } = await import("../../infra/fallback-worker/src/index.js");
  expect(tally(undefined, "2026-10-11", 10)).toEqual({ day: "2026-10-11", total: 10, over: false });
  expect(tally({ day: "2026-10-11", total: 94_985 }, "2026-10-11", 10).over).toBe(false);
  expect(tally({ day: "2026-10-11", total: 94_990 }, "2026-10-11", 10)).toEqual({ day: "2026-10-11", total: 95_000, over: true });
  // Yesterday's total does not carry over.
  expect(tally({ day: "2026-10-11", total: 99_000 }, "2026-10-12", 1)).toEqual({ day: "2026-10-12", total: 1, over: false });
});

test("once the counter says the day is over, the Worker answers itself and sends nothing to the origin", async () => {
  // A counter that is already over. The origin is a port nothing listens on: reaching it would give the other page.
  const counter = { idFromName: () => "id", get: () => ({ fetch: async () => Response.json({ day: new Date().toISOString().slice(0, 10), total: 95_000, over: true }) }) };
  const env = { ORIGIN: "http://127.0.0.1:9", COUNTER: counter };
  const waits: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => waits.push(p) };
  const get = () => worker.fetch(new Request("https://booklet.test/", { headers: { accept: "text/html" } }), env, ctx);
  // The first request is how this isolate learns it.
  expect(await (await get()).text()).toContain("not reachable");
  await Promise.all(waits);
  const page = await get();
  expect(page.status).toBe(503);
  expect(await page.text()).toContain("closed until midnight UTC");
  const retry = Number(page.headers.get("retry-after"));
  expect(retry).toBeGreaterThan(0);
  expect(retry).toBeLessThanOrEqual(86400);
  const api = await worker.fetch(new Request("https://booklet.test/api/v1/pages"), env, ctx);
  expect(await api.json()).toMatchObject({ status: 503, detail: expect.stringContaining("00:00 UTC") });
});

test("plain HTTP is redirected to HTTPS before anything is fetched", async () => {
  // The Worker remembers what the counter last said; an earlier test left it closed. Tell it the day is open.
  const open = { idFromName: () => "id", get: () => ({ fetch: async () => Response.json({ day: new Date().toISOString().slice(0, 10), total: 1, over: false }) }) };
  const waits: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => waits.push(p) };
  for (let i = 0; i < 10 && !waits.length; i++) await worker.fetch(new Request("https://booklet.test/", { method: "HEAD" }), { ORIGIN: "http://127.0.0.1:9", COUNTER: open }, ctx);
  await Promise.all(waits);
  const res = await worker.fetch(new Request("http://booklet.test/p/a?b=1"), {});
  expect(res.status).toBe(301);
  expect(res.headers.get("location")).toBe("https://booklet.test/p/a?b=1");
});
