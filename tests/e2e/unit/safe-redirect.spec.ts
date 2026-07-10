import { test, expect } from "@playwright/test";
import { isSafeRedirect } from "@/lib/safe-redirect";

// Pure-function unit test for the shared open-redirect guard used by
// /sign-in and /sign-up. No browser/server required — this only exercises
// the exported function directly, so it's safe to run without a running
// dev server (unlike the rest of this directory's e2e specs).

const bypassCases: Array<{ name: string; input: string | undefined }> = [
  { name: "protocol-relative //evil.com", input: "//evil.com" },
  { name: "backslash /\\evil.com (browser-normalized to //evil.com)", input: "/\\evil.com" },
  { name: "mixed /\\/evil.com", input: "/\\/evil.com" },
  { name: "mixed \\/\\/evil.com", input: "\\/\\/evil.com" },
  { name: "mixed //\\evil.com", input: "//\\evil.com" },
  { name: "percent-encoded //  -> /%2F%2Fevil.com", input: "/%2F%2Fevil.com" },
  { name: "double percent-encoded // -> /%252F%252Fevil.com", input: "/%252F%252Fevil.com" },
  { name: "absolute https://evil.com", input: "https://evil.com" },
  { name: "absolute http://evil.com", input: "http://evil.com" },
  { name: "scheme-relative with scheme prefix //evil.com (dup, explicit)", input: "//evil.com" },
  { name: "leading tab before scheme \\t//evil.com", input: "\t//evil.com" },
  { name: "leading newline before scheme \\n//evil.com", input: "\n//evil.com" },
  { name: "empty string", input: "" },
  { name: "undefined", input: undefined },
  { name: "path that merely starts with an allowed prefix as a substring: /apple", input: "/apple" },
  { name: "lookalike host suffix: /app-evil.com", input: "/app-evil.com" },
  { name: "lookalike host suffix: /my-pages-evil.com", input: "/my-pages-evil.com" },
  { name: "lookalike host suffix: /cli-authxevil.com", input: "/cli-authxevil.com" },
  { name: "not a real path prefix at all: /random/path", input: "/random/path" },
  { name: "javascript: scheme", input: "javascript:alert(1)" },
  { name: "data: scheme", input: "data:text/html,<script>alert(1)</script>" },
];

const allowCases: Array<{ name: string; input: string | undefined }> = [
  { name: "bare /app (Clerk fallback redirect)", input: "/app" },
  { name: "/app with query string", input: "/app?foo=bar" },
  { name: "bare /my-pages", input: "/my-pages" },
  { name: "/my-pages with hash", input: "/my-pages#security" },
  { name: "/cli-auth with port+state query", input: "/cli-auth?port=54321&state=abcdef0123456789abcdef0123456789abcdef01" },
  { name: "bare /t/join", input: "/t/join" },
  { name: "/t/join with token query", input: "/t/join?token=abc.def.ghi" },
];

test.describe("isSafeRedirect — bypass cases (must reject)", () => {
  for (const { name, input } of bypassCases) {
    test(name, () => {
      expect(isSafeRedirect(input)).toBe(false);
    });
  }
});

test.describe("isSafeRedirect — legitimate same-app paths (must accept)", () => {
  for (const { name, input } of allowCases) {
    test(name, () => {
      expect(isSafeRedirect(input)).toBe(true);
    });
  }
});
