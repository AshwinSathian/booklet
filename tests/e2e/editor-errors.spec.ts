import { test, expect } from "@playwright/test";

// Every error the server sends is application/problem+json. The editor must
// show its `detail`, not a bare "Request failed (403)".

test.use({ extraHTTPHeaders: { "cf-connecting-ip": `2001:db8:e7::${Math.random().toString(16).slice(2, 6)}` } });

test("a refused publish shows the server's reason", async ({ page }) => {
  await page.route("**/api/publish", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/problem+json",
      body: JSON.stringify({ type: "about:blank", title: "Forbidden", status: 403, detail: "Publishing is closed for the afternoon." }),
    }),
  );
  await page.goto("/app?template=incident-report");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Publishing is closed for the afternoon.")).toBeVisible();
});
