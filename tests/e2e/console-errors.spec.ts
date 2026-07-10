import { test, expect } from "@playwright/test";

// Regression coverage for P2-9: a console/hydration-error gate across a
// full-site crawl. This would have caught the AppLogo double-<Link> nested
// <a><a> hydration failure (fixed elsewhere this session) fleet-wide, in one
// test, instead of one page at a time.
//
// Crawls every public, unauthenticated route plus one representative
// published page. Fails if any page produces a `pageerror` (uncaught
// exception) or a console error/warning matching React's hydration-mismatch
// message shapes.

const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/api-docs",
  "/changelog",
  "/explore",
  "/pricing",
  "/privacy",
  "/sign-in",
  "/sign-up",
  "/templates",
  "/templates/adr",
  "/terms",
  "/tags",
  "/mcp-setup",
  "/integrations",
  "/cli-auth",
];

// React logs hydration mismatches as console.error with one of these
// message shapes (varies slightly across React 19 minor versions).
const HYDRATION_ERROR_PATTERNS = [
  /hydration failed/i,
  /did not match/i,
  /text content does not match/i,
  /cannot appear as a descendant of/i, // e.g. <a> cannot appear as a descendant of <a>
  /validateDOMNesting/i,
];

test.describe("Console/hydration-error crawl", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} — no pageerror, no hydration warning`, async ({ page }) => {
      const pageErrors: string[] = [];
      const hydrationWarnings: string[] = [];

      page.on("pageerror", (err) => pageErrors.push(err.message));
      page.on("console", (msg) => {
        if (msg.type() !== "error" && msg.type() !== "warning") return;
        const text = msg.text();
        if (HYDRATION_ERROR_PATTERNS.some((re) => re.test(text))) {
          hydrationWarnings.push(text);
        }
      });

      await page.goto(route, { waitUntil: "networkidle" });
      // Give React a moment to finish hydrating and log anything it's going to.
      await page.waitForTimeout(500);

      expect(pageErrors, `Uncaught page errors on ${route}`).toEqual([]);
      expect(hydrationWarnings, `Hydration warnings on ${route}`).toEqual([]);
    });
  }

  test("a published page (/p/:id) — no pageerror, no hydration warning", async ({ page, request }) => {
    const base = process.env.TEST_BASE_URL ?? "http://localhost:3100";
    const res = await request.post(`${base}/api/publish`, {
      data: {
        blocks: [
          { t: "heading", level: 1, inl: [{ t: "text", v: "Console Crawl Test" }] },
          { t: "paragraph", inl: [{ t: "text", v: "Checking for hydration errors." }] },
        ],
        raw: "# Console Crawl Test\n\nChecking for hydration errors.",
      },
    });
    if (res.status() === 429) {
      test.skip(true, "rate limited from a previous run");
      return;
    }
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { id: string };

    const pageErrors: string[] = [];
    const hydrationWarnings: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() !== "error" && msg.type() !== "warning") return;
      const text = msg.text();
      if (HYDRATION_ERROR_PATTERNS.some((re) => re.test(text))) {
        hydrationWarnings.push(text);
      }
    });

    await page.goto(`/p/${body.id}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    expect(pageErrors, "Uncaught page errors on /p/:id").toEqual([]);
    expect(hydrationWarnings, "Hydration warnings on /p/:id").toEqual([]);
  });
});
