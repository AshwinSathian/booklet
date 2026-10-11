import { test, expect, type Browser, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { appendFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createUser, getUserById } from "@/lib/db/auth";
import { hashUserPassword } from "@/lib/auth/password";

// Task 5.12: every route under src/app that renders a page passes axe with
// the WCAG 2.2 AA rule set, in the light and the dark theme. The route list
// is checked against the page.tsx files on disk, so a new page that is not
// added here fails the first test.

const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
// The admin account is shared with moderation-expiry.spec.ts, whichever runs
// first creates it, so the password has to be the same in both.
const PASSWORD = "correct horse battery staple";
// tests/e2e/moderation-expiry.spec.ts explains this id and address (ADMIN_USER_IDS, ADMIN_IPS).
const ADMIN_ID = "e2e-admin";
const ADMIN_EMAIL = "e2e-admin@example.test";

const ip = () => ({
  "cf-connecting-ip": `2001:db8:a11::${Math.random().toString(16).slice(2, 6)}:${Math.random().toString(16).slice(2, 6)}`,
});

type Who = "anon" | "owner" | "admin";
type Fixtures = { pageId: string; userId: string; collectionId: string; spaceSlug: string };

/** Route pattern (as the directory is named) → who opens it, and the URL to open. */
const ROUTES: Record<string, { as: Who; url: (f: Fixtures) => string }> = {
  "/": { as: "anon", url: () => "/" },
  "/about": { as: "anon", url: () => "/about" },
  "/admin": { as: "admin", url: () => "/admin" },
  "/admin/reports": { as: "admin", url: () => "/admin/reports" },
  "/app": { as: "anon", url: () => "/app" },
  "/c/[id]": { as: "anon", url: (f) => `/c/${f.collectionId}` },
  "/changelog": { as: "anon", url: () => "/changelog" },
  // A state of the CLI's shape: anything else renders "Invalid request", not the page.
  "/cli-auth": { as: "owner", url: () => "/cli-auth?port=53123&state=0123456789abcdef0123456789abcdef01234567" },
  "/docs": { as: "anon", url: () => "/docs" },
  // The MCP guide: the one docs page with an embedded component.
  "/docs/[...slug]": { as: "anon", url: () => "/docs/guides/mcp" },
  "/explore": { as: "anon", url: () => "/explore" },
  "/forgot-password": { as: "anon", url: () => "/forgot-password" },
  "/my-pages": { as: "owner", url: () => "/my-pages" },
  "/my-pages/analytics/[id]": { as: "owner", url: (f) => `/my-pages/analytics/${f.pageId}` },
  "/my-pages/versions/[id]": { as: "owner", url: (f) => `/my-pages/versions/${f.pageId}` },
  "/oauth/authorize": { as: "owner", url: () => "/oauth/authorize" },
  "/p/[id]": { as: "anon", url: (f) => `/p/${f.pageId}` },
  "/p/[id]/embed": { as: "anon", url: (f) => `/p/${f.pageId}/embed` },
  "/pricing": { as: "anon", url: () => "/pricing" },
  "/privacy": { as: "anon", url: () => "/privacy" },
  "/report": { as: "anon", url: (f) => `/report?page=${f.pageId}` },
  "/reset-password": { as: "anon", url: () => "/reset-password?token=a11y" },
  "/settings/account": { as: "owner", url: () => "/settings/account" },
  "/settings/security": { as: "owner", url: () => "/settings/security" },
  "/settings/api-keys": { as: "owner", url: () => "/settings/api-keys" },
  "/settings/webhooks": { as: "owner", url: () => "/settings/webhooks" },
  "/sign-in": { as: "anon", url: () => "/sign-in" },
  "/sign-up": { as: "anon", url: () => "/sign-up" },
  "/t": { as: "owner", url: () => "/t" },
  "/t/[slug]": { as: "owner", url: (f) => `/t/${f.spaceSlug}` },
  "/t/[slug]/admin": { as: "owner", url: (f) => `/t/${f.spaceSlug}/admin` },
  "/t/join": { as: "owner", url: () => "/t/join" },
  "/tags": { as: "anon", url: () => "/tags" },
  "/tags/[tag]": { as: "anon", url: () => "/tags/a11y-check" },
  "/templates": { as: "anon", url: () => "/templates" },
  "/templates/[slug]": { as: "anon", url: () => "/templates/incident-report" },
  "/terms": { as: "anon", url: () => "/terms" },
  "/trust": { as: "anon", url: () => "/trust" },
  "/u/[id]": { as: "anon", url: (f) => `/u/${f.userId}` },
  "/verify-email": { as: "anon", url: () => "/verify-email?token=a11y" },
};

/** Every directory under src/app with a page.tsx, as a route pattern. */
function pageRoutes(dir = join(process.cwd(), "src/app"), prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return entry.name === "api" ? [] : pageRoutes(join(dir, entry.name), `${prefix}/${entry.name}`);
    return entry.name === "page.tsx" ? [prefix || "/"] : [];
  });
}

const RICH_PAGE = `---
type: adr
status: Accepted
date: 2026-10-10
tags: [a11y-check]
---

# ADR-001 Accessible by default

A paragraph with **bold**, _emphasis_, \`code\` and a [link](https://example.com).

> [!NOTE]
> A callout.

| Option | Verdict |
|---|---|
| Ship it | Yes |

- [x] A done task
- [ ] An open task

\`\`\`ts
const answer: number = 42;
\`\`\`
`;

let contexts: Record<Who, Record<"light" | "dark", BrowserContext>>;
let fixtures: Fixtures;

async function themed(browser: Browser, theme: "light" | "dark", headers: Record<string, string>, storageState?: Awaited<ReturnType<BrowserContext["storageState"]>>) {
  const context = await browser.newContext({ extraHTTPHeaders: headers, colorScheme: theme, storageState });
  // next-themes reads this before first paint.
  await context.addInitScript((t) => localStorage.setItem("theme", t), theme);
  return context;
}

test.beforeAll(async ({ browser }) => {
  // The owner: a page that is public and tagged, a folder holding it, a team space.
  const ownerHeaders = ip();
  const setup = await browser.newContext({ extraHTTPHeaders: ownerHeaders });
  const email = `e2e-a11y-${Date.now()}@example.test`;
  expect((await setup.request.post("/api/auth/signup", { data: { email, password: PASSWORD } })).status()).toBe(201);
  const { userId } = (await (await setup.request.get("/api/auth/me")).json()) as { userId: string };
  const published = await setup.request.post("/api/publish", { data: { raw: RICH_PAGE, visibility: "public" } });
  expect(published.status(), await published.text()).toBe(200);
  const pageId = ((await published.json()) as { id: string }).id;
  const folder = await setup.request.post("/api/collections", { data: { name: "A11y folder" } });
  expect(folder.status(), await folder.text()).toBeLessThan(300);
  const collectionId = ((await folder.json()) as { collection: { id: string } }).collection.id;
  expect((await setup.request.post(`/api/collections/${collectionId}/pages`, { data: { pageId } })).ok()).toBe(true);
  const space = await setup.request.post("/api/teams", { data: { name: `A11y space ${Date.now()}` } });
  expect(space.status()).toBe(201);
  const spaceSlug = ((await space.json()) as { slug: string }).slug;
  fixtures = { pageId, userId, collectionId, spaceSlug };
  const ownerState = await setup.storageState();
  await setup.close();

  if (!(await getUserById(ADMIN_ID))) await createUser(ADMIN_ID, ADMIN_EMAIL, await hashUserPassword(PASSWORD));
  const adminHeaders = { "cf-connecting-ip": "127.0.0.1" };
  const adminSetup = await browser.newContext({ extraHTTPHeaders: adminHeaders });
  expect((await adminSetup.request.post("/api/auth/login", { data: { email: ADMIN_EMAIL, password: PASSWORD } })).status()).toBe(200);
  const adminState = await adminSetup.storageState();
  await adminSetup.close();

  const both = async (headers: Record<string, string>, state?: typeof ownerState) => ({
    light: await themed(browser, "light", headers, state),
    dark: await themed(browser, "dark", headers, state),
  });
  contexts = { anon: await both(ip()), owner: await both(ownerHeaders, ownerState), admin: await both(adminHeaders, adminState) };
});

test.afterAll(async () => {
  for (const pair of Object.values(contexts ?? {})) for (const c of Object.values(pair)) await c.close();
});

test("the route list covers every page under src/app", () => {
  expect(Object.keys(ROUTES).sort()).toEqual(pageRoutes().sort());
});

// One test, so the accounts above are made once: the admin sign-in is
// limited per address, and that address has to be 127.0.0.1. Each route is a
// soft assertion, so one run reports every failing route.
test("every page route passes axe's WCAG 2.2 AA rules in the light and the dark theme", async () => {
  test.setTimeout(300_000);
  for (const [pattern, route] of Object.entries(ROUTES)) {
    for (const theme of ["light", "dark"] as const) {
      const page = await contexts[route.as][theme].newPage();
      const response = await page.goto(route.url(fixtures));
      // A page that failed to render would pass axe with nothing on it.
      expect.soft(response!.status(), `${pattern} did not render`).toBeLessThan(400);
      await expect.soft(page.locator("html")).toHaveClass(new RegExp(theme));
      await page.waitForLoadState("networkidle");

      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
      const summary = violations.map(
        (v) => `${v.id} x${v.nodes.length}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`,
      );
      // A11Y_DUMP=<file> writes every failing node with axe's own numbers, for fixing them.
      if (process.env.A11Y_DUMP && violations.length) {
        appendFileSync(process.env.A11Y_DUMP, violations.flatMap((v) => v.nodes.map((n) => JSON.stringify({ pattern, theme, rule: v.id, target: n.target.join(" "), html: n.html.slice(0, 200), data: n.any[0]?.data ?? null }))).join("\n") + "\n");
      }
      expect.soft(summary, `${pattern} (${theme})`).toEqual([]);
      await page.close();
    }
  }
});
