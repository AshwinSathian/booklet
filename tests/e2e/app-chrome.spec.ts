import { test, expect, type Browser, type Page } from "@playwright/test";

// The signed-in app on the Typeset system: one header on every page behind
// the editor, and layout faults that have happened before, each pinned at
// the width it broke at.

const PASSWORD = "app-chrome-e2e-correct-horse";
const PHONE = { width: 390, height: 844 };
// An address per browser context: signups are limited per IP (see accounts.spec.ts).
const ip = () => ({
  "cf-connecting-ip": `2001:db8:a9::${Math.random().toString(16).slice(2, 6)}:${Math.random().toString(16).slice(2, 6)}`,
});

type Seeded = { page: Page; pageId: string; spaceSlug: string; errors: string[] };

async function seeded(browser: Browser, viewport = { width: 1440, height: 900 }): Promise<Seeded> {
  const context = await browser.newContext({ extraHTTPHeaders: ip(), viewport });
  const email = `e2e-chrome-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  expect((await context.request.post("/api/auth/signup", { data: { email, password: PASSWORD } })).status()).toBe(201);
  const published = await context.request.post("/api/publish", {
    data: { raw: "# A page with a title long enough that a phone has to cut it short somewhere\n\nBody." },
  });
  expect(published.status()).toBe(200);
  const { id: pageId } = (await published.json()) as { id: string };
  const team = await context.request.post("/api/teams", { data: { name: `Chrome ${Date.now()}` } });
  expect(team.status()).toBe(201);
  const { slug: spaceSlug } = (await team.json()) as { slug: string };
  expect((await context.request.post("/api/v1/keys", { data: { label: "laptop" } })).ok()).toBe(true);

  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return { page, pageId, spaceSlug, errors };
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.afterEach(async ({ browser }) => {
  for (const context of browser.contexts()) await context.close();
});

test("every page behind the editor has the one header, with the current section marked", async ({ browser }) => {
  const { page, pageId, spaceSlug } = await seeded(browser);
  const routes: Array<[string, string | null]> = [
    ["/my-pages", "My pages"],
    [`/my-pages/analytics/${pageId}`, "My pages"],
    [`/my-pages/versions/${pageId}`, "My pages"],
    ["/settings/account", "Settings"],
    ["/settings/api-keys", "Settings"],
    ["/settings/webhooks", "Settings"],
    ["/t", "Spaces"],
    [`/t/${spaceSlug}`, "Spaces"],
    [`/t/${spaceSlug}/admin`, "Spaces"],
  ];
  for (const [route, current] of routes) {
    await page.goto(route);
    const header = page.locator("header[data-app-header]");
    await expect(header, route).toHaveCount(1);
    const nav = header.getByRole("navigation", { name: "App" });
    await expect(nav.getByRole("link"), route).toHaveText(["My pages", "Spaces", "Settings"]);
    await expect(nav.locator('[aria-current="page"]'), route).toHaveText(current ?? "");
    await expect(header.getByRole("button", { name: "Account menu" }), route).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 }), route).toHaveCount(1);
  }
});

test("a visitor to a public space sees Sign in, not the app's navigation", async ({ browser }) => {
  const { spaceSlug } = await seeded(browser);
  const visitor = await (await browser.newContext({ extraHTTPHeaders: ip() })).newPage();
  await visitor.goto(`/t/${spaceSlug}`);
  const header = visitor.locator("header[data-app-header]");
  await expect(header.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(header.getByRole("navigation", { name: "App" })).toHaveCount(0);
  await expect(header.getByRole("button", { name: "Account menu" })).toHaveCount(0);
});

test("collection and author pages use the public site header and footer", async ({ browser }) => {
  const { page } = await seeded(browser);
  const me = (await (await page.request.get("/api/auth/me")).json()) as { userId: string };
  const made = await page.request.post("/api/collections", { data: { name: "Runbooks" } });
  const body = (await made.json()) as { id?: string; collection?: { id: string } };
  for (const route of [`/u/${me.userId}`, `/c/${body.id ?? body.collection?.id}`]) {
    await page.goto(route);
    await expect(page.locator("header[data-site-header]"), route).toHaveCount(1);
    await expect(page.getByRole("contentinfo"), route).toHaveCount(1);
    await expect(page.getByText(/No public pages/), route).toHaveCount(1);
  }
});

test("on a phone, My pages fits the screen and its menus open inside it", async ({ browser }) => {
  const { page, errors } = await seeded(browser, PHONE);
  await page.goto("/my-pages", { waitUntil: "networkidle" });
  expect(await overflow(page)).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "More actions" }).first().click();
  const item = page.getByRole("menuitem", { name: /Analytics/ }).or(page.getByRole("link", { name: /Analytics/ })).first();
  await expect(item).toBeInViewport({ ratio: 1 });
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.locator("[data-account-menu]")).toBeInViewport({ ratio: 1 });
  expect(errors).toEqual([]);
});

test("dates render the same on the server and in a browser with another locale and time zone", async ({ browser }) => {
  // The server renders in its own locale; this browser is in neither that locale nor UTC.
  const context = await browser.newContext({ extraHTTPHeaders: ip(), locale: "de-DE", timezoneId: "Pacific/Auckland" });
  const email = `e2e-chrome-tz-${Date.now()}@example.test`;
  expect((await context.request.post("/api/auth/signup", { data: { email, password: PASSWORD } })).status()).toBe(201);
  expect((await context.request.post("/api/publish", { data: { raw: "# Dated\n\nBody." } })).status()).toBe(200);
  expect((await context.request.post("/api/v1/keys", { data: { label: "laptop" } })).ok()).toBe(true);
  expect(
    (await context.request.post("/api/webhooks", { data: { url: "https://example.com/hook", events: ["page.published"] } })).ok(),
  ).toBe(true);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  for (const route of ["/my-pages", "/settings/api-keys", "/settings/webhooks"]) {
    await page.goto(route, { waitUntil: "networkidle" });
    // "11 Oct 2026", whatever the browser's own locale would write.
    await expect(page.getByText(/\b\d{1,2} [A-Z][a-z]{2} \d{4}\b/).first(), route).toBeVisible();
  }
  // A production build reports a hydration mismatch as a minified error number.
  expect(errors.filter((e) => /hydrat|Minified React error #(418|423|425)/i.test(e))).toEqual([]);
});

test("on a phone, an empty draft opens on Write and the editor's panels stay on screen", async ({ browser }) => {
  const { page } = await seeded(browser, PHONE);
  await page.goto("/app", { waitUntil: "networkidle" });
  await expect(page.getByRole("tab", { name: "Write" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("textbox", { name: "Write or paste Markdown…" })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.locator("[data-settings-panel]")).toBeInViewport({ ratio: 1 });
  await expect(page.locator("[data-settings-panel]").getByText("Page colour")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.locator("[data-account-menu]")).toBeInViewport({ ratio: 1 });
});

test("command palette items are written in sentence case, under small-caps labels", async ({ browser }) => {
  const { page } = await seeded(browser);
  await page.goto("/app", { waitUntil: "networkidle" });
  await page.keyboard.press("Control+k");
  const item = page.getByRole("option", { name: "New draft" });
  await expect(item).toBeVisible();
  expect(await item.evaluate((el) => getComputedStyle(el).textTransform)).toBe("none");
  const label = page.locator("[cmdk-group-heading]").first();
  expect(await label.evaluate((el) => getComputedStyle(el).textTransform)).toBe("uppercase");
});

test("the analytics chart labels its axes in text that does not shrink with the chart", async ({ browser }) => {
  const { page, pageId, errors } = await seeded(browser, PHONE);
  await page.request.post("/api/analytics/view", { data: { pageId, event: "view", referrer: "" } });
  await page.goto(`/my-pages/analytics/${pageId}`, { waitUntil: "networkidle" });
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const last = page.getByText(today, { exact: true });
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport({ ratio: 1 });
  expect(await last.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(11);
  // One view is one tick, not two that round to the same number.
  await expect(page.locator("[data-y-axis] span")).toHaveText(["1"]);
  expect(errors).toEqual([]);
});

test("no page behind the editor uses a pill for a button", async ({ browser }) => {
  const { page, pageId, spaceSlug } = await seeded(browser);
  for (const route of ["/my-pages", `/my-pages/versions/${pageId}`, "/settings/account", "/t", `/t/${spaceSlug}/admin`]) {
    await page.goto(route, { waitUntil: "networkidle" });
    const pills = await page.evaluate(() =>
      [...document.querySelectorAll("main button, main a[class*='inline-flex']")]
        .filter((el) => {
          const box = el.getBoundingClientRect();
          return box.width > 60 && parseFloat(getComputedStyle(el).borderTopLeftRadius) >= box.height / 2;
        })
        .map((el) => el.textContent?.trim()),
    );
    expect(pills, route).toEqual([]);
  }
});

test("on a phone, every button in the editor's top bar can be reached and has a name", async ({ browser }) => {
  const { page } = await seeded(browser, PHONE);
  await page.goto("/app", { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "Write or paste Markdown…" }).fill("# A draft with a title\n\nBody.");
  // The draft title has almost no room here; its rename icon used to cover the button beside it.
  await page.getByRole("button", { name: "More options" }).click({ timeout: 3000 });
  await expect(page.getByRole("dialog", { name: "More" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "More" })).toBeHidden();
  const unnamed = await page.evaluate(() =>
    [...document.querySelectorAll("header#header button")]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .filter((el) => !(el.getAttribute("aria-label") || el.getAttribute("title") || (el as HTMLElement).innerText.trim()))
      .map((el) => el.outerHTML.slice(0, 80)),
  );
  expect(unnamed).toEqual([]);
  const publish = page.getByRole("button", { name: "Publish", exact: true });
  await expect(publish).toBeEnabled();
  await publish.click({ timeout: 3000 });
  await expect(page.getByRole("button", { name: /Copy link/ })).toBeVisible({ timeout: 15000 });
});
