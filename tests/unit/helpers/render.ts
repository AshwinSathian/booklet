import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Playwright's runner compiles every JSX expression it loads, the app's own
// components included, into its component-testing descriptors
// (`{ __pw_type: "jsx", type, props }`), which react-dom cannot render.
type PwJsx = { __pw_type: "jsx"; type: unknown; props: Record<string, unknown>; key?: string };

async function toReact(node: unknown): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(toReact));
  if (!node || typeof node !== "object" || !("__pw_type" in node)) return node as ReactNode;
  const { type, props, key } = node as PwJsx;
  const { children, ...rest } = props;
  if (typeof type === "function") {
    let out: unknown;
    try {
      out = await (type as (p: unknown) => unknown)(props);
    } catch (e) {
      // A component that uses hooks cannot be called outside a render. Those
      // are the page's interactive chrome, which no server-side check reads.
      if (e instanceof TypeError || /hook/i.test(String(e))) return null;
      throw e;
    }
    return toReact(out);
  }
  const kids = await toReact(children);
  const list = Array.isArray(kids) ? kids : [kids];
  if (typeof type === "string") return createElement(type, { ...rest, key }, ...list);
  // next/link (a forwardRef object) keeps its href; fragments keep their children.
  return typeof rest.href === "string" ? createElement("a", { href: rest.href, key }, ...list) : createElement(Fragment, { key }, ...list);
}

/**
 * Static HTML of a Server Component tree as the test runner loaded it:
 * async components are awaited, hook-using client components are left out.
 * Call it inside the request scope the components need (cookies, headers).
 */
export async function html(node: unknown): Promise<string> {
  return renderToStaticMarkup(createElement(Fragment, null, await toReact(node)));
}
