import { test, expect } from "@playwright/test";
import { isAllowedOrigin } from "../../mcp-server/src/origin.js";

test.describe("isAllowedOrigin", () => {
  test("allows requests with no Origin header (every native MCP client)", () => {
    expect(isAllowedOrigin(null)).toBe(true);
  });

  test("allows claude.ai", () => {
    expect(isAllowedOrigin("https://claude.ai")).toBe(true);
  });

  test("allows the Booklet app origin", () => {
    expect(isAllowedOrigin("https://booklet.ashwinsathian.com")).toBe(true);
  });

  test("rejects an unrecognized origin", () => {
    expect(isAllowedOrigin("https://evil.example.com")).toBe(false);
  });

  test("rejects a look-alike subdomain impersonating claude.ai", () => {
    expect(isAllowedOrigin("https://claude.ai.evil.example.com")).toBe(false);
  });

  test("rejects a plain-http variant of an allowed origin", () => {
    expect(isAllowedOrigin("http://claude.ai")).toBe(false);
  });
});
