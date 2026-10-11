import { test, expect, type APIRequestContext, type Browser, type BrowserContext } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { getDb } from "@/lib/mongodb";

// Phase 5c in a real browser: the dashboard split, publish source, the
// webhook delivery log, version diff and restore, import from URL, and the
// HTML export's Mermaid diagrams.

const PASSWORD = "dashboard-e2e-correct-horse";
const uniqueEmail = (tag: string) => `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;

// An address per browser context: signups are limited per IP (see accounts.spec.ts).
const ip = () => ({
  "cf-connecting-ip": `2001:db8:5c::${Math.random().toString(16).slice(2, 6)}:${Math.random().toString(16).slice(2, 6)}`,
});

type Person = { context: BrowserContext; request: APIRequestContext; userId: string };

// Every context a test opens is closed when it ends. Left open, their pages
// stay alive in the browser for the rest of the run and slow later tests.
const opened: BrowserContext[] = [];
async function newContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({ extraHTTPHeaders: ip() });
  opened.push(context);
  return context;
}
test.afterEach(async () => {
  for (const context of opened.splice(0)) await context.close();
});

async function person(browser: Browser, tag: string): Promise<Person> {
  const context = await newContext(browser);
  const res = await context.request.post("/api/auth/signup", { data: { email: uniqueEmail(tag), password: PASSWORD } });
  expect(res.status()).toBe(201);
  const { userId } = (await (await context.request.get("/api/auth/me")).json()) as { userId: string };
  return { context, request: context.request, userId };
}

async function publish(who: Person, raw: string): Promise<string> {
  const res = await who.request.post("/api/publish", { data: { raw } });
  expect(res.status(), await res.text()).toBe(200);
  return ((await res.json()) as { id: string }).id;
}

test("API keys and webhooks live under Settings, and a page published by the CLI says so", async ({ browser }) => {
  const owner = await person(browser, "split");
  const page = await owner.context.newPage();

  await page.goto("/settings/api-keys");
  await expect(page.getByRole("heading", { level: 1, name: "API keys" })).toBeVisible();
  await page.getByLabel("Label for the new key (optional)").fill("laptop");
  await page.getByRole("button", { name: "Create key" }).click();
  const key = (await page.locator("code", { hasText: /^bklt_/ }).first().textContent())!.trim();
  await expect(page.getByText("Last used Never")).toBeVisible();

  // What the CLI sends: the key, and its name in X-Booklet-Source.
  const res = await owner.request.post("/api/v1/publish", {
    headers: { authorization: `Bearer ${key}`, "x-booklet-source": "cli" },
    data: { raw: "# Published from a terminal\n\nBody." },
  });
  expect(res.status()).toBe(201);
  await publish(owner, "# Published from the editor\n\nBody.");

  await page.goto("/my-pages");
  await expect(page.getByRole("heading", { level: 1, name: "My pages" })).toBeVisible();
  const row = (title: string) => page.getByTestId("page-card").filter({ has: page.getByRole("link", { name: title }) });
  await expect(row("Published from a terminal")).toContainText("Published from CLI");
  await expect(row("Published from the editor")).toContainText("Published from Web");
  // The two sections that moved are gone from the dashboard.
  await expect(page.getByRole("heading", { name: "API keys" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Webhooks" })).toHaveCount(0);

  await page.goto("/settings/api-keys");
  await expect(page.getByText("laptop")).toBeVisible();
  await expect(page.getByText("Last used Never")).toHaveCount(0);

  // The account menu reaches both.
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("link", { name: "Webhooks" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Webhooks" })).toBeVisible();
});

test("a failed webhook delivery is listed, and Resend adds a second row", async ({ browser }) => {
  const owner = await person(browser, "hook");
  // Written straight to the database: the form refuses a URL that does not
  // resolve to a public address, and a test must not call a real one. The
  // delivery itself is refused for the same reason, which is a failure the
  // log has to show.
  const webhookId = `e2ehook${Date.now()}`;
  await (await getDb()).collection("webhooks").insertOne({
    _id: webhookId,
    user_id: owner.userId,
    url: "http://127.0.0.1:9/hook",
    secret: "e2e-secret",
    events: ["page.published"],
    created_at: new Date().toISOString(),
    last_triggered_at: null,
  } as never);

  const pageId = await publish(owner, "# Fires a webhook\n\nBody.");
  const page = await owner.context.newPage();
  const rows = page.getByTestId("webhook-deliveries").getByRole("listitem");
  await expect(async () => {
    await page.goto("/settings/webhooks");
    await page.getByText(/^Deliveries \(\d+\)$/).click();
    await expect(rows).toHaveCount(1, { timeout: 1000 });
  }).toPass();
  await expect(rows.first()).toContainText("No response");
  await expect(rows.first()).toContainText("page.published");
  await expect(rows.first()).toContainText(pageId);

  await rows.first().getByRole("button", { name: "Resend" }).click();
  await expect(rows).toHaveCount(2);
  await expect(page.getByText("Deliveries (2)")).toBeVisible();

  // Someone else cannot resend it, or see it.
  const other = await person(browser, "hook-other");
  const delivery = await (await getDb()).collection("webhook_deliveries").findOne({ webhook_id: webhookId });
  const stolen = await other.request.post(`/api/webhooks/${webhookId}/deliveries/${String(delivery!._id)}/resend`);
  expect(stolen.status()).toBe(404);
  const theirs = await other.context.newPage();
  await theirs.goto("/settings/webhooks");
  await expect(theirs.getByText(pageId)).toHaveCount(0);

  await (await getDb()).collection("webhooks").deleteOne({ _id: webhookId } as never);
  await (await getDb()).collection("webhook_deliveries").deleteMany({ webhook_id: webhookId });
});

test("version history shows a line diff, and restoring v1 of 3 adds v4 with v1's content", async ({ browser }) => {
  const owner = await person(browser, "versions");
  const v1 = "---\ntype: adr\nstatus: Proposed\n---\n\n# ADR-001 Queue retries\n\nRetry three times.";
  const id = await publish(owner, v1);
  const versions = async () =>
    ((await (await owner.request.get(`/api/pages/${id}/versions`)).json()) as { versions: unknown[] }).versions.length;
  const update = async (raw: string, expected: number) => {
    expect((await owner.request.patch(`/api/publish/${id}`, { data: { raw } })).status()).toBe(200);
    await expect.poll(versions).toBe(expected);
  };
  await expect.poll(versions).toBe(1);
  await update(v1.replace("Proposed", "Accepted"), 2);
  await update(v1.replace("Proposed", "Accepted").replace("three times", "five times, then page someone"), 3);

  const page = await owner.context.newPage();
  await page.goto(`/my-pages/versions/${id}`);
  await page.getByLabel("From", { exact: true }).selectOption("1");
  await page.getByLabel("To", { exact: true }).selectOption("3");
  await page.getByRole("button", { name: "Compare" }).click();
  await expect(page.getByTestId("diff-summary")).toHaveText("v1 to v3: 2 lines added, 2 removed.");
  const diff = page.getByTestId("version-diff");
  // Frontmatter is part of the diff.
  await expect(diff.locator('[data-op="del"]')).toContainText(["status: Proposed", "Retry three times."]);
  await expect(diff.locator('[data-op="add"]')).toContainText(["status: Accepted", "Retry five times, then page someone"]);
  await expect(diff.locator('[data-op="same"]').first()).toContainText("---");

  await page.getByTestId("version-1").getByRole("button", { name: "Restore" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Restore v1" });
  await expect(confirm).toContainText("Restoring adds a new version, v4, with the content of v1.");
  await expect(confirm).toContainText("stays in the history as v3");
  await confirm.getByRole("button", { name: "Restore as v4" }).click();

  await expect(page.getByTestId("version-4")).toBeVisible();
  await page.getByLabel("From", { exact: true }).selectOption("1");
  await page.getByLabel("To", { exact: true }).selectOption("4");
  await page.getByRole("button", { name: "Compare" }).click();
  await expect(page.getByTestId("diff-summary")).toHaveText("v1 and v4 have the same Markdown.");

  // The published page is v1 again, header strip included.
  await page.goto(`/p/${id}`);
  await expect(page.getByText("Retry three times.")).toBeVisible();
  await expect(page.getByText("Proposed").first()).toBeVisible();

  // Version history is the owner's alone.
  const other = await person(browser, "versions-other");
  expect((await other.request.get(`/api/pages/${id}/versions/1`)).status()).toBe(403);
  const theirs = await other.context.newPage();
  expect((await theirs.goto(`/my-pages/versions/${id}`))!.status()).toBe(404);
});

test("Import from URL opens the fetched file as a new draft", async ({ browser }) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  // The outbound fetch is covered by tests/unit/dashboard.spec.ts; here the
  // answer is canned so the test does not depend on GitHub.
  let asked = "";
  await page.route("**/api/import", async (route) => {
    asked = (route.request().postDataJSON() as { url: string }).url;
    await route.fulfill({ json: { raw: "# Imported readme\n\nFrom a repository.", title: "README", source_url: asked } });
  });

  await page.goto("/app");
  await page.waitForSelector("textarea");
  await page.getByRole("button", { name: "More options" }).click();
  await page.getByRole("button", { name: /Import from URL/ }).click();
  const dialog = page.getByRole("dialog", { name: "Import from URL" });
  await dialog.getByLabel("File URL").fill("https://github.com/owner/repo/blob/main/README.md");
  await dialog.getByRole("button", { name: "Import" }).click();

  await expect(page.locator("textarea").first()).toHaveValue("# Imported readme\n\nFrom a repository.");
  expect(asked).toBe("https://github.com/owner/repo/blob/main/README.md");
  await expect(dialog).toBeHidden();
});

test("Import from URL refuses a private address, and says why", async ({ browser }) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  await page.goto("/app");
  await page.waitForSelector("textarea");
  await page.getByRole("button", { name: "More options" }).click();
  await page.getByRole("button", { name: /Import from URL/ }).click();
  const dialog = page.getByRole("dialog", { name: "Import from URL" });
  await dialog.getByLabel("File URL").fill("https://169.254.169.254/latest/meta-data/notes.md");
  await dialog.getByRole("button", { name: "Import" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Only https://github.com and https://raw.githubusercontent.com links can be imported.");
  await expect(dialog).toBeVisible();
});

test("the HTML export carries the rendered Mermaid diagram as inline SVG, with no source block", async ({ browser }) => {
  const owner = await person(browser, "export");
  const id = await publish(owner, "# Flow\n\n```mermaid\ngraph TD\n  Alpha[Receive job] --> Beta[Retry queue]\n```\n\nAfter.");
  const page = await owner.context.newPage();
  // Exported in the dark theme: the file's diagram is light either way, and
  // does not depend on what the page itself has drawn.
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.goto(`/p/${id}`);

  await page.getByRole("button", { name: "Export" }).first().click();
  await expect(page.getByText("Print to PDF")).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByText("Download HTML").click()]);
  const html = await readFile((await download.path())!, "utf8");

  expect(html).toContain("<svg");
  // Labels are SVG text, which survives the sanitizer; foreignObject would not.
  expect(html).toMatch(/<text[^>]*>.*Receive.*<\/text>/);
  expect(html).toContain("Retry");
  expect(html).not.toContain("language-mermaid");
  expect(html).not.toContain("graph TD");
  expect(html).not.toMatch(/foreignObject|<script|\son[a-z]+=/i);
  expect(html).toContain("fill:#333");
});
