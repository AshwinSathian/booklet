import { expect, test } from "@playwright/test";
import { highlightCode } from "../../src/lib/highlight";

test("a registered language is highlighted, Markdown included", () => {
  expect(highlightCode("pool_size: 50", "yaml")).toContain("hljs-");
  expect(highlightCode("# Title", "markdown")).toContain("hljs-section");
});

test("an unregistered language comes back as plain text without logging an error", () => {
  const logged: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => logged.push(args);
  try {
    expect(highlightCode("hello", "klingon")).toBeNull();
    expect(highlightCode("hello", "booklet-embed")).toBeNull();
    expect(highlightCode("hello")).toBeNull();
  } finally {
    console.error = original;
  }
  expect(logged).toEqual([]);
});
