import type { Parent, Root, Text } from "mdast";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { SKIP } from "unist-util-visit-parents";
import { splitWikilinksInInlines } from "./wikilinks/parse";
import {
  CALLOUT_KINDS,
  COLUMNS_MAX,
  COLUMNS_MIN,
  DIAGRAM_LANGS,
  MAX_BLOCK_COUNT,
  MAX_BLOCK_DEPTH,
  type Block,
  type CalloutKind,
  type Inline,
  type ListItem,
  type TableAlign,
} from "./blocks";

type MdNode = {
  type?: string;
  value?: unknown;
  children?: MdNode[];
  url?: unknown;
  alt?: unknown;
  lang?: unknown;
  depth?: unknown;
  ordered?: unknown;
  checked?: unknown;
  name?: unknown;
  identifier?: unknown;
  align?: unknown;
  data?: { directiveLabel?: boolean };
};

/**
 * Per-parse mutable state, threaded through every recursive function below
 * instead of living at module scope — parseToBlocks must be safe to call
 * concurrently (it runs per-request on the server) and re-entrantly (a
 * footnote body is parsed by re-entering blocksFromChildren after the main
 * walk already finished), so nothing here can be a module-level variable.
 *
 * `nodeCount`/`truncated` are mutated in place by reference — plain numbers
 * would need to be threaded as extra return values through every recursive
 * call site instead.
 */
type ParseCtx = {
  /** identifier → resolved URL, from top-level `[label]: url` definitions. */
  definitions: Map<string, string>;
  /** identifier → the raw footnoteDefinition node, from `[^id]: body`. */
  footnoteDefs: Map<string, MdNode>;
  /** identifier → 1-based display index, assigned in first-reference order. */
  footnoteOrder: Map<string, number>;
  nodeCount: number;
  truncated: boolean;
};

function newCtx(tree: Root): ParseCtx {
  const definitions = new Map<string, string>();
  visit(tree, "definition", (node) => {
    const n = node as unknown as MdNode;
    if (typeof n.identifier === "string" && typeof n.url === "string") {
      definitions.set(n.identifier, n.url);
    }
  });

  const footnoteDefs = new Map<string, MdNode>();
  visit(tree, "footnoteDefinition", (node) => {
    const n = node as unknown as MdNode;
    if (typeof n.identifier === "string") footnoteDefs.set(n.identifier, n);
  });

  return { definitions, footnoteDefs, footnoteOrder: new Map(), nodeCount: 0, truncated: false };
}

function footnoteIndex(ctx: ParseCtx, id: string): number {
  const existing = ctx.footnoteOrder.get(id);
  if (existing !== undefined) return existing;
  const n = ctx.footnoteOrder.size + 1;
  ctx.footnoteOrder.set(id, n);
  return n;
}

/**
 * Re-parses a fragment that remark-math's tokenizer had already swallowed
 * into a bogus inline-math span (see the "inlineMath" case below), this
 * time without the math extension in the pipeline at all — so a `$` is
 * just a literal character and never competes with emphasis/strong
 * tokenization for the same characters. This recovers formatting (e.g. a
 * `**bold**` marker) that spanned across the original false math-span
 * boundary and would otherwise render as literal, unpaired asterisks
 * forever: by the time we see the mdast tree, the swallowed characters
 * are already gone from the surrounding text nodes and irrecoverable by
 * simply re-emitting them as flat text.
 *
 * Falls back to flat literal text if the fragment doesn't parse back into
 * a single plain paragraph (e.g. it happened to start with characters
 * that read as a heading/list marker once re-parsed standalone) — that's
 * a rarer, lower-stakes cosmetic miss than the KaTeX-garbling bug this
 * whole path exists to fix.
 */
function reparseSwallowedMathFragment(fragment: string, ctx: ParseCtx, depth: number): Inline[] {
  const root = unified().use(remarkParse).use(remarkGfm).parse(fragment) as Root;
  const children = (root.children ?? []) as unknown as MdNode[];
  if (children.length === 1 && children[0].type === "paragraph") {
    return inlineFromNodes(children[0].children ?? [], ctx, depth);
  }
  return [{ t: "text", v: fragment }];
}

function inlineFromNodes(nodes: MdNode[], ctx: ParseCtx, depth: number): Inline[] {
  if (depth > MAX_BLOCK_DEPTH) {
    ctx.truncated = true;
    return [];
  }

  const out: Inline[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!n) continue;

    switch (n.type) {
      case "text":
        out.push({ t: "text", v: String((n as Text).value ?? "") });
        break;
      case "strong":
        out.push({ t: "strong", c: inlineFromNodes(n.children ?? [], ctx, depth + 1) });
        break;
      case "emphasis":
        out.push({ t: "em", c: inlineFromNodes(n.children ?? [], ctx, depth + 1) });
        break;
      case "delete":
        out.push({ t: "del", c: inlineFromNodes(n.children ?? [], ctx, depth + 1) });
        break;
      case "inlineCode":
        out.push({ t: "code", v: String(n.value ?? "") });
        break;
      case "link":
        out.push({
          t: "link",
          href: String(n.url ?? ""),
          c: inlineFromNodes(n.children ?? [], ctx, depth + 1),
        });
        break;
      case "linkReference": {
        // `[text][ref]` / `[text][]` — resolve against the top-level
        // `[ref]: url` definitions collected up front. An unresolved
        // reference (dangling/typo'd label) degrades to its plain text
        // rather than vanishing or linking to nothing.
        const id = String(n.identifier ?? "");
        const children = inlineFromNodes(n.children ?? [], ctx, depth + 1);
        const url = ctx.definitions.get(id);
        if (url) out.push({ t: "link", href: url, c: children });
        else out.push(...children);
        break;
      }
      case "image":
        out.push({
          t: "image",
          src: String(n.url ?? ""),
          alt: String(n.alt ?? ""),
        });
        break;
      case "imageReference": {
        // `![alt][ref]` — same definition-table resolution as linkReference.
        // An unresolved reference is dropped, same as a link with no href
        // would be inert; there's no sensible inline fallback for an image.
        const id = String(n.identifier ?? "");
        const url = ctx.definitions.get(id);
        if (url) out.push({ t: "image", src: url, alt: String(n.alt ?? "") });
        break;
      }
      case "footnoteReference": {
        const id = String(n.identifier ?? "");
        if (ctx.footnoteDefs.has(id)) {
          out.push({ t: "footnoteRef", id, n: footnoteIndex(ctx, id) });
        }
        break;
      }
      case "inlineMath": {
        // remark-math's single-`$` tokenizer pairs an opening `$` with
        // whichever `$` comes next, with no regard for plausibility — so
        // two unrelated prose dollar amounts in one paragraph (e.g. "$5/mo
        // ... reached $5,000/mo") get parsed as one giant math span
        // spanning the prose between them, which KaTeX then renders as
        // concatenated, space-stripped italic variables. Pandoc's
        // documented fix for this exact false positive: a closing `$`
        // immediately followed by a digit is not a valid math delimiter
        // (the digit would be the first character of the very next
        // sibling, since that's what the real closing `$` is adjacent to).
        const mathValue = String(n.value ?? "");
        const next = nodes[i + 1];
        const nextValue = next?.type === "text" ? String(next.value ?? "") : "";
        if (/^[0-9]/.test(nextValue)) {
          out.push(...reparseSwallowedMathFragment(`$${mathValue}$${nextValue}`, ctx, depth));
          i++; // next's text is now folded into the fragment re-parsed above
        } else {
          out.push({ t: "math", v: mathValue });
        }
        break;
      }
      case "textDirective": {
        // Booklet has no inline text-directive syntax (only :::container
        // directives — see the "Directive containers" section below) so a
        // `:name`/`:name[...]`/`:name{...}` fragment reaching here is
        // always ordinary prose remark-directive misparsed (a colon
        // immediately followed by directive-name characters, e.g. a time
        // "10:42", a ratio "16:9", a reference "John 3:16" — anything
        // matching /:[A-Za-z0-9_-]/  with no preceding space requirement).
        // Degrade to literal source text instead of silently dropping it,
        // same "unsupported syntax survives as plain text" rule already
        // applied to wikilinks and unrecognized callout kinds in this file.
        const directiveNode = n as unknown as {
          name?: unknown;
          children?: MdNode[];
          attributes?: Record<string, string> | null;
        };
        const name = typeof directiveNode.name === "string" ? directiveNode.name : "";
        const label = plainTextFromNodes(directiveNode.children ?? []);
        let literal = `:${name}`;
        if (label) literal += `[${label}]`;
        if (directiveNode.attributes && Object.keys(directiveNode.attributes).length > 0) {
          const attrs = Object.entries(directiveNode.attributes)
            .map(([k, v]) => `${k}=${v}`)
            .join(" ");
          literal += `{${attrs}}`;
        }
        out.push({ t: "text", v: literal });
        break;
      }
      case "break":
        out.push({ t: "text", v: "\n" });
        break;
      default:
        if (Array.isArray(n.children)) out.push(...inlineFromNodes(n.children, ctx, depth + 1));
        break;
    }
  }
  // `[[Target]]`/`[[Target|Label]]` never forms a valid CommonMark
  // link/reference, so it survives remark-parse as literal text — detected
  // here by regex over the merged text runs, the same style already used
  // for the `> [!NOTE]` callout marker (tryParseCallout, below).
  return splitWikilinksInInlines(mergeAdjacentText(out));
}

function mergeAdjacentText(inl: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const part of inl) {
    const prev = out[out.length - 1];
    if (part.t === "text" && prev?.t === "text") {
      prev.v += part.v;
      continue;
    }
    out.push(part);
  }
  return out;
}

/**
 * Parse a listItem node into a ListItem, recursing into nested block children.
 * `depth` is the depth already charged for this list (see listBlockFromNode)
 * — an item's own paragraph/inline content stays at that depth; only a
 * *further* nested container (a list/quote/directive inside this item)
 * charges another level.
 */
function listItemFromNode(node: MdNode, ctx: ParseCtx, depth: number): ListItem {
  const checked: boolean | null =
    typeof node.checked === "boolean" ? node.checked : null;

  const inl: Inline[] = [];
  const children: Block[] = [];

  for (const ch of node.children ?? []) {
    if (ch.type === "paragraph") {
      // Detect paragraphs that are only an image — surfaces as inline image.
      inl.push(...inlineFromNodes(ch.children ?? [], ctx, depth));
    } else if (ch.type === "list") {
      const nested = listBlockFromNode(ch, ctx, depth + 1);
      if (nested) children.push(nested);
    } else if (ch.type === "blockquote") {
      const callout = tryParseCallout(ch, ctx, depth + 1);
      if (callout) {
        children.push({ t: "callout", kind: callout.kind, blocks: callout.blocks });
      } else {
        children.push({ t: "quote", blocks: blocksFromChildren(ch.children ?? [], ctx, depth + 1) });
      }
    } else if (ch.type === "containerDirective") {
      children.push(...blocksFromContainerDirective(ch, ctx, depth + 1));
    } else if (Array.isArray(ch.children)) {
      inl.push(...inlineFromNodes(ch.children, ctx, depth));
    }
  }

  const item: ListItem = { inl: mergeAdjacentText(inl) };
  if (checked !== null) item.checked = checked;
  if (children.length) item.children = children;
  return item;
}

/** Returns null (instead of an empty list) once MAX_BLOCK_DEPTH is exceeded,
 * so pure list-in-list-in-list nesting — which never re-enters
 * blocksFromChildren — is bounded independently of it. */
function listBlockFromNode(node: MdNode, ctx: ParseCtx, depth: number): Block | null {
  if (depth > MAX_BLOCK_DEPTH) {
    ctx.truncated = true;
    return null;
  }
  const ordered = Boolean(node.ordered);
  const items: ListItem[] = (node.children ?? []).map((n) => listItemFromNode(n, ctx, depth));
  return { t: "list", ordered, items };
}

// GitHub/Obsidian-convergent callout marker: the blockquote's first line is
// `[!KIND]`, optionally followed by more text on the same line. Matched
// case-insensitively; unrecognized kinds fall through to a plain quote so
// `> [!bogus]` (or any future GFM alert kind not yet in CALLOUT_KINDS)
// degrades gracefully instead of erroring.
const CALLOUT_MARKER_RE = /^\[!([a-z]+)\]\s*/i;

/**
 * Detects the `[!KIND]` marker on a blockquote's first line and, if present
 * and recognized, returns the parsed callout. Returns null for any
 * blockquote that isn't a callout, so callers fall back to a plain `quote`
 * block — this is what makes the syntax degrade gracefully in older
 * Booklet versions or any other CommonMark renderer (it's just a
 * blockquote whose first word looks odd).
 */
function tryParseCallout(
  node: MdNode,
  ctx: ParseCtx,
  depth: number,
): { kind: CalloutKind; blocks: Block[] } | null {
  const children = node.children ?? [];
  const first = children[0];
  if (!first || first.type !== "paragraph") return null;

  const paraChildren: MdNode[] = first.children ?? [];
  const firstInline = paraChildren[0];
  if (!firstInline || firstInline.type !== "text" || typeof firstInline.value !== "string") {
    return null;
  }

  const match = CALLOUT_MARKER_RE.exec(firstInline.value);
  if (!match) return null;

  const kind = match[1].toLowerCase();
  if (!(CALLOUT_KINDS as readonly string[]).includes(kind)) return null;

  const remainder = firstInline.value.slice(match[0].length);
  let restOfFirstPara = paraChildren.slice(1);
  if (remainder) {
    // Same-line content after the marker, e.g. `[!NOTE] inline note text`.
    restOfFirstPara = [{ type: "text", value: remainder }, ...restOfFirstPara];
  } else if (restOfFirstPara[0]?.type === "break") {
    // Marker consumed the whole first line — drop the soft break that
    // follows it so the callout's body doesn't start with a blank line.
    restOfFirstPara = restOfFirstPara.slice(1);
  }

  const remainingChildren: MdNode[] =
    restOfFirstPara.length > 0
      ? [{ type: "paragraph", children: restOfFirstPara }, ...children.slice(1)]
      : children.slice(1);

  return { kind: kind as CalloutKind, blocks: blocksFromChildren(remainingChildren, ctx, depth) };
}

// ─── Directive containers (:::toggle, :::columns) — remark-directive ──────
//
// A containerDirective's optional `[Label]` becomes its first child: a
// paragraph with `data.directiveLabel === true` (see mdast-util-directive).
// Both `toggle` and `columns` consume that label if present (columns simply
// discards it — there's nothing to show it as); an unrecognized directive
// name is dropped entirely, matching the existing "unknown mdast node type"
// behavior elsewhere in this file, so `:::whatever` degrades gracefully
// instead of erroring.

function isDirectiveLabel(node: MdNode | undefined): boolean {
  return Boolean(node && node.type === "paragraph" && node.data?.directiveLabel === true);
}

function directiveLabelText(children: MdNode[]): string | null {
  const first = children[0];
  if (!isDirectiveLabel(first)) return null;
  return plainTextFromNodes(first?.children ?? []);
}

function plainTextFromNodes(nodes: MdNode[]): string {
  let out = "";
  for (const n of nodes) {
    if (!n) continue;
    if (n.type === "text") out += String(n.value ?? "");
    else if (n.type === "break") out += " ";
    else if (Array.isArray(n.children)) out += plainTextFromNodes(n.children);
  }
  return out;
}

/** Strips the directive's label paragraph (if any), returning just the body. */
function directiveBodyChildren(node: MdNode): MdNode[] {
  const children = node.children ?? [];
  return directiveLabelText(children) !== null ? children.slice(1) : children;
}

function toggleBlockFromDirective(node: MdNode, ctx: ParseCtx, depth: number): Block {
  const label = directiveLabelText(node.children ?? []);
  const summary = label?.trim() ? label.trim() : "Details";
  return { t: "toggle", summary, blocks: blocksFromChildren(directiveBodyChildren(node), ctx, depth) };
}

/**
 * Splits a `:::columns` directive's body into column groups on top-level
 * `---` (thematicBreak) separators. Returns null when there aren't at least
 * COLUMNS_MIN groups — callers fall back to rendering the body unwrapped
 * rather than a single-column "columns" block. Caps at COLUMNS_MAX by
 * folding any extra separators' content into the final column, so the
 * schema's `.max(COLUMNS_MAX)` is always satisfiable from parsed input.
 */
function columnsBlockFromDirective(node: MdNode, ctx: ParseCtx, depth: number): Block | null {
  const body = directiveBodyChildren(node);

  const groups: MdNode[][] = [[]];
  for (const ch of body) {
    if (ch.type === "thematicBreak") {
      groups.push([]);
    } else {
      groups[groups.length - 1].push(ch);
    }
  }

  if (groups.length < COLUMNS_MIN) return null;

  const finalGroups =
    groups.length > COLUMNS_MAX
      ? [...groups.slice(0, COLUMNS_MAX - 1), groups.slice(COLUMNS_MAX - 1).flat()]
      : groups;

  return { t: "columns", columns: finalGroups.map((g) => blocksFromChildren(g, ctx, depth)) };
}

/** Dispatches a containerDirective node by name. Returns zero or more Blocks
 * to splice into the caller's block list (zero for an unrecognized name, or
 * for `columns` falling back to its unwrapped body). */
function blocksFromContainerDirective(node: MdNode, ctx: ParseCtx, depth: number): Block[] {
  const name = String(node.name ?? "").toLowerCase();

  if (name === "toggle") return [toggleBlockFromDirective(node, ctx, depth)];

  if (name === "columns") {
    const block = columnsBlockFromDirective(node, ctx, depth);
    return block ? [block] : blocksFromChildren(directiveBodyChildren(node), ctx, depth);
  }

  return [];
}

const TABLE_ALIGN_VALUES = new Set(["left", "center", "right"]);

function tableAlignFromNode(node: MdNode): TableAlign[] {
  const raw = Array.isArray(node.align) ? node.align : [];
  return raw.map((a) => (typeof a === "string" && TABLE_ALIGN_VALUES.has(a) ? (a as TableAlign) : null));
}

function blocksFromChildren(children: MdNode[], ctx: ParseCtx, depth: number): Block[] {
  if (depth > MAX_BLOCK_DEPTH) {
    ctx.truncated = true;
    return [];
  }

  const blocks: Block[] = [];

  for (const node of children) {
    if (!node) continue;

    if (ctx.nodeCount >= MAX_BLOCK_COUNT) {
      ctx.truncated = true;
      break;
    }

    switch (node.type) {
      case "heading": {
        const headingDepth = Number(node.depth ?? 2);
        const level = Math.min(Math.max(headingDepth, 1), 4) as 1 | 2 | 3 | 4;
        blocks.push({ t: "heading", level, inl: inlineFromNodes(node.children ?? [], ctx, depth) });
        ctx.nodeCount++;
        break;
      }

      case "paragraph": {
        const ch: MdNode[] = node.children ?? [];
        // A paragraph containing only a single image node → image block.
        if (ch.length === 1 && ch[0].type === "image") {
          blocks.push({
            t: "image",
            src: String(ch[0].url ?? ""),
            alt: String(ch[0].alt ?? ""),
          });
        } else {
          blocks.push({ t: "paragraph", inl: inlineFromNodes(ch, ctx, depth) });
        }
        ctx.nodeCount++;
        break;
      }

      case "list": {
        const list = listBlockFromNode(node, ctx, depth + 1);
        if (list) {
          blocks.push(list);
          ctx.nodeCount++;
        }
        break;
      }

      case "blockquote": {
        const callout = tryParseCallout(node, ctx, depth + 1);
        if (callout) {
          blocks.push({ t: "callout", kind: callout.kind, blocks: callout.blocks });
        } else {
          blocks.push({ t: "quote", blocks: blocksFromChildren(node.children ?? [], ctx, depth + 1) });
        }
        ctx.nodeCount++;
        break;
      }

      case "containerDirective": {
        const directiveBlocks = blocksFromContainerDirective(node, ctx, depth + 1);
        blocks.push(...directiveBlocks);
        ctx.nodeCount += directiveBlocks.length;
        break;
      }

      case "code": {
        const lang = node.lang ? String(node.lang).trim() : "";
        // Route diagram languages to the diagram block type.
        if (lang && DIAGRAM_LANGS.has(lang)) {
          blocks.push({ t: "diagram", lang, code: String(node.value ?? "") });
        } else {
          blocks.push({
            t: "code",
            lang: lang || undefined,
            code: String(node.value ?? ""),
          });
        }
        ctx.nodeCount++;
        break;
      }

      case "math":
        blocks.push({ t: "math", display: true, code: String(node.value ?? "") });
        ctx.nodeCount++;
        break;

      case "thematicBreak":
        blocks.push({ t: "hr" });
        ctx.nodeCount++;
        break;

      case "table": {
        const head: Inline[][] = [];
        const rowNodes = node.children ?? [];
        const headRow = rowNodes[0];
        if (headRow?.type === "tableRow") {
          head.push(
            ...(headRow.children ?? []).map((c: MdNode) => inlineFromNodes(c.children ?? [], ctx, depth)),
          );
        }
        const rows: Inline[][][] = rowNodes.slice(1).map((tr: MdNode) =>
          (tr.children ?? []).map((c: MdNode) => inlineFromNodes(c.children ?? [], ctx, depth)),
        );
        blocks.push({ t: "table", head, rows, align: tableAlignFromNode(node) });
        ctx.nodeCount++;
        break;
      }

      default:
        // Unhandled node types include `definition` and `footnoteDefinition`
        // — both are collected up front (see newCtx) and rendered
        // separately (a resolved link/image, and a trailing "footnotes"
        // block respectively), so they intentionally produce nothing here.
        break;
    }
  }

  return blocks;
}

export function parseToBlocks(input: string): Block[] {
  try {
    const tree = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkDirective)
      .parse(input) as Root;
    visit(tree, "html", removeRawHtmlNodes);

    const ctx = newCtx(tree);
    const blocks = blocksFromChildren((tree.children ?? []) as unknown as MdNode[], ctx, 0);

    if (ctx.footnoteOrder.size > 0) {
      const items = Array.from(ctx.footnoteOrder.entries())
        .sort((a, b) => a[1] - b[1])
        .map(([id, n]) => ({
          id,
          n,
          blocks: blocksFromChildren(ctx.footnoteDefs.get(id)?.children ?? [], ctx, 1),
        }));
      blocks.push({ t: "footnotes", items });
    }

    if (ctx.truncated) {
      blocks.push({
        t: "paragraph",
        inl: [
          {
            t: "text",
            v: "⚠ Some content was omitted — this document is too large or deeply nested to render in full.",
          },
        ],
      });
    }

    return blocks;
  } catch {
    // Parsing itself — remark's own tokenizer, or our tree walk above — can
    // exceed the call stack on pathological input (e.g. thousands of nested
    // blockquotes) before ever producing a tree for MAX_BLOCK_DEPTH's own
    // check to apply to. Every caller (all publish/patch routes, and the
    // live editor preview) depends on parseToBlocks never throwing, so a
    // catastrophic failure degrades to one explanatory block instead of an
    // unhandled exception (a 500, or a crashed preview pane).
    return [
      {
        t: "paragraph",
        inl: [
          {
            t: "text",
            v: "This document couldn't be parsed — it may contain unusually deep nesting. Try simplifying the structure.",
          },
        ],
      },
    ];
  }
}

function removeRawHtmlNodes(
  _node: unknown,
  index: number | undefined,
  parent: Parent | undefined,
) {
  if (!parent || typeof index !== "number") return;
  parent.children.splice(index, 1);
  return SKIP;
}
