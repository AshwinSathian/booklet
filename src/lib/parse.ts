import type { Content, Parent, Root, Text } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { SKIP } from "unist-util-visit-parents";
import type { Block, Inline } from "./blocks";

type MdNode = any;

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
      case "break":
        out.push({ t: "text", v: "\n" });
        break;
      default:
        // Fallback: if it has children, attempt to read them as inline.
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

function blocksFromChildren(children: Content[]): Block[] {
  const blocks: Block[] = [];

  for (const node of children as MdNode[]) {
    if (!node) continue;

    switch (node.type) {
      case "heading": {
        const depth = Number(node.depth ?? 2);
        const level = Math.min(Math.max(depth, 1), 4) as 1 | 2 | 3 | 4;
        blocks.push({
          t: "heading",
          level,
          inl: inlineFromNodes(node.children ?? []),
        });
        break;
      }

      case "paragraph": {
        blocks.push({
          t: "paragraph",
          inl: inlineFromNodes(node.children ?? []),
        });
        break;
      }

      case "list": {
        const ordered = Boolean(node.ordered);
        const items: Inline[][] = [];
        for (const li of node.children ?? []) {
          const liInl: Inline[] = [];
          // listItem children often contain a paragraph; flatten basic inline content
          for (const ch of li.children ?? []) {
            if (ch.type === "paragraph")
              liInl.push(...inlineFromNodes(ch.children ?? []));
            else if (Array.isArray(ch.children))
              liInl.push(...inlineFromNodes(ch.children ?? []));
          }
          items.push(mergeAdjacentText(liInl));
        }
        blocks.push({ t: "list", ordered, items });
        break;
      }

      case "blockquote": {
        blocks.push({
          t: "quote",
          blocks: blocksFromChildren(node.children ?? []),
        });
        break;
      }

      case "code": {
        blocks.push({
          t: "code",
          lang: node.lang ? String(node.lang) : undefined,
          code: String(node.value ?? ""),
        });
        break;
      }

      case "thematicBreak": {
        blocks.push({ t: "hr" });
        break;
      }

      case "table": {
        const head: Inline[][] = [];
        const rows: Inline[][][] = [];

        const rowNodes = node.children ?? [];
        const headRow = rowNodes[0];
        if (headRow?.type === "tableRow") {
          const headCells = headRow.children ?? [];
          head.push(
            ...headCells.map((c: any) => inlineFromNodes(c.children ?? [])),
          );
        }

        for (let r = 1; r < rowNodes.length; r += 1) {
          const tr = rowNodes[r];
          if (tr?.type !== "tableRow") continue;
          const cells = (tr.children ?? []).map((c: any) =>
            inlineFromNodes(c.children ?? []),
          );
          rows.push([cells].flat());
        }

        // Normalize rows: rows is Inline[][][] where each row is Inline[][]
        const normalizedRows: Inline[][][] = rowNodes
          .slice(1)
          .map((tr: any) => {
            const cells = (tr.children ?? []).map((c: any) =>
              inlineFromNodes(c.children ?? []),
            );
            return cells;
          });

        blocks.push({ t: "table", head, rows: normalizedRows });
        break;
      }

      default:
        // ignore unknown blocks safely
        break;
    }
  }

  return blocks;
}

export function parseToBlocks(input: string): Block[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(input) as Root;

  // Defensive: strip any raw HTML nodes if present.
  visit(tree as any, "html", removeRawHtmlNodes);

  return blocksFromChildren(tree.children ?? []);
}

function removeRawHtmlNodes(
  node: any,
  index: number | undefined,
  parent: Parent | undefined,
) {
  if (!parent || typeof index !== "number") return;
  (parent.children as any[]).splice(index, 1);
  return SKIP;
}
