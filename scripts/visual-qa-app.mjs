// Screenshot sweep of the signed-in app: every page behind the editor and
// the editor's own menus, in both themes at 390, 768 and 1440.
//
//   node scripts/visual-qa-app.mjs <base-url> [output-dir]
//
// It makes an account, pages, a collection, a team space, a webhook, an API
// key and an abuse report, so it runs against a local instance only: any
// other host is refused. scripts/visual-qa.mjs covers the public site and is
// the one to point at production (with QA_PUBLIC_ONLY=1).
//
// Exits 1 if any page is wider than its viewport or throws in the browser.
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const BASE = process.argv[2];
const OUT = process.argv[3] ?? "qa-screenshots/app";
if (!BASE || !["localhost", "127.0.0.1"].includes(new URL(BASE).hostname)) {
  console.error("Usage: node scripts/visual-qa-app.mjs http://localhost:<port> [output-dir]");
  console.error("This sweep creates data, so it only runs against localhost.");
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
];
const THEMES = ["light", "dark"];
const PASSWORD = "correct horse battery staple";

const DOC = `# Checkout latency incident, 4 October

**Severity:** SEV-2 · **Duration:** 47 minutes · **Owner:** Payments

## Summary

Checkout p95 latency rose from 320 ms to 4.1 s after a connection pool change. See the [runbook](https://example.com/runbook).

> [!WARNING]
> The pool size was halved by a config default.

## Timeline

| Time (UTC) | Event |
| --- | --- |
| 09:12 | Deploy 4821 goes out |
| 09:19 | Alert fires on p95 |
| 09:59 | Rollback complete |

## Root cause

\`\`\`yaml
pool:
  max: 10 # was 20
\`\`\`

- [x] Roll back
- [ ] Add a pool saturation alert

Inline \`code\`, **bold** and a footnote[^1].

[^1]: Measured at the load balancer.
`;

const log = [];
const note = (m) => { log.push(m); console.log(m); };

const browser = await chromium.launch();

// ---- seed -----------------------------------------------------------
// The first run makes an account and its data and writes their ids to
// seed.json in the output directory; later runs sign in and reuse them.
const SEED_FILE = `${OUT}/seed.json`;
const seedCtx = await browser.newContext({ baseURL: BASE });
const api = seedCtx.request;
const j = async (res, what) => {
  if (!res.ok()) { note(`SEED FAIL ${what}: ${res.status()} ${(await res.text()).slice(0, 200)}`); return {}; }
  return res.json().catch(() => ({}));
};
let seed;
if (existsSync(SEED_FILE)) {
  seed = JSON.parse(readFileSync(SEED_FILE, "utf8"));
  await j(await api.post("/api/auth/login", { data: { email: seed.email, password: PASSWORD } }), "login");
} else {
  const ts = Date.now();
  seed = { email: `sweep-${ts}@example.test`, pages: [] };
  await j(await api.post("/api/auth/signup", { data: { email: seed.email, password: PASSWORD } }), "signup");
  seed.userId = (await j(await api.get("/api/auth/me"), "me")).userId;
  const titles = ["Checkout latency incident, 4 October", "ADR 0007: Use Postgres for the ledger", "RFC: Rate limits per API key", "Runbook: rotate the signing key", "A page with a very long title that has to wrap or truncate somewhere in the card layout"];
  for (const t of titles) {
    const p = await j(await api.post("/api/publish", { data: { raw: DOC.replace(/^# .*/, `# ${t}`) } }), "publish");
    if (p.id) seed.pages.push(p.id);
  }
  const first = seed.pages[0];
  for (let i = 2; i <= 4; i++) await j(await api.patch(`/api/publish/${first}`, { data: { raw: DOC + `\n\nRevision ${i}. Added a line.\n` } }), "update");
  await api.post("/api/analytics/view", { data: { pageId: first, event: "view", referrer: "" } });
  const col = await j(await api.post("/api/collections", { data: { name: "Incidents" } }), "collection");
  seed.colId = col.id ?? col.collection?.id;
  await j(await api.post("/api/collections", { data: { name: "2026", parent_id: seed.colId } }), "subcollection");
  for (const id of seed.pages.slice(0, 3)) await j(await api.post(`/api/collections/${seed.colId}/pages`, { data: { pageId: id } }), "col page");
  await j(await api.post("/api/collections", { data: { name: "Empty folder" } }), "collection2");
  const team = await j(await api.post("/api/teams", { data: { name: "Payments Team", slug: `payments-${ts}` } }), "team");
  seed.teamSlug = team.slug;
  if (team.id) await j(await api.post(`/api/teams/${team.id}/invite`, { data: { email: "invitee@example.test" } }), "invite");
  await j(await api.post("/api/webhooks", { data: { url: "https://example.com/hooks/booklet", events: ["page.published"] } }), "webhook");
  await j(await api.post("/api/v1/keys", { data: { label: "CI publisher" } }), "key");
  await j(await api.post("/api/reports", { data: { page_id: seed.pages[1], reason: "spam", detail: "Sweep seed report." } }), "report");
  // One public page, in the collection, so /c and /u have something to list.
  await j(await api.patch(`/api/pages/${seed.pages[2]}`, { data: { visibility: "public" } }), "make public");
  writeFileSync(SEED_FILE, JSON.stringify(seed));
}
const { pages, colId } = seed;
const first = pages[0];
const me = { userId: seed.userId };
const team = { slug: seed.teamSlug };
const state = await seedCtx.storageState();
await seedCtx.close();
note(`seed: user=${me.userId} pages=${pages.length} col=${colId} team=${team.slug}`);

// Second account with nothing, for empty states.
const emptyCtx = await browser.newContext({ baseURL: BASE });
let r = await emptyCtx.request.post("/api/auth/signup", { data: { email: "empty@example.test", password: PASSWORD } });
if (r.status() === 409) await emptyCtx.request.post("/api/auth/login", { data: { email: "empty@example.test", password: PASSWORD } });
const emptyState = await emptyCtx.storageState();
await emptyCtx.close();

const ROUTES = [
  ["app", "/app"],
  ["my-pages", "/my-pages"],
  ["analytics", `/my-pages/analytics/${first}`],
  ["versions", `/my-pages/versions/${first}`],
  ["settings-account", "/settings/account"],
  ["settings-api-keys", "/settings/api-keys"],
  ["settings-webhooks", "/settings/webhooks"],
  ["t", "/t"],
  ["t-space", `/t/${team.slug}`],
  ["t-admin", `/t/${team.slug}/admin`],
  ["t-join", "/t/join"],
  ["c", `/c/${colId}`],
  ["u", `/u/${me.userId}`],
  ["admin", "/admin"],
  ["admin-reports", "/admin/reports"],
  ["cli-auth", "/cli-auth?code=ABCD-EFGH"],
  ["report", `/report?page=${pages[1]}`],
  ["verify-email", "/verify-email"],
];
const EMPTY_ROUTES = [
  ["empty-my-pages", "/my-pages"],
  ["empty-t", "/t"],
  ["empty-settings-api-keys", "/settings/api-keys"],
  ["empty-settings-webhooks", "/settings/webhooks"],
  ["empty-settings-account", "/settings/account"],
];
const ANON_ROUTES = [
  ["anon-t-space", `/t/${team.slug}`],
  ["anon-c", `/c/${colId}`],
  ["anon-app", "/app"],
  ["sign-in", "/sign-in"],
  ["sign-up", "/sign-up"],
  ["forgot-password", "/forgot-password"],
  ["reset-password", "/reset-password?token=abc"],
  ["anon-my-pages", "/my-pages"],
  ["not-found", "/this-does-not-exist"],
];

async function shoot(page, name, full = true) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }).catch((e) => note(`SHOT FAIL ${name}: ${e.message.split("\n")[0]}`));
}
async function sweep(ctxOpts, routes, theme, vp) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: vp, colorScheme: theme, reducedMotion: "reduce", ...ctxOpts });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => note(`PAGEERROR ${theme}-${vp.name} ${page.url()}: ${e.message.split("\n")[0]}`));
  for (const [name, route] of routes) {
    try {
      const res = await page.goto(route, { waitUntil: "networkidle", timeout: 60000 });
      if (res && res.status() >= 400 && name !== "not-found") note(`STATUS ${res.status()} ${route}`);
      await shoot(page, `${theme}-${vp.name}-${name}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 1) note(`OVERFLOW ${overflow}px ${theme}-${vp.name}-${name}`);
    } catch (e) { note(`NAV FAIL ${name}: ${e.message.split("\n")[0]}`); }
  }
  return { ctx, page };
}

// Interactive editor and My pages states. Each step is best effort.
async function states(page, tag) {
  const step = async (name, fn) => { try { await fn(); await shoot(page, `${tag}-state-${name}`, false); } catch (e) { note(`STATE FAIL ${tag} ${name}: ${e.message.split("\n")[0]}`); } };
  const esc = async () => { await page.keyboard.press("Escape"); await page.waitForTimeout(150); };
  await page.goto("/app", { waitUntil: "networkidle" });
  const editor = page.locator("textarea").first();
  await step("editor-filled", async () => { await editor.click(); await editor.fill(DOC); await page.waitForTimeout(600); });
  await step("slash-menu", async () => { await editor.press("End"); await page.keyboard.press("Enter"); await page.keyboard.type("/"); await page.waitForTimeout(300); });
  await esc();
  await step("command-palette", async () => { await page.keyboard.press("Control+k"); await page.waitForTimeout(300); });
  await esc();
  await step("settings-sheet", async () => { await page.getByRole("button", { name: /settings/i }).first().click({ timeout: 3000 }); await page.waitForTimeout(400); });
  await esc();
  await step("visibility-menu", async () => { await page.getByLabel(/Who can find this page/).click({ timeout: 3000 }); await page.waitForTimeout(300); });
  await esc();
  await step("account-menu", async () => { await page.getByRole("button", { name: /account/i }).first().click({ timeout: 3000 }); await page.waitForTimeout(300); });
  await esc();
  await step("more-options", async () => { await page.getByRole("button", { name: "More options" }).click({ timeout: 3000 }); await page.waitForTimeout(500); });
  await esc();
  await step("shortcuts", async () => { await page.keyboard.press("Control+/"); await page.waitForTimeout(300); });
  await esc();
  await step("published", async () => { await page.getByRole("button", { name: "Publish" }).click({ timeout: 3000 }); await page.waitForTimeout(2500); });
  await page.goto("/my-pages", { waitUntil: "networkidle" });
  await step("my-pages-more", async () => { await page.getByLabel("More actions").first().click({ timeout: 3000 }); await page.waitForTimeout(300); });
  await esc();
  await step("my-pages-search-none", async () => { await page.getByLabel("Search pages").fill("zzzz-no-match"); await page.waitForTimeout(400); });
}

for (const theme of THEMES) {
  for (const vp of VIEWPORTS) {
    const a = await sweep({ storageState: state }, ROUTES, theme, vp);
    await states(a.page, `${theme}-${vp.name}`);
    await a.ctx.close();
    const b = await sweep({ storageState: emptyState }, EMPTY_ROUTES, theme, vp);
    await b.ctx.close();
    const c = await sweep({}, ANON_ROUTES, theme, vp);
    // Anonymous editor: empty state, then a failed sign-in for the error style.
    try {
      await c.page.goto("/sign-in", { waitUntil: "networkidle" });
      await c.page.fill("#email", "nobody@example.test");
      await c.page.fill("#password", "wrong password here");
      await c.page.click('button[type="submit"]');
      await c.page.waitForTimeout(1200);
      await shoot(c.page, `${theme}-${vp.name}-state-sign-in-error`);
    } catch (e) { note(`STATE FAIL sign-in-error: ${e.message.split("\n")[0]}`); }
    await c.ctx.close();
    note(`done ${theme} ${vp.name}`);
  }
}
await browser.close();
writeFileSync(`${OUT}/_log.txt`, log.join("\n"));
const faults = log.filter((line) => /^(OVERFLOW|PAGEERROR)/.test(line));
if (faults.length) {
  console.error(`${faults.length} fault(s): pages wider than the viewport, or errors in the browser.`);
  process.exit(1);
}
console.log(`Screenshots written to ${OUT}/`);
