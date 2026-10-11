import { test, expect } from "@playwright/test";

// Task 6.1: the landing page is about engineering documents and makes no
// comparative claim. "only" also rules out "read-only" and "team-only", on
// purpose: the check is on the word, not on what was meant by it.

test("the landing page names the four document types above the fold", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const hero = page.locator("section").first();
  for (const name of ["incident report", "ADR", "RFC", "runbook"]) {
    await expect(hero.getByText(new RegExp(name, "i")).first()).toBeInViewport();
  }
});

test("the landing page says nothing is the only or the first of its kind", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  // The site's own words. The example documents on the page (marked
  // data-sample) are sample content, and an incident timeline may well say
  // "first alert".
  const text = (
    await page.locator("body").evaluate((body) => {
      const copy = body.cloneNode(true) as HTMLElement;
      copy.querySelectorAll("[data-sample]").forEach((el) => el.remove());
      document.body.appendChild(copy);
      const words = copy.innerText;
      copy.remove();
      return words;
    })
  ).toLowerCase();
  for (const word of ["only", "first", "unlike any"]) {
    expect(text, `"${word}" appears on the landing page`).not.toMatch(new RegExp(`\\b${word}\\b`));
  }
});

test("/trust is reachable from the footer and from pricing", async ({ page }) => {
  await page.goto("/pricing");
  await page.getByRole("main").getByRole("link", { name: "Trust page" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("trusting");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Trust" })).toBeVisible();
});
