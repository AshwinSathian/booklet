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
