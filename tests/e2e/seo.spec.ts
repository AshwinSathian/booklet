import { test, expect, type APIRequestContext } from "@playwright/test";

// What a crawler and a chat app's link preview get. Each check here is a
// fault the site has had.

const ip = () => ({ "cf-connecting-ip": `2001:db8:5e0::${Math.random().toString(16).slice(2, 6)}` });
const PASSWORD = "seo-e2e-correct-horse";

async function account(request: APIRequestContext) {
  const email = `e2e-seo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  expect((await request.post("/api/auth/signup", { data: { email, password: PASSWORD }, headers: ip() })).status()).toBe(201);
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(body: Buffer) {
  expect(body.subarray(1, 4).toString("latin1")).toBe("PNG");
  return { width: body.readUInt32BE(16), height: body.readUInt32BE(20) };
}

test("link-preview images are 1200 by 630 PNGs, one per kind of page", async ({ request }) => {
  for (const path of ["/og/site.png", "/og/docs/quickstart.png", "/og/docs/guides/mcp.png", "/og/templates/incident-report.png"]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    expect(res.headers()["content-type"], path).toBe("image/png");
    expect(res.headers()["cache-control"], path).toContain("public");
    expect(pngSize(await res.body()), path).toEqual({ width: 1200, height: 630 });
  }
  expect((await request.get("/og/docs/no-such-page.png")).status()).toBe(404);
  // The old SVG addresses, which links shared earlier still ask for.
  for (const old of ["/opengraph-image", "/twitter-image"]) {
    const res = await request.get(old, { maxRedirects: 0 });
    expect(res.status(), old).toBe(308);
    expect(res.headers().location, old).toBe("/og/site.png");
  }
});

test("every kind of page names a PNG preview of its own, and the icons a phone needs", async ({ page }) => {
  const image = async (path: string) => {
    await page.goto(path);
    expect(await page.locator('link[rel="apple-touch-icon"]').getAttribute("href"), path).toBe("/icons/apple-touch-icon.png");
    expect(await page.locator('meta[property="og:image:type"]').getAttribute("content"), path).toBe("image/png");
    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(await page.locator('meta[name="twitter:image"]').getAttribute("content"), path).toBe(og);
    return new URL(og!).pathname;
  };
  expect(await image("/")).toBe("/og/site.png");
  expect(await image("/docs/guides/cli")).toBe("/og/docs/guides/cli.png");
  expect(await image("/templates/runbook")).toBe("/og/templates/runbook.png");
});

test("robots.txt lets a crawler fetch the styles and scripts, and the sitemap lists only what is indexed", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).not.toContain("/_next");
  expect(robots).toContain("Disallow: /api/");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).not.toMatch(/<loc>[^<]*\/app<\/loc>/);
  expect(sitemap).toContain("/docs/quickstart</loc>");
  expect(sitemap).toContain("/templates/incident-report</loc>");
  // No date is given where none is known.
  expect(sitemap).not.toMatch(/\/docs\/quickstart<\/loc>\s*<lastmod>/);
});

test("a public page is in the sitemap under its custom address, which is its one canonical URL", async ({ page }) => {
  await account(page.request);
  const slug = `seo-${Date.now()}`;
  const raw = `---\ntags: [seo-check]\n---\n\n# A public page for crawlers\n\nMIT\n\nThis paragraph is long enough to describe the page in a search result or a link preview.\n`;
  const published = await page.request.post("/api/publish", { data: { raw, visibility: "public" } });
  expect(published.status(), await published.text()).toBe(200);
  const { id } = (await published.json()) as { id: string };
  expect((await page.request.patch(`/api/pages/${id}`, { data: { slug } })).ok()).toBe(true);

  // The id redirects to the custom address.
  const byId = await page.request.get(`/p/${id}`, { maxRedirects: 0 });
  expect(byId.status()).toBe(308);
  expect(byId.headers().location).toBe(`/p/${slug}`);

  await page.goto(`/p/${slug}`);
  const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(new URL(canonical!).pathname).toBe(`/p/${slug}`);
  expect(new URL((await page.locator('meta[property="og:url"]').getAttribute("content"))!).pathname).toBe(`/p/${slug}`);
  expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("index");
  expect(await page.locator('meta[property="og:type"]').getAttribute("content")).toBe("article");
  expect(await page.locator('meta[property="article:published_time"]').getAttribute("content")).toMatch(/^\d{4}-\d\d-\d\dT/);
  // The description is the first paragraph that says something, not a one-word line.
  expect(await page.locator('meta[name="description"]').getAttribute("content")).toMatch(/^This paragraph is long enough/);
  // No site-wide author on someone's page.
  await expect(page.locator('meta[name="author"]')).toHaveCount(0);
  expect(new URL((await page.locator('meta[property="og:image"]').getAttribute("content"))!).pathname).toBe(`/og/p/${slug}.png`);
  const structured = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent())!) as { "@graph": Array<{ "@type": string; headline?: string }> };
  expect(structured["@graph"].map((node) => node["@type"])).toEqual(["TechArticle", "BreadcrumbList"]);
  expect(structured["@graph"][0].headline).toBe("A public page for crawlers");

  expect(await (await page.request.get("/sitemap.xml")).text()).toContain(`/p/${slug}</loc>`);

  // oEmbed, found from the page, answers with the frame.
  const oembedHref = await page.locator('link[type="application/json+oembed"]').getAttribute("href");
  const oembed = (await (await page.request.get(oembedHref!)).json()) as { type: string; title: string; html: string };
  expect(oembed.type).toBe("rich");
  expect(oembed.title).toBe("A public page for crawlers");
  expect(oembed.html).toContain(`/p/${slug}/embed`);

  // The embed is not a page of its own: it points at the page, and is not indexed.
  const embed = await page.request.get(`/p/${slug}/embed`);
  expect(embed.headers()["x-robots-tag"]).toContain("noindex");
  expect(await embed.text()).toContain(`rel="canonical" href="${canonical}"`);
});

test("pages that are not for a search engine say so, and listing pages still pass their links on", async ({ page, request }) => {
  for (const path of ["/explore", "/tags"]) {
    await page.goto(path);
    expect(await page.locator('meta[name="robots"]').getAttribute("content"), path).toBe("noindex, follow");
  }
  await page.goto("/t/join");
  expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
  await expect(page).toHaveTitle(/Join a space/);
  // A missing embed is a 404, not a page that says "not found" with status 200.
  expect((await request.get("/p/no-such-page-here/embed")).status()).toBe(404);
  // A broken escape in the address is the visitor's mistake, not the server's.
  expect((await request.get("/tags/%E0%A4%A")).status()).toBe(400);
  await page.goto("/this-page-is-not-here");
  await expect(page).toHaveTitle(/Page not found/);
});

test("structured data says only what the page shows", async ({ page }) => {
  await page.goto("/templates/runbook");
  const template = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(template).not.toContain("HowTo");
  expect(JSON.parse(template!)["@graph"][0]["@type"]).toBe("BreadcrumbList");
  await expect(page).toHaveTitle(/template/i);

  await page.goto("/docs/reference/limits");
  await expect(page).toHaveTitle("Limits — Docs — Booklet");
  const docs = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent())!) as { "@graph": Array<{ "@type": string }> };
  expect(docs["@graph"].map((node) => node["@type"])).toEqual(["TechArticle", "BreadcrumbList"]);

  await page.goto("/");
  expect((await page.title()).length).toBeLessThanOrEqual(60);
  await expect(page.locator('meta[name="author"]')).toHaveCount(0);
});
