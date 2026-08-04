import { test, expect } from "@playwright/test";
import { ListPagesInputSchema } from "../../mcp-server/src/schemas.js";
import { buildFilterNote } from "../../mcp-server/src/tools.js";

// Coverage for the agent-native search capability: list_pages gained
// optional `query`/`tag` filters so an agent can find an existing page
// (e.g. "my release notes") instead of only ever listing everything.

test.describe("ListPagesInputSchema — query/tag", () => {
  test("accepts query and tag together with limit/offset", () => {
    expect(
      ListPagesInputSchema.safeParse({ limit: 10, offset: 0, query: "release", tag: "ops" }).success,
    ).toBe(true);
  });

  test("still accepts no arguments at all (fully optional, backward compatible)", () => {
    expect(ListPagesInputSchema.safeParse({}).success).toBe(true);
  });

  test("rejects a non-string query", () => {
    expect(ListPagesInputSchema.safeParse({ query: 42 }).success).toBe(false);
  });
});

test.describe("buildFilterNote", () => {
  test("returns an empty string when neither filter is set", () => {
    expect(buildFilterNote(undefined, undefined)).toBe("");
  });

  test("describes an active query filter", () => {
    expect(buildFilterNote("release notes", undefined)).toBe(' matching title contains "release notes"');
  });

  test("describes an active tag filter", () => {
    expect(buildFilterNote(undefined, "ops")).toBe(' matching tag "ops"');
  });

  test("describes both filters combined with 'and'", () => {
    expect(buildFilterNote("release", "ops")).toBe(' matching title contains "release" and tag "ops"');
  });

  test("an empty-string query is treated the same as unset", () => {
    expect(buildFilterNote("", "")).toBe("");
  });
});
