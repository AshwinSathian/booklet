import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The accent is ink, so `text-accent` on app chrome is ink text that says
// nothing: a link or an active item styled that way looks like plain text.
// Chrome uses `link`, an underline or a fill instead. Published pages are the
// exception: inside a document theme the accent is that theme's link colour.

const DOCUMENT_SURFACES = ["src/components/blocks/", "src/components/share/", "src/app/p/"];
const CUE = /(?<![\w-])(?:[\w-]+:)*text-accent(?:-soft)?(?![\w-])/;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(tsx?|css)$/.test(entry.name) ? [path] : [];
  });
}

test("no app or site chrome uses the accent as a text colour", () => {
  const hits = sources("src")
    .filter((path) => !DOCUMENT_SURFACES.some((surface) => path.startsWith(surface)))
    .flatMap((path) =>
      readFileSync(path, "utf8")
        .split("\n")
        .flatMap((line, i) => (CUE.test(line) ? [`${path}:${i + 1}`] : [])),
    );
  expect(hits).toEqual([]);
});

test("the pattern catches the cue and its variants, and leaves button labels alone", () => {
  for (const cls of ["text-accent", "hover:text-accent", "group-hover:text-accent-soft", "sm:hover:text-accent"]) {
    expect(CUE.test(`class="a ${cls} b"`), cls).toBe(true);
  }
  for (const cls of ["text-accent-contrast", "ring-accent", "border-accent", "bg-accent"]) {
    expect(CUE.test(`class="a ${cls} b"`), cls).toBe(false);
  }
});
