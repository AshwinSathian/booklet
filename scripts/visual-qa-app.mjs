// Screenshot sweep of the signed-in app: every page behind the editor and
// the editor's own menus, in both themes at 390, 768 and 1440.
//
//   node scripts/visual-qa-app.mjs <base-url> [output-dir]
//
// It makes an account, pages, a collection, a team space, a webhook, an API
// key and an abuse report, so it runs against a local instance only: any
// other host is refused, and so is port 3100, where production listens. scripts/visual-qa.mjs covers the public site and is
// the one to point at production (with QA_PUBLIC_ONLY=1).
//
// The admin pages, and the notice on a page that was taken down, need an
// admin: start the instance with ADMIN_IPS=127.0.0.1, run this once, add the
// user id it prints to ADMIN_USER_IDS, restart and run it again. Without
// that it says ADMIN UNAVAILABLE and exits 1.
//
// Exits 1 if any page is wider than its viewport or throws in the browser,
// or if seeding, a navigation or one of the interactive states failed.
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const BASE = process.argv[2];
const OUT = process.argv[3] ?? "qa-screenshots/app";
// Port 3100 is where a production instance listens (ecosystem.config.js), on localhost too.
const target = BASE && URL.canParse(BASE) ? new URL(BASE) : null;
if (!target || !["localhost", "127.0.0.1"].includes(target.hostname) || target.port === "3100") {
  console.error("Usage: node scripts/visual-qa-app.mjs http://localhost:<port> [output-dir]");
  console.error("This sweep creates data, so it only runs against localhost, and never against port 3100.");
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
const GATE_PASSWORD = "sweep-gate-password";
// src/lib/themes.ts
const DOC_THEMES = ["default", "verdant", "ember", "contrast", "noir"];
// An admin request has to come from an address in ADMIN_IPS.
const ADMIN_HEADERS = { "cf-connecting-ip": "127.0.0.1" };

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
// Publishing is limited to 12 a minute per address, and the seed publishes more than that.
const seedIp = () => ({ "cf-connecting-ip": `2001:db8:5eed::${Math.floor(Math.random() * 0xffff).toString(16)}` });
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
    const p = await j(await api.post("/api/publish", { headers: seedIp(), data: { raw: DOC.replace(/^# .*/, `# ${t}`) } }), "publish");
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
  // A custom URL that is in use, for the "taken" state of the custom URL bar.
  seed.slugTaken = `sweep-taken-${ts}`;
  await j(await api.patch(`/api/pages/${seed.pages[3]}`, { data: { slug: seed.slugTaken } }), "slug");
  if (team.id) await j(await api.post(`/api/teams/${team.id}/invite`, { data: { email: "invitee@example.test" } }), "invite");
  await j(await api.post("/api/webhooks", { data: { url: "https://example.com/hooks/booklet", events: ["page.published"] } }), "webhook");
  await j(await api.post("/api/v1/keys", { data: { label: "CI publisher" } }), "key");
  await j(await api.post("/api/reports", { data: { page_id: seed.pages[1], reason: "spam", detail: "Sweep seed report." } }), "report");
  // One public page, in the collection, so /c and /u have something to list.
  await j(await api.patch(`/api/pages/${seed.pages[2]}`, { data: { visibility: "public" } }), "make public");
  // One page in each document theme, tagged, so /tags/[tag] has a page too.
  seed.themed = {};
  for (const theme of DOC_THEMES) {
    const p = await j(await api.post("/api/publish", { headers: seedIp(), data: { raw: `---\ntags: [sweep]\n---\n\n${DOC.replace(/^# .*/, `# The ${theme} theme`)}`, settings: { theme }, visibility: "public" } }), `publish ${theme}`);
    seed.themed[theme] = p.id;
  }
  // A page behind a password.
  seed.locked = (await j(await api.post("/api/publish", { headers: seedIp(), data: { raw: DOC.replace(/^# .*/, "# Behind a password") } }), "publish locked")).id;
  await j(await api.patch(`/api/pages/${seed.locked}`, { data: { password: GATE_PASSWORD } }), "set password");
  // Pages in the team space: one anyone can read, one for members only.
  if (team.id) {
    await j(await api.post("/api/publish", { headers: seedIp(), data: { raw: DOC.replace(/^# .*/, "# ADR 0012: One queue per tenant"), space_id: team.id, visibility: "public" } }), "space page");
    await j(await api.post("/api/publish", { headers: seedIp(), data: { raw: DOC.replace(/^# .*/, "# Runbook: failover the ledger"), space_id: team.id, visibility: "team" } }), "team-only page");
  }
  // A second report: its page is the one taken down below.
  seed.gonePage = (await j(await api.post("/api/publish", { headers: seedIp(), data: { raw: DOC.replace(/^# .*/, "# A page that gets taken down") } }), "publish gone")).id;
  await j(await api.post("/api/reports", { data: { page_id: seed.gonePage, reason: "spam", detail: "Sweep seed: take this one down." } }), "report 2");
  writeFileSync(SEED_FILE, JSON.stringify(seed));
}
const { pages, colId } = seed;
const first = pages[0];
const me = { userId: seed.userId };
const team = { slug: seed.teamSlug };
const SLUG_TAKEN = seed.slugTaken;
const state = await seedCtx.storageState();
await seedCtx.close();
note(`seed: user=${me.userId} pages=${pages.length} col=${colId} team=${team.slug}`);

// Take one reported page down, once, through the admin page.
if (!seed.goneDone) {
  const ctx = await browser.newContext({ baseURL: BASE, storageState: state, extraHTTPHeaders: ADMIN_HEADERS });
  const page = await ctx.newPage();
  const res = await page.goto("/admin/reports", { waitUntil: "networkidle" });
  if (res?.status() === 200) {
    await page.locator("li, tr, article, div").filter({ hasText: "take this one down" }).last().getByRole("button", { name: "Take down" }).click();
    await page.waitForLoadState("networkidle");
    seed.goneDone = true;
    writeFileSync(SEED_FILE, JSON.stringify(seed));
  } else {
    note(`ADMIN UNAVAILABLE (${res?.status()}): add ${me.userId} to ADMIN_USER_IDS, restart the instance and run this again.`);
  }
  await ctx.close();
}

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
  ["t-admin-missing", "/t/no-such-space/admin"],
  ["c", `/c/${colId}`],
  ["u", `/u/${me.userId}`],
  ["oauth-authorize", "/oauth/authorize"],
  ["cli-auth", "/cli-auth?port=53123&state=0123456789abcdef0123456789abcdef01234567"],
  ["cli-auth-invalid", "/cli-auth"],
  ["report", `/report?page=${pages[1]}`],
  ["verify-email", "/verify-email"],
];
const ADMIN_ROUTES = [
  ["admin", "/admin"],
  ["admin-reports", "/admin/reports"],
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
  ["p-not-found", "/p/no-such-page-here"],
  ["p-gone", `/p/${seed.gonePage}`],
  ["p-password-gate", `/p/${seed.locked}`],
  ["p-embed", `/p/${seed.themed.default}/embed`],
  ["tag", "/tags/sweep"],
  ...DOC_THEMES.map((theme) => [`p-theme-${theme}`, `/p/${seed.themed[theme]}`]),
];
// Answered with a status that says what they are.
const EXPECTED_STATUS = { "not-found": 404, "p-not-found": 404, "p-gone": 410 };

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
      if (res && res.status() !== (EXPECTED_STATUS[name] ?? 200)) note(`STATUS ${res.status()} ${route}`);
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
  await step("shortcuts", async () => { await page.locator('button[title="Keyboard shortcuts"]').click({ timeout: 3000 }); await page.getByText("Keyboard shortcuts", { exact: true }).waitFor({ timeout: 3000 }); });
  await esc();
  await step("drafts-dialog", async () => { await editor.focus(); await page.keyboard.press("ControlOrMeta+d"); await page.getByRole("dialog", { name: "My drafts" }).waitFor({ timeout: 3000 }); await page.waitForTimeout(300); });
  await esc();
  await step("import-url", async () => { await page.getByRole("button", { name: "More options" }).click({ timeout: 3000 }); await page.getByRole("button", { name: /Import from URL/ }).click({ timeout: 3000 }); await page.getByText("Import from URL").last().waitFor({ timeout: 3000 }); await page.waitForTimeout(400); });
  await esc();
  await step("find-bar-case-on", async () => { await page.locator("button[title^='Find & replace']").scrollIntoViewIfNeeded(); await page.locator("button[title^='Find & replace']").click({ timeout: 3000 }); await page.getByPlaceholder(/find/i).first().fill("pool"); await page.getByRole("button", { name: "Case sensitive" }).click({ timeout: 3000 }); await page.mouse.move(1, 1); await page.waitForTimeout(300); });
  await esc();
  // The preview pane's two panels. Below lg the pane is behind its tab.
  const previewTab = page.getByRole("tab", { name: "Preview" });
  if (await previewTab.isVisible()) await previewTab.click();
  await step("backlinks", async () => { await page.locator("button[title^='Drafts that link']").click({ timeout: 3000 }); await page.getByRole("dialog", { name: "Referenced by" }).waitFor({ timeout: 3000 }); await page.waitForTimeout(300); });
  await esc();
  await step("graph", async () => { await page.locator("button[title^='Graph']").click({ timeout: 3000 }); await page.getByRole("dialog", { name: "Draft graph" }).waitFor({ timeout: 3000 }); await page.waitForTimeout(600); });
  await esc();
  if (await previewTab.isVisible()) await page.getByRole("tab", { name: "Write" }).click();
  await step("focus-mode", async () => { await editor.focus(); await page.keyboard.press("ControlOrMeta+."); await page.waitForTimeout(500); });
  await page.keyboard.press("ControlOrMeta+.");
  await page.waitForTimeout(300);
  // Publishing shows a toast and the custom URL bar.
  await step("published", async () => { await page.getByRole("button", { name: "Publish" }).click({ timeout: 3000 }); await page.locator("[data-slug-bar]").waitFor({ timeout: 15000 }); await page.waitForTimeout(600); });
  await step("slug-taken", async () => { await page.getByLabel("Custom URL slug").fill(SLUG_TAKEN); await page.getByText("Taken").waitFor({ timeout: 5000 }); });
  await step("slug-invalid", async () => { await page.getByLabel("Custom URL slug").fill("Not A Slug!"); await page.getByLabel("Custom URL slug").press("Enter"); await page.waitForTimeout(400); });
  // Saving fails: browser storage is full from here until the next navigation.
  await step("save-warning", async () => {
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException("full", "QuotaExceededError"); }; });
    const writeTab = page.getByRole("tab", { name: "Write" });
    if (await writeTab.isVisible()) await writeTab.click();
    await editor.focus();
    await page.keyboard.type(" more");
    await page.locator("[data-save-warning]").waitFor({ timeout: 10000 });
  });
  // My pages, versions, settings.
  await page.goto(`/my-pages/versions/${first}`, { waitUntil: "networkidle" });
  await step("versions-compare", async () => { await page.getByRole("button", { name: "Compare" }).first().click({ timeout: 3000 }); await page.waitForTimeout(600); });
  await page.goto("/settings/api-keys", { waitUntil: "networkidle" });
  await step("api-key-created", async () => { await page.getByRole("textbox").first().fill(`sweep ${tag}`); await page.getByRole("button", { name: /create/i }).first().click({ timeout: 3000 }); await page.waitForTimeout(800); });
  await page.goto("/settings/account", { waitUntil: "networkidle" });
  await step("delete-account-confirm", async () => { await page.getByRole("button", { name: "Delete account" }).click({ timeout: 3000 }); await page.waitForTimeout(400); });
  await page.goto("/my-pages", { waitUntil: "networkidle" });
  await step("my-pages-more", async () => { await page.getByLabel("More actions").first().click({ timeout: 3000 }); await page.waitForTimeout(300); });
  await esc();
  await step("my-pages-search-none", async () => { await page.getByLabel("Search pages").fill("zzzz-no-match"); await page.waitForTimeout(400); });
}

// A visitor's states on published pages and in the editor.
async function readerStates(page, tag) {
  const step = async (name, fn) => { try { await fn(); await shoot(page, `${tag}-state-${name}`, false); } catch (e) { note(`STATE FAIL ${tag} ${name}: ${e.message.split("\n")[0]}`); } };
  await page.goto(`/p/${seed.locked}`, { waitUntil: "networkidle" });
  await step("password-wrong", async () => { await page.locator('input[type="password"]').fill("not the password"); await page.locator('input[type="password"]').press("Enter"); await page.waitForTimeout(1500); });
  // The compact header takes over once a published page has scrolled.
  await page.goto(`/p/${seed.themed.default}`, { waitUntil: "networkidle" });
  await step("p-compact-header", async () => { await page.mouse.wheel(0, 500); await page.waitForTimeout(500); });
  // A visitor publishes from the editor and is asked to sign in to keep the page.
  await page.goto("/app", { waitUntil: "networkidle" });
  await step("anon-published", async () => {
    const writeTab = page.getByRole("tab", { name: "Write" });
    if (await writeTab.isVisible()) await writeTab.click();
    await page.locator("textarea").first().fill(DOC);
    await page.getByRole("button", { name: "Publish" }).click({ timeout: 3000 });
    await page.getByRole("button", { name: /Copy link/ }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(800);
  });
}

// QA_ONLY=light-390 runs one theme at one width, for working on the script.
const only = process.env.QA_ONLY;
for (const theme of THEMES) {
  for (const vp of VIEWPORTS) {
    if (only && only !== `${theme}-${vp.name}`) continue;
    const a = await sweep({ storageState: state }, ROUTES, theme, vp);
    await states(a.page, `${theme}-${vp.name}`);
    await a.ctx.close();
    if (seed.goneDone) {
      const admin = await sweep({ storageState: state, extraHTTPHeaders: ADMIN_HEADERS }, ADMIN_ROUTES, theme, vp);
      await admin.ctx.close();
    }
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
    await readerStates(c.page, `${theme}-${vp.name}`);
    await c.ctx.close();
    note(`done ${theme} ${vp.name}`);
  }
}
await browser.close();
writeFileSync(`${OUT}/_log.txt`, log.join("\n"));
const faults = log.filter((line) => /^(OVERFLOW|PAGEERROR|SEED FAIL|NAV FAIL|STATE FAIL|STATUS|ADMIN UNAVAILABLE)/.test(line));
if (faults.length) {
  console.error(`${faults.length} fault(s): see the lines above (page wider than its viewport, error in the browser, unexpected status, or seeding, navigation or a state failed).`);
  process.exit(1);
}
console.log(`Screenshots written to ${OUT}/`);
