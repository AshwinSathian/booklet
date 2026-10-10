import { test, expect } from "@playwright/test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InlineRenderer } from "@/components/blocks/InlineRenderer";
import { blocksToHtml } from "@/lib/export/html";
import { parseToBlocks } from "@/lib/parse";
import type { Block } from "@/lib/blocks";

// User-authored links must not pass ranking credit to their targets
// (`nofollow ugc`) — free anonymous publishing is otherwise a link-spam
// target — and must not hand the opened page a window.opener or a Referer.

// Playwright's runner compiles every JSX expression it loads — including the
// app's own components — into its component-testing descriptors
// (`{ __pw_type: "jsx", type, props }`), which react-dom cannot render. This
// turns a descriptor tree back into React elements. It calls function
// components directly, so it only suits hook-free components.
type PwJsx = { __pw_type: "jsx"; type: unknown; props: Record<string, unknown>; key?: string };

function toReact(node: unknown): ReactNode {
  if (Array.isArray(node)) return node.map(toReact);
  if (!node || typeof node !== "object" || !("__pw_type" in node)) return node as ReactNode;
  const { type, props, key } = node as PwJsx;
  const { children, ...rest } = props;
  if (typeof type === "function") return toReact(type(props));
  if (typeof type !== "string") return toReact(children); // fragment
  const kids = toReact(children);
  return createElement(type, { ...rest, key }, ...(Array.isArray(kids) ? kids : [kids]));
}

const REL = 'rel="nofollow ugc noopener noreferrer"';
const blocks = parseToBlocks("[x](https://example.com)") as Block[];

test.describe("rel on user-authored links", () => {
  test("the share-page renderer sets nofollow ugc noopener noreferrer", () => {
    const first = blocks[0];
    if (first.t !== "paragraph") throw new Error(`expected a paragraph, got ${first.t}`);
    const html = renderToStaticMarkup(toReact(InlineRenderer({ inl: first.inl })));
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain(REL);
  });

  test("the HTML export sets nofollow ugc noopener noreferrer", async () => {
    const html = await blocksToHtml(blocks);
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain(REL);
  });
});
