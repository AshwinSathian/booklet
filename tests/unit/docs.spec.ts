import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { getDocPage, getDocsTree, getInternalLinks, getNeighbours, getSearchIndex, lintDocPage } from "../../src/lib/docs";
import { LEGACY_HASHES } from "../../src/lib/docs-nav";
import { buildToc } from "../../src/lib/toc";
import { parseToBlocks } from "../../src/lib/parse";

const pages = () => getDocsTree().flatMap((s) => s.pages);

test("the tree has the four sections in order and every page has a title and description", () => {
  const tree = getDocsTree();
  expect(tree.map((s) => s.id)).toEqual(["start", "guides", "recipes", "reference"]);
  for (const section of tree) expect(section.pages.length, section.id).toBeGreaterThan(0);
  for (const page of pages()) {
    expect(page.title, page.href).not.toBe("");
    expect(page.description.length, page.href).toBeGreaterThan(20);
    expect(page.order, `${page.href} has no order`).toBeLessThan(999);
  }
});

test("a slug resolves; an unknown slug and a traversal attempt do not", () => {
  expect(getDocPage(["quickstart"])?.title).toBe("Quickstart");
  expect(getDocPage(["guides", "cli"])?.section).toBe("guides");
  expect(getDocPage([])).toBeNull();
  expect(getDocPage(["nope"])).toBeNull();
  expect(getDocPage(["..", "..", "package.json"])).toBeNull();
  expect(getDocPage(["guides", "..%2f..%2fpackage"])).toBeNull();
  expect(getDocPage(["Guides", "cli"])).toBeNull();
});

test("previous and next walk the whole tree once", () => {
  const all = pages();
  expect(getNeighbours(all[0]).prev).toBeNull();
  expect(getNeighbours(all[all.length - 1]).next).toBeNull();
  for (let i = 0; i < all.length - 1; i++) expect(getNeighbours(all[i]).next?.href).toBe(all[i + 1].href);
});

test("the search index has an entry for every page", () => {
  const hrefs = new Set(getSearchIndex().map((e) => e.href.split("#")[0]));
  for (const page of pages()) expect(hrefs.has(page.href), page.href).toBe(true);
});

test("no page has a level-1 heading, a wikilink outside code, or an unknown embed", () => {
  for (const page of pages()) expect(lintDocPage(page), page.href).toEqual([]);
});

test("every schema example token was filled in", () => {
  for (const page of pages()) expect(page.raw, page.href).not.toContain("{{example:");
  expect(getDocPage(["reference", "api"])!.body).toContain('"raw":');
});

/** The heading ids a page renders, as its table of contents builds them. */
const anchorsOf = (href: string) => {
  const page = getDocPage(href.replace(/^\/docs\//, "").split("/"));
  return page ? new Set(buildToc(parseToBlocks(page.body)).toc.map((t) => t.id)) : null;
};

const APP_ROUTES = ["/", "/app", "/pricing", "/templates", "/trust", "/changelog", "/sign-in", "/sign-up", "/my-pages", "/t",
  "/settings/api-keys", "/settings/webhooks", "/settings/account", "/api/v1/openapi.json"];

test("every internal link in the docs points at a page, and a fragment at a heading on it", () => {
  for (const page of pages()) {
    for (const link of getInternalLinks(page)) {
      const [path, hash] = link.split("#");
      if (!path.startsWith("/docs")) {
        expect(APP_ROUTES.includes(path) || existsSync(`public${path}`), `${page.href} links to ${link}`).toBe(true);
        continue;
      }
      if (path === "/docs") continue;
      const anchors = anchorsOf(path);
      expect(anchors, `${page.href} links to ${link}`).not.toBeNull();
      if (hash) expect(anchors!.has(hash), `${page.href} links to ${link}, and that page has no such heading`).toBe(true);
    }
  }
});

test("every old fragment from the pages /docs replaced lands on a page and heading that exist", () => {
  for (const [old, target] of Object.entries(LEGACY_HASHES)) {
    const [path, hash] = target.split("#");
    const anchors = anchorsOf(path);
    expect(anchors, `#${old} goes to ${target}`).not.toBeNull();
    if (hash) expect(anchors!.has(hash), `#${old} goes to ${target}, and that page has no such heading`).toBe(true);
  }
});
