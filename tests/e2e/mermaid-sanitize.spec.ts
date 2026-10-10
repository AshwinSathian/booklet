import { test, expect } from "@playwright/test";

// A Mermaid diagram on a published page is sanitized before it is mounted
// (sanitizeRenderedSvg): its labels still render, and CSS smuggled in
// through an init directive cannot load from another host.

test.use({ extraHTTPHeaders: { "cf-connecting-ip": `2001:db8:3e::${Math.random().toString(16).slice(2, 6)}` } });

const DIAGRAM = [
  "```mermaid",
  `%%{init: {"themeCSS": ".node rect { fill: url(https://evil.example/beacon.png); } .edgeLabel { background: url('https://evil.example/b2.png'); }"}}%%`,
  "flowchart LR",
  "  A[Alert fires] --> B[Page the on-call]",
  `  B --> C["Resolve <img src='https://evil.example/label.png'>"]`,
  "```",
].join("\n");

test("a Mermaid diagram keeps its labels and loads nothing from another host", async ({ page }) => {
  const published = await page.request.post("/api/publish", { data: { raw: `# Diagram\n\n${DIAGRAM}\n` } });
  expect(published.ok(), await published.text()).toBe(true);
  const { id } = (await published.json()) as { id: string };

  const offsite: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).hostname === "evil.example") offsite.push(r.url());
  });
  await page.route("https://evil.example/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: "" }));

  await page.goto(`/p/${id}`);
  const diagram = page.locator("svg[id^='diagram-']");
  await expect(diagram).toBeVisible();
  await expect(diagram.getByText("Alert fires")).toBeVisible();
  await expect(diagram.getByText("Page the on-call")).toBeVisible();
  // Give a stylesheet request time to start, were one going to.
  await page.waitForTimeout(500);

  expect(offsite).toEqual([]);
  const markup = await diagram.evaluate((el) => el.outerHTML);
  expect(markup).not.toContain("evil.example");
  expect(markup).not.toMatch(/\son[a-z]+=/);
});
