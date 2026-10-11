// Screenshots of the signed-in pages on a live instance, for a look after a
// deploy: both themes at 390, 768 and 1440.
//
//   MONGODB_URI=<the instance's database> node scripts/visual-qa-prod.mjs https://<host> [output-dir]
//
// It makes one account, e2e-verify-<timestamp>@example.test (the address the
// production smoke suite uses), and deletes it before it exits, through the
// app's own delete-account route. While it runs the account has two unlisted
// pages and nothing else: no public page, team space, collection, webhook or
// report. It opens no published page, so it records no view.
//
// The database is needed for two things. A live instance asks for a verified
// email before it publishes, and nobody reads mail for example.test, so the
// account's own row is marked verified (as the smoke suite does). And at the
// end it counts what is left under the account's id: anything but zero is
// printed and the script exits 1. It deletes nothing from the database itself.
//
// scripts/visual-qa-app.mjs is the full sweep, with seeded data, and is for a
// local instance. This one refuses localhost unless QA_PROD_DRY_RUN=1.
import { chromium } from "playwright";
import { MongoClient } from "mongodb";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2];
const OUT = process.argv[3] ?? "qa-screenshots/prod-app";
const target = BASE && URL.canParse(BASE) ? new URL(BASE) : null;
const local = target && ["localhost", "127.0.0.1"].includes(target.hostname);
if (!target || !process.env.MONGODB_URI || (local && !process.env.QA_PROD_DRY_RUN)) {
  console.error("Usage: MONGODB_URI=<uri> node scripts/visual-qa-prod.mjs https://<host> [output-dir]");
  console.error("For a local instance use scripts/visual-qa-app.mjs (or set QA_PROD_DRY_RUN=1 to try this one out).");
  process.exit(1);
}
const ORIGIN = target.origin;
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
];
const THEMES = ["light", "dark"];
const EMAIL = `e2e-verify-${Date.now()}@example.test`;
const PASSWORD = "prod-verify-correct-horse-battery";
const DOC = `# Checkout latency incident, 4 October

**Severity:** SEV-2 · **Duration:** 47 minutes

## Summary

Checkout p95 latency rose from 320 ms to 4.1 s after a connection pool change.

| Time (UTC) | Event |
| --- | --- |
| 09:12 | Deploy 4821 goes out |
| 09:59 | Rollback complete |

- [x] Roll back
- [ ] Add a pool saturation alert
`;

const faults = [];
const fault = (m) => { faults.push(m); console.error(`FAULT ${m}`); };

const mongo = new MongoClient(process.env.MONGODB_URI);
await mongo.connect();
// src/lib/mongodb.ts: the database is always "booklet", whatever the URI names.
const db = mongo.db("booklet");
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: ORIGIN });
const api = ctx.request;

let userId = null;
const pageIds = [];
try {
  const signup = await api.post("/api/auth/signup", { data: { email: EMAIL, password: PASSWORD } });
  if (signup.status() !== 201) throw new Error(`signup: ${signup.status()} ${(await signup.text()).slice(0, 200)}`);
  userId = (await (await api.get("/api/auth/me")).json()).userId;
  console.log(`account ${EMAIL} (${userId})`);
  const verified = await db.collection("users").updateOne({ _id: userId, email: EMAIL }, { $set: { email_verified_at: new Date().toISOString() } });
  if (verified.matchedCount !== 1) throw new Error("could not mark the account's email verified");

  for (const title of ["Checkout latency incident, 4 October", "ADR 0007: Use Postgres for the ledger"]) {
    const res = await api.post("/api/publish", { data: { raw: DOC.replace(/^# .*/, `# ${title}`), visibility: "unlisted" } });
    if (!res.ok()) throw new Error(`publish: ${res.status()} ${(await res.text()).slice(0, 200)}`);
    pageIds.push((await res.json()).id);
  }
  // A second version, so version history has something to compare.
  await api.patch(`/api/publish/${pageIds[0]}`, { data: { raw: `${DOC}\nRevision 2. Added a line.\n` } });

  const routes = [
    ["app", "/app"],
    ["my-pages", "/my-pages"],
    ["analytics", `/my-pages/analytics/${pageIds[0]}`],
    ["versions", `/my-pages/versions/${pageIds[0]}`],
    ["settings-account", "/settings/account"],
    ["settings-api-keys", "/settings/api-keys"],
    ["settings-webhooks", "/settings/webhooks"],
    ["t", "/t"],
  ];
  const state = await ctx.storageState();
  for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
      const view = await browser.newContext({ baseURL: ORIGIN, viewport: vp, colorScheme: theme, reducedMotion: "reduce", storageState: state });
      const page = await view.newPage();
      page.on("pageerror", (e) => fault(`page error ${theme}-${vp.name} ${page.url()}: ${e.message.split("\n")[0]}`));
      for (const [name, route] of routes) {
        const res = await page.goto(route, { waitUntil: "networkidle", timeout: 60000 });
        if (res?.status() !== 200) fault(`status ${res?.status()} ${route}`);
        await page.screenshot({ path: `${OUT}/${theme}-${vp.name}-${name}.png`, fullPage: true });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (overflow > 1) fault(`overflow ${overflow}px ${theme}-${vp.name}-${name}`);
      }
      // The menus of the two pages people use most.
      await page.goto("/my-pages", { waitUntil: "networkidle" });
      await page.getByLabel("More actions").first().click();
      await page.screenshot({ path: `${OUT}/${theme}-${vp.name}-state-my-pages-more.png` });
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Account menu" }).click();
      await page.screenshot({ path: `${OUT}/${theme}-${vp.name}-state-account-menu.png` });
      await view.close();
      console.log(`done ${theme} ${vp.name}`);
    }
  }
} catch (e) {
  fault(e.message.split("\n")[0]);
} finally {
  // Delete the account, whatever happened above. The route wants a same-origin POST and the password.
  if (userId) {
    const res = await api.post("/api/account/delete", { headers: { origin: ORIGIN }, data: { password: PASSWORD } });
    if (res.status() !== 200) fault(`DELETE FAILED: ${res.status()} ${(await res.text()).slice(0, 200)}. The account ${EMAIL} (${userId}) is still there.`);
    else console.log("account deleted through /api/account/delete");
  }
  await browser.close();

  // What is left under the account. Counts only.
  const pages = { $in: pageIds };
  const left = {
    users: await db.collection("users").countDocuments({ $or: [{ _id: userId }, { email: EMAIL }] }),
    sessions: await db.collection("sessions").countDocuments({ user_id: userId }),
    pages: await db.collection("pages").countDocuments({ $or: [{ user_id: userId }, { _id: pages }] }),
    docs: await db.collection("docs").countDocuments({ _id: pages }),
    page_versions: await db.collection("page_versions").countDocuments({ page_id: pages }),
    drafts: await db.collection("drafts").countDocuments({ user_id: userId }),
    email_verification_tokens: await db.collection("email_verification_tokens").countDocuments({ user_id: userId }),
    analytics_events: await db.collection("analytics_events").countDocuments({ page_id: pages }),
    publish_events: await db.collection("publish_events").countDocuments({ $or: [{ user_id: userId }, { page_id: pages }] }),
    page_links: await db.collection("page_links").countDocuments({ $or: [{ source_id: pages }, { target_id: pages }] }),
    api_keys: await db.collection("api_keys").countDocuments({ user_id: userId }),
  };
  await mongo.close();
  console.log(`left behind: ${JSON.stringify(left)}`);
  if (userId && Object.values(left).some((n) => n > 0)) fault(`RESIDUE under ${userId}: ${JSON.stringify(left)}`);
}

if (faults.length) {
  console.error(`${faults.length} fault(s).`);
  process.exit(1);
}
console.log(`Screenshots written to ${OUT}/`);
