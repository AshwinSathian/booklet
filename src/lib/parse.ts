import type { Parent, Root, Text } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { SKIP } from "unist-util-visit-parents";
import { DIAGRAM_LANGS, type Block, type Inline, type ListItem } from "./blocks";

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
      children.push({ t: "quote", blocks: blocksFromChildren(ch.children ?? []) });
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

      case "blockquote":
        blocks.push({ t: "quote", blocks: blocksFromChildren(node.children ?? []) });
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
  const tree = unified().use(remarkParse).use(remarkGfm).parse(input) as Root;
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
