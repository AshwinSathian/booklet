import { test, expect } from "@playwright/test";
import { isSameOriginRequest } from "@/lib/auth/origin-check";

// Login-CSRF mitigation for /api/auth/{login,signup} — see
// src/lib/auth/origin-check.ts for why SameSite=Lax alone isn't enough.

function req(headers: Record<string, string>): Request {
  return new Request("https://booklet.example/api/auth/login", { headers });
}

test.describe("isSameOriginRequest", () => {
  test("allows a same-origin request (Origin host matches Host)", () => {
    expect(
      isSameOriginRequest(req({ origin: "https://booklet.example", host: "booklet.example" })),
    ).toBe(true);
  });

  test("rejects a cross-origin request", () => {
    expect(
      isSameOriginRequest(req({ origin: "https://evil.example", host: "booklet.example" })),
    ).toBe(false);
  });

  test("allows a request with no Origin header (non-browser client)", () => {
    expect(isSameOriginRequest(req({ host: "booklet.example" }))).toBe(true);
  });

  test("rejects an Origin present with no Host header", () => {
    expect(isSameOriginRequest(req({ origin: "https://booklet.example" }))).toBe(false);
  });

  test("rejects a malformed Origin header", () => {
    expect(isSameOriginRequest(req({ origin: "not-a-url", host: "booklet.example" }))).toBe(false);
  });

  test("origin port differences are treated as cross-origin", () => {
    expect(
      isSameOriginRequest(req({ origin: "https://booklet.example:8443", host: "booklet.example" })),
    ).toBe(false);
  });
});
