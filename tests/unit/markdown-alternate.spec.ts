import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { useTestEnv, seedDoc, cleanupPages, throughMiddleware } from "./helpers/pages";
import { getDb } from "@/lib/mongodb";
import { createPageRecord, updatePageRecord } from "@/lib/db";
import { takeDownPage } from "@/server/moderation";
import middleware from "@/middleware";
import { GET as markdown } from "@/app/api/pages/[id]/markdown/route";

// `/p/:id.md` and `Accept: text/markdown` return a page's raw Markdown —
// for pages anyone with the link may read, and nothing else.

const RAW = "# Secret title\n\nBody text.";
const ids: string[] = [];
const USER = `testuser${crypto.randomUUID()}`;

/** Follows the middleware's rewrite into the real route, as Next would. */
async function fetchPage(path: string, accept?: string): Promise<Response> {
  const res = await middleware(new NextRequest(`http://localhost${path}`, accept ? { headers: { accept } } : undefined));
  const rewrite = res.headers.get("x-middleware-rewrite");
  if (!rewrite) return res;
  const m = /^\/api\/pages\/([^/]+)\/markdown$/.exec(new URL(rewrite).pathname);
  if (!m) throw new Error(`unexpected rewrite: ${rewrite}`);
  return markdown(new Request(rewrite), { params: Promise.resolve({ id: decodeURIComponent(m[1]) }) });
}

async function seedPage(patch?: Parameters<typeof updatePageRecord>[1]) {
  const id = await seedDoc(RAW);
  ids.push(id);
  await createPageRecord(id, USER, "Secret title");
  if (patch) await updatePageRecord(id, patch);
  return id;
}

test.beforeAll(() => useTestEnv());
test.afterAll(() => cleanupPages(ids, [USER]));

for (const visibility of ["public", "unlisted"] as const) {
  test(`${visibility} page: .md and Accept: text/markdown both return the Markdown`, async () => {
    const id = await seedPage({ visibility });
    for (const res of [await fetchPage(`/p/${id}.md`), await fetchPage(`/p/${id}`, "text/markdown")]) {
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
      expect(await res.text()).toBe(RAW);
    }
  });
}

test("a custom slug and an anonymous page work too", async () => {
  const slug = `md-${crypto.randomUUID().slice(0, 8)}`;
  await seedPage({ slug });
  expect(await (await fetchPage(`/p/${slug}.md`)).text()).toBe(RAW);

  const anon = await seedDoc(RAW);
  ids.push(anon);
  expect((await fetchPage(`/p/${anon}.md`)).status).toBe(200);
});

test("password-protected, taken-down, unknown-visibility and missing pages are 404", async () => {
  const locked = await seedPage({ password_hash: "600000:salt:hash" });
  const takenDown = await seedPage({ visibility: "public" });
  await takeDownPage(takenDown);
  // "team" does not exist until Phase 5; the route must already refuse it.
  const team = await seedPage();
  await (await getDb()).collection("pages").updateOne({ _id: team } as never, { $set: { visibility: "team" } });

  for (const id of [locked, takenDown, team, "nopenope00"]) {
    for (const res of [await fetchPage(`/p/${id}.md`), await fetchPage(`/p/${id}`, "text/markdown")]) {
      expect(res.status, id).toBe(404);
      expect(await res.text()).not.toContain("Secret");
    }
  }
});

test("a browser still gets HTML, with a Link header pointing at the Markdown", async () => {
  const id = await seedPage();
  const res = await throughMiddleware(`/p/${id}`);
  expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  expect(res.headers.get("link")).toBe(`</p/${id}.md>; rel="alternate"; type="text/markdown"`);
  expect(res.headers.get("vary")).toContain("Accept");

  // A browser's Accept lists text/html; it must not be handed Markdown.
  const browser = await middleware(
    new NextRequest(`http://localhost/p/${id}`, { headers: { accept: "text/html,application/xhtml+xml,text/markdown;q=0.5" } }),
  ).catch(() => null);
  expect(browser?.headers.get("x-middleware-rewrite") ?? null).toBeNull();

  // The embed route is never rewritten.
  const embed = await throughMiddleware(`/p/${id}/embed`);
  expect(embed.headers.get("link")).toBeNull();
});
