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

  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "networkidle" });
  await page.fill("#email", AUTH_EMAIL);
  await page.fill("#password", AUTH_PASSWORD);
  await Promise.all([
    page.waitForURL(`${BASE_URL}/app`, { timeout: 15_000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);

  // Ensure the account has at least one published page so /my-pages
  // renders a real PageCard, not just the empty state (the empty state
  // was already reviewed via the public routes above / Task 9's own pass).
  // Uses the authenticated publish path, which is exempt from the
  // anonymous-only monthly quota (see src/app/api/publish/route.ts).
  await page.request.post(`${BASE_URL}/api/publish`, {
    data: {
      raw: "# Visual QA sample page\n\nA short published page used only to populate `/my-pages` with a real card for this sweep.",
    },
  });

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
