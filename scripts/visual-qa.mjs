// Cross-surface visual QA sweep for the "Booklet Visual Elevation" plan.
// Requires a running dev server — start with `npm run dev` first and pass
// its actual URL (Next.js may pick a non-3000 port if 3000 is occupied).
// Usage: node scripts/visual-qa.mjs http://localhost:3000
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE_URL = process.argv[2];
if (!BASE_URL) {
  console.error("Usage: node scripts/visual-qa.mjs <base-url>");
  process.exit(1);
}

// `/my-pages` (Task 9's shadow-token swap) and `/p/wayfarer-textbook` (Task
// 7's share/reactions/TOC chrome, an existing published page reused here
// specifically to avoid burning the local dev DB's anonymous publish quota)
// round out every surface Tasks 1-10 actually touched.
// Task 29 (Precision redesign) adds the routes below that the prior "The
// Reveal" sweep never covered, plus surfaces this redesign introduced.
// `/admin` will likely redirect/404 without admin access in most
// environments — acceptable, since this still confirms the route doesn't
// crash. `/reset-password` renders its "missing token" state since no
// `?token=` param is supplied here — also acceptable for the same reason.
//
// Intentionally NOT covered by this automated sweep: `/t/[slug]`,
// `/t/[slug]/admin`, `/t/join`, `/c/[id]`, `/u/[id]`. Each requires a real
// team/collection/user to exist, the same reasoning `/my-pages` needs its
// own special-cased authenticated block below rather than living here.
const ROUTES = [
  "/",
  "/app",
  "/sign-in",
  "/sign-up",
  "/templates",
  "/pricing",
  "/changelog",
  "/api-docs",
  "/about",
  "/admin",
  "/explore",
  "/tags",
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/terms",
  "/mcp",
  "/mcp-setup",
  "/cli-auth",
];

// `/p/wayfarer-textbook` has 108 headings, so a `fullPage` capture is tens
// of thousands of pixels tall and unreviewable as a single image. Task 7's
// changes there (ShareButtons/Reactions/TocClient) live at the very top
// (sticky header + TOC) and the very bottom (Reactions + ShareButtons sit
// after all content, right before the footer) — so two viewport-height
// shots, top and scrolled-to-bottom, cover the actually-changed chrome.
const PUBLISHED_PAGE_ROUTE = "/p/wayfarer-textbook";
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];
const THEMES = ["dark", "light"];

// `/my-pages` requires auth, so it can't ride the anonymous-context loop
// above. A throwaway local dev-DB test account is used, signed in through
// the real UI form (matching Task 9's approach) rather than seeded via a
// direct API call, so the session cookie comes from the actual sign-in
// flow being screenshotted elsewhere in this same sweep.
const AUTH_EMAIL = "task11-qa@test.local";
const AUTH_PASSWORD = "Task11QaPass!";

mkdirSync("qa-screenshots", { recursive: true });

const browser = await chromium.launch();

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({ viewport });
    await page.emulateMedia({ colorScheme: theme });
    for (const route of ROUTES) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle" });
      const safeName = route === "/" ? "home" : route.replace(/\//g, "_");
      await page.screenshot({
        path: `qa-screenshots/${theme}-${viewport.name}-${safeName}.png`,
        fullPage: true,
      });
    }

    // Published page: top (header/TOC) and scrolled-to-bottom
    // (Reactions/ShareButtons/footer) viewport shots — see comment above.
    await page.goto(`${BASE_URL}${PUBLISHED_PAGE_ROUTE}`, { waitUntil: "networkidle" });
    await page.screenshot({
      path: `qa-screenshots/${theme}-${viewport.name}-published-top.png`,
    });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);
    await page.screenshot({
      path: `qa-screenshots/${theme}-${viewport.name}-published-bottom.png`,
    });

    await page.close();
  }
}

// `/my-pages`: sign in once per theme via the UI, then reuse that
// authenticated context across both viewports so it's a real cookie-bearing
// session, not an emulated one.
for (const theme of THEMES) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: theme });

  // Self-provisioning: always attempt sign-up first so this script works
  // against a fresh dev DB with no pre-existing test account, not just one
  // that happens to already have AUTH_EMAIL registered from earlier manual
  // testing. "Account already exists" (409, from src/app/api/auth/signup/
  // route.ts) is an expected, non-fatal outcome here — fall through to the
  // real sign-in below either way. Posted directly to the API (matching the
  // /api/publish call further down) rather than through the UI form, since
  // the UI sign-in flow immediately below is what actually needs exercising
  // for the screenshot sweep.
  const signupRes = await page.request.post(`${BASE_URL}/api/auth/signup`, {
    data: { email: AUTH_EMAIL, password: AUTH_PASSWORD },
  });
  if (!signupRes.ok() && signupRes.status() !== 409) {
    throw new Error(
      `/my-pages setup: sign-up for ${AUTH_EMAIL} failed unexpectedly ` +
        `(status ${signupRes.status()}): ${await signupRes.text()}`,
    );
  }
  // A successful (non-409) sign-up also creates a session (see
  // src/app/api/auth/signup/route.ts's `createSession` call), and
  // src/app/sign-in/page.tsx redirects an already-signed-in visitor straight
  // to /app instead of rendering the form — so #email/#password would never
  // appear below. Log out unconditionally so the real sign-in UI flow always
  // gets exercised the same way regardless of whether sign-up just ran for
  // real or was a no-op 409 against a pre-existing account.
  await page.request.post(`${BASE_URL}/api/auth/logout`);

  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "networkidle" });
  await page.fill("#email", AUTH_EMAIL);
  await page.fill("#password", AUTH_PASSWORD);
  await Promise.all([
    page.waitForURL(`${BASE_URL}/app`, { timeout: 15_000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  // waitForURL above swallows its own timeout so the click's navigation and
  // the wait can run concurrently — but a swallowed timeout must not be
  // allowed to pass silently. Confirm sign-in actually landed on /app (the
  // real success destination per src/app/sign-in/AuthForm.tsx's
  // `router.push(redirectUrl ?? "/app")` on a 2xx /api/auth/login response);
  // anything else means auth is broken and the rest of this loop would just
  // screenshot an unauthenticated redirect mislabeled as "my-pages-*.png".
  if (!page.url().startsWith(`${BASE_URL}/app`)) {
    throw new Error(
      `/my-pages setup: sign-in for ${AUTH_EMAIL} did not land on /app ` +
        `(landed on ${page.url()} instead) — auth flow is broken, aborting.`,
    );
  }

  // Ensure the account has at least one published page so /my-pages
  // renders a real PageCard, not just the empty state (the empty state
  // was already reviewed via the public routes above / Task 9's own pass).
  // Uses the authenticated publish path, which is exempt from the
  // anonymous-only monthly quota (see src/app/api/publish/route.ts).
  // NOTE: each script run adds one more throwaway publish to this account
  // with no cleanup — harmless for local dev-DB QA, but if this ever runs
  // often enough to matter, /my-pages will accumulate stale sample cards.
  const publishRes = await page.request.post(`${BASE_URL}/api/publish`, {
    data: {
      raw: "# Visual QA sample page\n\nA short published page used only to populate `/my-pages` with a real card for this sweep.",
    },
  });
  if (!publishRes.ok()) {
    throw new Error(
      `/my-pages setup: /api/publish failed (status ${publishRes.status()}): ${await publishRes.text()}`,
    );
  }

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.goto(`${BASE_URL}/my-pages`, { waitUntil: "networkidle" });
    await page.screenshot({
      path: `qa-screenshots/${theme}-${viewport.name}-my-pages.png`,
      fullPage: true,
    });
  }

  await context.close();
}

await browser.close();
console.log("Screenshots written to ./qa-screenshots/");
