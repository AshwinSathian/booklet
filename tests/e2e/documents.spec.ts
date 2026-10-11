import { test, expect, type APIRequestContext, type Browser, type BrowserContext } from "@playwright/test";

// Phase 5b in a real browser: document types and the header strip, links
// between published pages, team-only pages, and the team space home.

const PASSWORD = "documents-e2e-correct-horse";
const uniqueEmail = (tag: string) => `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;

// An address per browser context: signups are limited per IP, and this file
// makes more accounts than one address is allowed (see accounts.spec.ts).
const ip = () => ({
  "cf-connecting-ip": `2001:db8:5b::${Math.random().toString(16).slice(2, 6)}:${Math.random().toString(16).slice(2, 6)}`,
});

type Person = { context: BrowserContext; request: APIRequestContext; email: string };

// Every test here opens its own contexts. Left open, they pile up across the
// run and a later spec's editor hangs on its loading overlay in CI.
test.afterEach(async ({ browser }) => {
  await Promise.all(browser.contexts().map((c) => c.close()));
});

async function person(browser: Browser, tag: string): Promise<Person> {
  const context = await browser.newContext({ extraHTTPHeaders: ip() });
  const email = uniqueEmail(tag);
  const res = await context.request.post("/api/auth/signup", { data: { email, password: PASSWORD } });
  expect(res.status()).toBe(201);
  return { context, request: context.request, email };
}

async function publish(who: Person, body: Record<string, unknown>): Promise<string> {
  const res = await who.request.post("/api/publish", { data: body });
  expect(res.status(), await res.text()).toBe(200);
  return ((await res.json()) as { id: string }).id;
}

async function createSpace(owner: Person, name: string) {
  const res = await owner.request.post("/api/teams", { data: { name } });
  expect(res.status()).toBe(201);
  return (await res.json()) as { id: string; slug: string };
}

/** The owner invites `member` by email and the member opens the link. */
async function join(owner: Person, member: Person, spaceId: string) {
  const res = await owner.request.post(`/api/teams/${spaceId}/invite`, { data: { email: member.email } });
  expect(res.status()).toBe(201);
  const { inviteUrl } = (await res.json()) as { inviteUrl: string };
  const page = await member.context.newPage();
  await page.goto(new URL(inviteUrl).pathname + new URL(inviteUrl).search);
  await expect(page).toHaveURL(/\/t\/[a-z0-9-]+$/);
  await page.close();
}

test("the ADR template publishes with its status and date in the header strip", async ({ browser }) => {
  const author = await person(browser, "adr");
  const page = await author.context.newPage();
  await page.goto("/app?template=adr");
  // The template opens with frontmatter; the editor shows it for editing.
  await expect(page.locator("textarea").first()).toHaveValue(/^---\ntype: adr\nstatus: Proposed\ndate: \d{4}-\d\d-\d\d/);

  await page.getByRole("button", { name: "Publish" }).click();
  const link = page.getByRole("button", { name: "Open published page" });
  await expect(link).toBeVisible();
  const pages = (await (await author.request.get("/api/auth/me")).json()) as { userId: string };
  expect(pages.userId).toBeTruthy();

  const [shared] = await Promise.all([author.context.waitForEvent("page"), link.click()]);
  await shared.waitForLoadState();
  const strip = shared.locator("[data-doc-header]");
  await expect(strip.locator('[data-doc-type="adr"]')).toHaveText("ADR");
  await expect(strip.locator('[data-status="Proposed"]')).toBeVisible();
  await expect(strip.locator("time")).toHaveText(/^\d{1,2} \w+ \d{4}$/);
  // The frontmatter is the strip, not page content.
  await expect(shared.locator("main")).not.toContainText("status: Proposed");
});

test("a member sees a team-only page and a non-member gets a 404 on the same URL", async ({ browser }) => {
  const owner = await person(browser, "owner");
  const member = await person(browser, "member");
  const outsider = await person(browser, "outsider");
  const space = await createSpace(owner, `Platform ${Date.now()}`);
  await join(owner, member, space.id);

  const id = await publish(owner, { raw: "# Database failover notes\n\nInternal only.", visibility: "team", space_id: space.id });
  const url = `/p/${id}`;

  const asMember = await member.context.newPage();
  const ok = await asMember.goto(url);
  expect(ok?.status()).toBe(200);
  await expect(asMember.getByRole("heading", { name: "Database failover notes" })).toBeVisible();
  await expect(asMember.locator("[data-doc-header]")).toContainText("Team only");
  expect(await asMember.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");

  for (const context of [outsider.context, await browser.newContext({ extraHTTPHeaders: ip() })]) {
    const page = await context.newPage();
    const res = await page.goto(url);
    expect(res?.status()).toBe(404);
    await expect(page.locator("body")).not.toContainText("Database failover notes");
    await expect(page).not.toHaveTitle(/Database failover/);
    // Nor as Markdown, nor as an embed.
    expect((await context.request.get(`${url}.md`)).status()).toBe(404);
    await page.goto(`${url}/embed`);
    await expect(page.locator("body")).not.toContainText("Database failover notes");
  }
  // Markdown is refused for members too: it is for pages anyone with the link may read.
  expect((await member.request.get(`${url}.md`)).status()).toBe(404);

  // The API refuses `team` on a page that is in no team space.
  const personal = await publish(outsider, { raw: "# Personal page" });
  const refused = await outsider.request.patch(`/api/pages/${personal}`, { data: { visibility: "team" } });
  expect(refused.status()).toBe(422);
});

test("an incident links to the ADR it names, and the ADR lists it only for those who may see it", async ({ browser }) => {
  const owner = await person(browser, "links-owner");
  const member = await person(browser, "links-member");
  const outsider = await person(browser, "links-outsider");
  const space = await createSpace(owner, `Payments ${Date.now()}`);
  await join(owner, member, space.id);

  const adr = await publish(owner, {
    raw: "---\ntype: adr\nstatus: Accepted\n---\n# ADR-012 Queue retries\n\nRetry three times.",
    visibility: "public",
    space_id: space.id,
  });
  const incident = await publish(member, {
    raw: "---\ntype: incident\nseverity: P1\n---\n# Queue backlog\n\nWe followed [[ADR-012 Queue retries]] and [[A page that does not exist]].",
    visibility: "team",
    space_id: space.id,
  });

  const asMember = await member.context.newPage();
  await asMember.goto(`/p/${incident}`);
  const link = asMember.getByRole("link", { name: "ADR-012 Queue retries" });
  await expect(link).toHaveAttribute("href", new RegExp(`/p/${adr}$`));
  await expect(asMember.locator("main")).toContainText("A page that does not exist");
  await expect(asMember.locator("main")).not.toContainText("[[");

  await asMember.goto(`/p/${adr}`);
  const referencedBy = asMember.getByRole("navigation", { name: "Referenced by" });
  await expect(referencedBy.getByRole("link", { name: "Queue backlog" })).toBeVisible();

  // The ADR is public; the incident that references it is not.
  const asOutsider = await outsider.context.newPage();
  const res = await asOutsider.goto(`/p/${adr}`);
  expect(res?.status()).toBe(200);
  await expect(asOutsider.getByRole("heading", { name: "ADR-012 Queue retries" })).toBeVisible();
  await expect(asOutsider.locator("body")).not.toContainText("Queue backlog");
  await expect(asOutsider.getByText("Referenced by")).toHaveCount(0);
});

test("a team space home groups pages by type, and serves a feed only when it has public pages", async ({ browser }) => {
  const owner = await person(browser, "home");
  const space = await createSpace(owner, `Infra ${Date.now()}`);
  const inSpace = (raw: string, visibility = "team") => publish(owner, { raw, visibility, space_id: space.id });

  await inSpace("---\ntype: adr\nstatus: Accepted\n---\n# ADR-012 Queue retries");
  await inSpace("---\ntype: adr\nstatus: Proposed\n---\n# ADR-003 Polling");
  await inSpace("---\ntype: incident\nstatus: Resolved\ndate: 2026-09-30\n---\n# Checkout outage");
  await inSpace("# Team lunch");

  const page = await owner.context.newPage();
  await page.goto(`/t/${space.slug}`);
  await expect(page.locator("section[data-group]")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: /^Incidents/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Decision log/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Other pages/ })).toBeVisible();
  // The decision log is in ADR-number order, with status chips.
  const adrs = page.locator('section[data-group="adr"] li');
  await expect(adrs).toHaveText([/ADR-003 Polling.*Proposed/, /ADR-012 Queue retries.*Accepted/]);
  await expect(page.locator('section[data-group="incident"] li')).toContainText("30 September 2026");

  // Nothing public yet: no feed, and a visitor sees no pages.
  expect((await owner.request.get(`/t/${space.slug}/feed.xml`)).status()).toBe(404);
  const visitor = await (await browser.newContext({ extraHTTPHeaders: ip() })).newPage();
  await visitor.goto(`/t/${space.slug}`);
  await expect(visitor.locator("section[data-group]")).toHaveCount(0);
  await expect(visitor.locator("body")).not.toContainText("ADR-012");

  await inSpace("---\ntype: runbook\n---\n# Restart the queue", "public");
  const feed = await owner.request.get(`/t/${space.slug}/feed.xml`);
  expect(feed.status()).toBe(200);
  expect(feed.headers()["content-type"]).toContain("application/atom+xml");
  const xml = await feed.text();
  expect(xml).toContain("<title>Restart the queue</title>");
  expect(xml).not.toContain("ADR-012");
  await visitor.reload();
  await expect(visitor.locator("section[data-group]")).toHaveCount(1);
  await expect(visitor.locator('link[type="application/atom+xml"]')).toHaveAttribute("href", new RegExp(`/t/${space.slug}/feed.xml$`));
});

test("Spaces is in the account menu, and a space can be created from it", async ({ browser }) => {
  const owner = await person(browser, "nav");
  const page = await owner.context.newPage();
  await page.goto("/my-pages");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("link", { name: "Spaces" }).click();
  await expect(page).toHaveURL(/\/t$/);

  const name = `Docs ${Date.now()}`;
  await page.getByLabel("Space name").fill(name);
  await page.getByRole("button", { name: "Create space" }).click();
  await expect(page).toHaveURL(/\/t\/docs-\d+$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

  // The editor now offers the space when publishing.
  await page.goto("/app");
  await page.getByLabel("Who can find this page").click();
  await expect(page.getByRole("menuitemradio", { name: `Team only (${name})` })).toBeVisible();
});

test("after a first publish, someone with no space is offered one", async ({ browser }) => {
  const author = await person(browser, "first");
  const page = await author.context.newPage();
  // A template gives the editor content without typing into it before it
  // has hydrated.
  await page.goto("/app?template=runbook");
  await expect(page.locator("textarea").first()).toHaveValue(/type: runbook/);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("link", { name: "Create a space" })).toHaveAttribute("href", "/t");
});
