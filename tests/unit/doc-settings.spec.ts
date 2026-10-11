import { test, expect } from "@playwright/test";
import { DEFAULT_SETTINGS, resolveSettings } from "@/lib/blocks";

// A publish or an update takes its settings from the request. The API
// documents `width` only, and the CLI, the GitHub Action and the MCP server
// send none: whatever is missing must come from somewhere sensible.

test("nothing sent: a first publish gets the defaults", () => {
  expect(resolveSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  expect(resolveSettings(null)).toEqual(DEFAULT_SETTINGS);
});

test("part sent: the rest is filled in, not left out", () => {
  expect(resolveSettings({ width: "wide" })).toEqual({ ...DEFAULT_SETTINGS, width: "wide" });
});

test("an update that sends nothing keeps what the author chose", () => {
  const stored = { spacing: "compact", width: "wide", code: "show", typeface: "serif", theme: "noir" } as const;
  expect(resolveSettings(undefined, stored)).toEqual(stored);
  expect(resolveSettings({ width: "normal" }, stored)).toEqual({ ...stored, width: "normal" });
});

test("a page stored before typeface existed keeps none, so it still reads as serif", () => {
  const legacy = { spacing: "comfortable", width: "normal", code: "collapse" } as const;
  expect("typeface" in resolveSettings(undefined, legacy)).toBe(false);
});

test("unknown keys and invalid values are dropped", () => {
  const out = resolveSettings({ width: "huge", spacing: 7, typeface: "comic", theme: "<script>", extra: { a: 1 }, __proto__: { x: 1 } });
  expect(out).toEqual(DEFAULT_SETTINGS);
  for (const junk of ["a string", 3, [], true]) expect(resolveSettings(junk)).toEqual(DEFAULT_SETTINGS);
});

test("a theme id is kept; one that is no id at all is not", () => {
  expect(resolveSettings({ theme: "ember" }).theme).toBe("ember");
  expect(resolveSettings({ theme: "x".repeat(40) }).theme).toBeUndefined();
});
