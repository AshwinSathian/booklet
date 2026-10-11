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
    ["/settings/security", "Settings"],
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
    await expect(page.getByText(/no public pages/i), route).toHaveCount(1);
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
  for (const route of ["/my-pages", `/my-pages/versions/${pageId}`, "/settings/account", "/settings/security", "/t", `/t/${spaceSlug}/admin`]) {
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

test("the editor's startup overlay goes away even when the browser holds back animation frames", async ({ browser }) => {
  // A background tab gets no frames while its timers still run. The overlay's
  // entrance waits on frames and its exit on timers; if the entrance lands
  // last, it must not bring the overlay back.
  const context = await browser.newContext({ extraHTTPHeaders: ip() });
  await context.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf(() => setTimeout(() => raf(cb), 1500)) as unknown as number;
  });
  const page = await context.newPage();
  await page.goto("/app");
  const editor = page.getByRole("textbox", { name: "Write or paste Markdown…" });
  await expect(editor).toBeVisible();
  // Long enough for both held-back frames to have fired.
  await page.waitForTimeout(4000);
  await editor.click({ timeout: 3000 });
  await expect(editor).toBeFocused();
});

// ---- Close-out of the redesign: faults found by the last sweep and keyboard pass ----

test("the custom URL bar after publishing covers no control, at phone, tablet and desktop width", async ({ browser }) => {
  for (const viewport of [PHONE, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    const { page } = await seeded(browser, viewport);
    await page.goto("/app", { waitUntil: "networkidle" });
    const editor = page.getByRole("textbox", { name: "Write or paste Markdown…" });
    await editor.fill("# Slug bar\n\nBody.");
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    const bar = page.locator("[data-slug-bar]");
    await expect(bar, `${viewport.width}`).toBeVisible({ timeout: 15000 });
    const covered = await bar.evaluate((el) => {
      const b = el.getBoundingClientRect();
      return [...document.querySelectorAll("button, a, [role=tab], input, textarea")]
        .filter((c) => !el.contains(c))
        .filter((c) => {
          const r = c.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top;
        })
        .map((c) => c.getAttribute("aria-label") || c.getAttribute("title") || c.textContent?.trim().slice(0, 30));
    });
    expect(covered, `${viewport.width}`).toEqual([]);
    expect(await overflow(page), `${viewport.width}`).toBeLessThanOrEqual(1);
    if (viewport === PHONE) {
      // What hangs from the header still opens right under it, not under the bar.
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await expect(page.getByLabel("Close settings")).toBeVisible();
      const gap = await page.evaluate(() => {
        const header = document.getElementById("header")!.getBoundingClientRect();
        const panel = document.querySelector("[aria-label='Close settings']")!.closest(".absolute")!.getBoundingClientRect();
        return panel.top - header.bottom;
      });
      expect(gap).toBeLessThanOrEqual(16);
    }
    await page.context().close();
  }
});

test("the editor can be left, and its toolbar and palette used, from the keyboard alone", async ({ browser }) => {
  const { page } = await seeded(browser);
  await page.goto("/app", { waitUntil: "networkidle" });
  const editor = page.getByRole("textbox", { name: "Write or paste Markdown…" });
  await editor.fill("word");

  // A toolbar button acts on Enter, not only on a mouse press.
  await editor.selectText();
  await page.locator("button[title^='Bold']").focus();
  await page.keyboard.press("Enter");
  await expect(editor).toHaveValue("**word**");
  // Formatting hands focus back to the text a frame later; let that frame pass.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await expect(editor).toBeFocused();
  await page.locator("button[title^='Find & replace']").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Case sensitive" })).toBeVisible();
  await page.keyboard.press("Escape");

  // The palette gives focus back to where it was.
  await editor.focus();
  await page.keyboard.press("Control+k");
  await expect(page.getByPlaceholder("Jump to a draft, or run a command…")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(editor).toBeFocused();

  // Tab indents. Escape, then Tab, moves on.
  await page.keyboard.press("Tab");
  await expect(editor).toBeFocused();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  await expect(editor).not.toBeFocused();
});

test("the find bar's case toggle looks pressed when it is, and not like a hovered one", async ({ browser }) => {
  const { page } = await seeded(browser);
  await page.goto("/app", { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "Write or paste Markdown…" }).fill("Word word");
  await page.locator("button[title^='Find & replace']").click();
  const toggle = page.getByRole("button", { name: "Case sensitive" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(0, 0);
  // On is the inverted chip: the ink of a primary button, which no hover state uses.
  const ink = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.backgroundColor = "var(--color-accent)";
    document.body.append(probe);
    const colour = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return colour;
  });
  await expect.poll(() => toggle.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(ink);
});

test("a menu item that is active with no label of its own shows a tick", async ({ browser }) => {
  const { page } = await seeded(browser);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/my-pages", { waitUntil: "networkidle" });
  await page.getByLabel("More actions").first().click();
  const item = page.getByRole("menuitem", { name: /Copy embed code/ });
  await expect(item.locator("svg")).toHaveCount(1);
  await item.click();
  const copied = page.getByRole("menuitem", { name: /Copied/ });
  await expect(copied.locator("svg")).toHaveCount(2);
});

test("team settings keeps the header while it loads, and its refusals have a heading", async ({ browser }) => {
  const { page, spaceSlug } = await seeded(browser);
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/teams", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto(`/t/${spaceSlug}/admin`);
  await expect(page.getByRole("status", { name: "Loading space settings" })).toBeVisible();
  await expect(page.locator("header[data-app-header]")).toBeVisible();
  release();
  await expect(page.getByRole("heading", { level: 1, name: "Space settings" })).toBeVisible();
  await page.unroute("**/api/teams");

  await page.goto("/t/no-such-space-here/admin");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Space not found");
  await expect(page.locator("header[data-app-header]")).toHaveCount(1);
});

test("on a phone, a published page keeps a named link to the editor in both of its headers", async ({ browser }) => {
  const context = await browser.newContext({ extraHTTPHeaders: ip(), viewport: PHONE });
  const raw = `# A long page\n\n${"A paragraph that takes up room.\n\n".repeat(60)}`;
  const published = await context.request.post("/api/publish", { data: { raw } });
  expect(published.status(), await published.text()).toBe(200);
  const { id } = (await published.json()) as { id: string };
  const page = await context.newPage();
  await page.goto(`/p/${id}`);
  const cta = page.locator('[data-booklet-cta="make-your-own"]');
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAccessibleName("Write");
  // The compact header takes over once the page has scrolled.
  await page.mouse.wheel(0, 600);
  await expect(page.getByRole("button", { name: "Copy embed code" })).toBeHidden();
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAccessibleName("Write");
  for (const width of [360, 320]) {
    await page.setViewportSize({ width, height: 700 });
    await page.evaluate(() => window.scrollTo(0, 0));
    // Back at the top the full header returns: logo, export, embed, theme and the link.
    await expect(page.getByRole("button", { name: "Copy embed code" }), `${width}`).toBeVisible();
    expect(await overflow(page), `${width}`).toBeLessThanOrEqual(1);
    await expect(cta, `${width}`).toBeInViewport();
  }
});

test("on a phone, the draft's title is on screen before publishing", async ({ browser }) => {
  const { page } = await seeded(browser, PHONE);
  await page.goto("/app", { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "Write or paste Markdown…" }).fill("# Quarterly review\n\nBody.");
  const title = page.locator("button[title='Click to rename']");
  await expect(title).toContainText("Quarterly");
  expect((await title.boundingBox())!.width).toBeGreaterThan(60);
  // The visibility control still says what it is to a screen reader.
  await expect(page.getByLabel(/Who can find this page: /)).toBeVisible();
});

test("the slash menu opens at the caret and stays on screen, and the editor's dialogs are centred on it", async ({ browser }) => {
  for (const viewport of [PHONE, { width: 1440, height: 900 }]) {
    const { page } = await seeded(browser, viewport);
    await page.goto("/app", { waitUntil: "networkidle" });
    const editor = page.getByRole("textbox", { name: "Write or paste Markdown…" });
    // The drafts dialog covers the screen and sits in the middle of it, not on the top bar.
    // Control, as in the other specs: the project's browser reports itself as Windows.
    await editor.focus();
    await page.keyboard.press("Control+d");
    const dialog = page.getByRole("dialog", { name: "My drafts" });
    await expect(dialog, `${viewport.width}`).toBeVisible();
    const d = (await dialog.boundingBox())!;
    expect(d.y, `${viewport.width}`).toBeGreaterThanOrEqual(0);
    expect(d.y + d.height, `${viewport.width}`).toBeLessThanOrEqual(viewport.height);
    expect(Math.abs(d.x + d.width / 2 - viewport.width / 2), `${viewport.width}`).toBeLessThan(4);
    await page.keyboard.press("Escape");

    // Enough lines that the caret is near the bottom of the editor.
    await editor.fill(`# Title\n${"\nline".repeat(40)}\n`);
    await editor.focus();
    await page.keyboard.type("/");
    const menu = page.getByRole("button", { name: "Heading 1" }).locator("xpath=..");
    await expect(menu, `${viewport.width}`).toBeVisible();
    const box = (await menu.boundingBox())!;
    expect(box.y, `${viewport.width}`).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, `${viewport.width}`).toBeLessThanOrEqual(viewport.height);
    expect(box.x + box.width, `${viewport.width}`).toBeLessThanOrEqual(viewport.width);
    await page.keyboard.press("Escape");
    await page.context().close();
  }
});

// ---- 3.1.2 ----

test("an update that sends no settings keeps the page's theme and typeface", async ({ browser }) => {
  const { page } = await seeded(browser);
  const api = page.context().request;
  const settings = { spacing: "compact", width: "wide", code: "show", typeface: "serif", theme: "noir" };
  const published = await api.post("/api/publish", { data: { raw: "# Themed\n\nBody.", settings } });
  expect(published.status(), await published.text()).toBe(200);
  const { id } = (await published.json()) as { id: string };
  // The editor's own update route, with content only: what the CLI and the API send.
  expect((await api.patch(`/api/publish/${id}`, { data: { raw: "# Themed\n\nBody, edited." } })).ok()).toBe(true);
  await page.goto(`/p/${id}`);
  const body = page.getByText("Body, edited.");
  await expect(body).toBeVisible();
  // Still the noir theme and the serif face.
  await expect(page.locator('[class*="noir"]').first()).toBeAttached();
  expect(await body.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/serif/i);
});

test("pages are sent with no-transform, so a CDN leaves the markup React rendered alone", async ({ request }) => {
  for (const path of ["/privacy", "/terms", "/trust", "/"]) {
    const res = await request.get(path);
    expect(res.headers()["cache-control"], path).toContain("no-transform");
  }
});

test("/admin from an address that is not allowed is the site's own 404", async ({ browser }) => {
  const visitor = await (await browser.newContext({ extraHTTPHeaders: { "cf-connecting-ip": "203.0.113.9" } })).newPage();
  for (const path of ["/admin", "/admin/reports"]) {
    const res = await visitor.goto(path);
    expect(res!.status(), path).toBe(404);
    await expect(visitor.getByRole("heading", { level: 1 }), path).toHaveText("There is no page here.");
    await expect(visitor.locator("header[data-site-header]"), path).toHaveCount(1);
  }
});

test("when saving fails, the warning pushes the editor down and covers no control", async ({ browser }) => {
  const { page } = await seeded(browser, PHONE);
  await page.goto("/app", { waitUntil: "networkidle" });
  // Browser storage is full from here on.
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await page.getByRole("textbox", { name: "Write or paste Markdown…" }).fill("# Cannot be saved\n\nBody.");
  const warning = page.locator("[data-save-warning]");
  await expect(warning).toBeVisible({ timeout: 10000 });
  const covered = await warning.evaluate((el) => {
    const b = el.getBoundingClientRect();
    return [...document.querySelectorAll("button, a, [role=tab], textarea")]
      .filter((c) => !el.contains(c))
      .filter((c) => {
        const r = c.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top;
      })
      .map((c) => c.getAttribute("aria-label") || c.getAttribute("title") || c.textContent?.trim().slice(0, 30));
  });
  expect(covered).toEqual([]);
  expect(await overflow(page)).toBeLessThanOrEqual(1);
});

test("the editor's text shows that it has focus", async ({ browser }) => {
  const { page } = await seeded(browser);
  await page.goto("/app", { waitUntil: "networkidle" });
  const editor = page.getByRole("textbox", { name: "Write or paste Markdown…" });
  const shadow = () => editor.evaluate((el) => getComputedStyle(el).boxShadow);
  await page.getByRole("button", { name: "Settings", exact: true }).focus();
  const resting = await shadow();
  await editor.focus();
  expect(await shadow()).not.toBe(resting);
});

test("whatever can be clicked shows the pointer cursor, on the site, in the editor and behind it", async ({ browser }) => {
  const { page, pageId, spaceSlug } = await seeded(browser);
  const routes = [
    "/", "/docs", "/docs/quickstart", "/templates", "/templates/incident-report", "/pricing", "/changelog", "/trust", "/explore",
    "/app", "/my-pages", `/my-pages/versions/${pageId}`, `/my-pages/analytics/${pageId}`,
    "/settings/account", "/settings/security", "/settings/api-keys", "/settings/webhooks",
    "/t", `/t/${spaceSlug}`, `/t/${spaceSlug}/admin`, `/p/${pageId}`,
  ];
  for (const route of routes) {
    await page.goto(route, { waitUntil: "networkidle" });
    const wrong = await page.evaluate(() => {
      const clickable =
        'a[href], button, summary, select, [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="switch"], input[type="checkbox"], input[type="radio"], input[type="submit"]';
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>(clickable)) {
        // Something inert or not on screen has no cursor to show.
        // Nor is a read-only tick in a document's task list something to click.
        if (!el.checkVisibility() || el.closest("[inert]") || el.matches("[readonly]")) continue;
        const off = el.matches(":disabled") || el.getAttribute("aria-disabled") === "true";
        const cursor = getComputedStyle(el).cursor;
        if (cursor !== (off ? "not-allowed" : "pointer")) out.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}" has ${cursor}`);
      }
      return out;
    });
    expect(wrong, route).toEqual([]);
  }
});
