import { test, expect } from "@playwright/test";
import { getSiteOrigin } from "@/lib/site-url";

// Regression coverage: /api/v1/* previously built shareable URLs from
// req.url's origin directly, which is wrong for any internally-routed
// request (e.g. the MCP server calling the API over loopback) — see the
// commit that added this file for a live repro (an MCP-published page's
// url field was "http://localhost:3100/p/...").

test.describe("getSiteOrigin", () => {
  test("prefers NEXT_PUBLIC_SITE_URL over the request's own origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://readable.ashwinsathian.com";
    const req = new Request("http://localhost:3100/api/v1/publish");
    expect(getSiteOrigin(req)).toBe("https://readable.ashwinsathian.com");
  });

  test("falls back to the request's origin when NEXT_PUBLIC_SITE_URL is unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const req = new Request("http://localhost:3100/api/v1/publish");
    expect(getSiteOrigin(req)).toBe("http://localhost:3100");
  });

  test("falls back to the request's origin when NEXT_PUBLIC_SITE_URL is malformed", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "not a url";
    const req = new Request("http://localhost:3100/api/v1/publish");
    expect(getSiteOrigin(req)).toBe("http://localhost:3100");
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  test("strips any path/query from a configured NEXT_PUBLIC_SITE_URL, origin only", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://readable.ashwinsathian.com/some/path?x=1";
    const req = new Request("http://localhost:3100/api/v1/publish");
    expect(getSiteOrigin(req)).toBe("https://readable.ashwinsathian.com");
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });
});
