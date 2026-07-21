import type { Parent, Root, Text } from "mdast";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { SKIP } from "unist-util-visit-parents";
import {
  CALLOUT_KINDS,
  COLUMNS_MAX,
  COLUMNS_MIN,
  DIAGRAM_LANGS,
  type Block,
  type CalloutKind,
  type Inline,
  type ListItem,
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
  data?: { directiveLabel?: boolean };
};

function inlineFromNodes(nodes: MdNode[]): Inline[] {
  const out: Inline[] = [];
  for (const n of nodes) {
    if (!n) continue;

    switch (n.type) {
      case "text":
        out.push({ t: "text", v: String((n as Text).value ?? "") });
        break;
      case "strong":
        out.push({ t: "strong", c: inlineFromNodes(n.children ?? []) });
        break;
      case "emphasis":
        out.push({ t: "em", c: inlineFromNodes(n.children ?? []) });
        break;
      case "delete":
        out.push({ t: "del", c: inlineFromNodes(n.children ?? []) });
        break;
      case "inlineCode":
        out.push({ t: "code", v: String(n.value ?? "") });
        break;
      case "link":
        out.push({
          t: "link",
          href: String(n.url ?? ""),
          c: inlineFromNodes(n.children ?? []),
        });
        break;
      case "image":
        out.push({
          t: "image",
          src: String(n.url ?? ""),
          alt: String(n.alt ?? ""),
        });
        break;
      case "inlineMath":
        out.push({ t: "math", v: String(n.value ?? "") });
        break;
      case "break":
        out.push({ t: "text", v: "\n" });
        break;
      default:
        if (Array.isArray(n.children)) out.push(...inlineFromNodes(n.children));
        break;
    }
  }
  return mergeAdjacentText(out);
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
 */
function listItemFromNode(node: MdNode): ListItem {
  const checked: boolean | null =
    typeof node.checked === "boolean" ? node.checked : null;

  const inl: Inline[] = [];
  const children: Block[] = [];

  for (const ch of node.children ?? []) {
    if (ch.type === "paragraph") {
      // Detect paragraphs that are only an image — surfaces as inline image.
      inl.push(...inlineFromNodes(ch.children ?? []));
    } else if (ch.type === "list") {
      // Nested list becomes a child block.
      children.push(listBlockFromNode(ch));
    } else if (ch.type === "blockquote") {
      const callout = tryParseCallout(ch);
      if (callout) {
        children.push({ t: "callout", kind: callout.kind, blocks: callout.blocks });
      } else {
        children.push({ t: "quote", blocks: blocksFromChildren(ch.children ?? []) });
      }
    } else if (ch.type === "containerDirective") {
      children.push(...blocksFromContainerDirective(ch));
    } else if (Array.isArray(ch.children)) {
      inl.push(...inlineFromNodes(ch.children));
    }
  }

  const item: ListItem = { inl: mergeAdjacentText(inl) };
  if (checked !== null) item.checked = checked;
  if (children.length) item.children = children;
  return item;
}

function listBlockFromNode(node: MdNode): Block {
  const ordered = Boolean(node.ordered);
  const items: ListItem[] = (node.children ?? []).map(listItemFromNode);
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
 * Readable versions or any other CommonMark renderer (it's just a
 * blockquote whose first word looks odd).
 */
function tryParseCallout(node: MdNode): { kind: CalloutKind; blocks: Block[] } | null {
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

  return { kind: kind as CalloutKind, blocks: blocksFromChildren(remainingChildren) };
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

function toggleBlockFromDirective(node: MdNode): Block {
  const label = directiveLabelText(node.children ?? []);
  const summary = label?.trim() ? label.trim() : "Details";
  return { t: "toggle", summary, blocks: blocksFromChildren(directiveBodyChildren(node)) };
}

/**
 * Splits a `:::columns` directive's body into column groups on top-level
 * `---` (thematicBreak) separators. Returns null when there aren't at least
 * COLUMNS_MIN groups — callers fall back to rendering the body unwrapped
 * rather than a single-column "columns" block. Caps at COLUMNS_MAX by
 * folding any extra separators' content into the final column, so the
 * schema's `.max(COLUMNS_MAX)` is always satisfiable from parsed input.
 */
function columnsBlockFromDirective(node: MdNode): Block | null {
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

  return { t: "columns", columns: finalGroups.map((g) => blocksFromChildren(g)) };
}

/** Dispatches a containerDirective node by name. Returns zero or more Blocks
 * to splice into the caller's block list (zero for an unrecognized name, or
 * for `columns` falling back to its unwrapped body). */
function blocksFromContainerDirective(node: MdNode): Block[] {
  const name = String(node.name ?? "").toLowerCase();

  if (name === "toggle") return [toggleBlockFromDirective(node)];

  if (name === "columns") {
    const block = columnsBlockFromDirective(node);
    return block ? [block] : blocksFromChildren(directiveBodyChildren(node));
  }

  return [];
}

function blocksFromChildren(children: MdNode[]): Block[] {
  const blocks: Block[] = [];

  for (const node of children) {
    if (!node) continue;

    switch (node.type) {
      case "heading": {
        const depth = Number(node.depth ?? 2);
        const level = Math.min(Math.max(depth, 1), 4) as 1 | 2 | 3 | 4;
        blocks.push({ t: "heading", level, inl: inlineFromNodes(node.children ?? []) });
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
          blocks.push({ t: "paragraph", inl: inlineFromNodes(ch) });
        }
        break;
      }

      case "list":
        blocks.push(listBlockFromNode(node));
        break;

      case "blockquote": {
        const callout = tryParseCallout(node);
        if (callout) {
          blocks.push({ t: "callout", kind: callout.kind, blocks: callout.blocks });
        } else {
          blocks.push({ t: "quote", blocks: blocksFromChildren(node.children ?? []) });
        }
        break;
      }

      case "containerDirective":
        blocks.push(...blocksFromContainerDirective(node));
        break;

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
        break;
      }

      case "math":
        blocks.push({ t: "math", display: true, code: String(node.value ?? "") });
        break;

      case "thematicBreak":
        blocks.push({ t: "hr" });
        break;

      case "table": {
        const head: Inline[][] = [];
        const rowNodes = node.children ?? [];
        const headRow = rowNodes[0];
        if (headRow?.type === "tableRow") {
          head.push(
            ...(headRow.children ?? []).map((c: MdNode) => inlineFromNodes(c.children ?? [])),
          );
        }
        const rows: Inline[][][] = rowNodes.slice(1).map((tr: MdNode) =>
          (tr.children ?? []).map((c: MdNode) => inlineFromNodes(c.children ?? [])),
        );
        blocks.push({ t: "table", head, rows });
        break;
      }

      default:
        break;
    }
  }

  return blocks;
}

export function parseToBlocks(input: string): Block[] {
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkDirective)
    .parse(input) as Root;
  visit(tree, "html", removeRawHtmlNodes);
  return blocksFromChildren((tree.children ?? []) as unknown as MdNode[]);
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
