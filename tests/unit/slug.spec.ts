import { test, expect } from "@playwright/test";
import { isValidSlug } from "@/lib/slug";

// Regression coverage for unifying slug validation across three previously
// inconsistent call sites: api/pages/[id]/route.ts required a 3-char minimum
// but its own error message claimed "1-60"; api/v1/pages/[id]/route.ts
// actually allowed a 1-char minimum; api/v1/publish/route.ts applied a
// frontmatter `slug:` with no validation at all. All three now import this
// one function.

test.describe("isValidSlug", () => {
  const valid = ["abc", "a-b", "ab-cd-ef", "a".repeat(60), "abc123", "a1-b2-c3"];
  const invalid = [
    "ab", // below the 3-char minimum
    "a", // below the 3-char minimum
    "-abc", // leading hyphen
    "abc-", // trailing hyphen
    "a--b", // consecutive hyphens
    "a".repeat(61), // above the 60-char maximum
    "ABC", // uppercase not allowed
    "abc def", // space not allowed
    "abc_def", // underscore not allowed
    "",
  ];

  for (const slug of valid) {
    test(`accepts "${slug.length > 20 ? slug.slice(0, 20) + "…(" + slug.length + " chars)" : slug}"`, () => {
      expect(isValidSlug(slug)).toBe(true);
    });
  }

  for (const slug of invalid) {
    test(`rejects "${slug.length > 20 ? slug.slice(0, 20) + "…(" + slug.length + " chars)" : slug}"`, () => {
      expect(isValidSlug(slug)).toBe(false);
    });
  }
});
