import { test, expect } from "@playwright/test";
import { PublishPageInputSchema } from "../../mcp-server/src/schemas.js";

test.describe("PublishPageInputSchema slug validation", () => {
  const base = { raw: "# Hello" };

  test("accepts a valid 3-char slug", () => {
    expect(PublishPageInputSchema.safeParse({ ...base, slug: "abc" }).success).toBe(true);
  });

  test("accepts a valid hyphenated slug", () => {
    expect(PublishPageInputSchema.safeParse({ ...base, slug: "my-release-notes" }).success).toBe(true);
  });

  test("rejects a 2-char slug", () => {
    expect(PublishPageInputSchema.safeParse({ ...base, slug: "ab" }).success).toBe(false);
  });

  test("rejects consecutive hyphens", () => {
    expect(PublishPageInputSchema.safeParse({ ...base, slug: "my--slug" }).success).toBe(false);
  });

  test("rejects a leading hyphen", () => {
    expect(PublishPageInputSchema.safeParse({ ...base, slug: "-my-slug" }).success).toBe(false);
  });

  test("rejects a trailing hyphen", () => {
    expect(PublishPageInputSchema.safeParse({ ...base, slug: "my-slug-" }).success).toBe(false);
  });

  test("rejects uppercase", () => {
    expect(PublishPageInputSchema.safeParse({ ...base, slug: "MySlug" }).success).toBe(false);
  });

  test("rejects raw over 350,000 characters", () => {
    expect(PublishPageInputSchema.safeParse({ raw: "a".repeat(350_001) }).success).toBe(false);
  });

  test("rejects an empty raw", () => {
    expect(PublishPageInputSchema.safeParse({ raw: "" }).success).toBe(false);
  });

  test("accepts omitted optional fields", () => {
    expect(PublishPageInputSchema.safeParse(base).success).toBe(true);
  });
});
