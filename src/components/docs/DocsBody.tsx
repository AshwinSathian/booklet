"use client";

import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { McpClientPicker } from "@/components/docs/McpClientPicker";
import { DEFAULT_SETTINGS, type Block } from "@/lib/blocks";
import type { DocEmbed } from "@/lib/docs-nav";
import type { ReactNode } from "react";

// Long code blocks are shown whole: a docs reader is there for the code.
const SETTINGS = { ...DEFAULT_SETTINGS, code: "show" as const };

const EMBEDS: Record<DocEmbed, () => ReactNode> = {
  "mcp-client-picker": () => <McpClientPicker />,
};

/** A docs page's Markdown, drawn by the renderer published pages use. */
export function DocsBody({ blocks, headingAnchors }: { blocks: Block[]; headingAnchors: Record<string, string> }) {
  return (
    <BlockRenderer
      blocks={blocks}
      settings={SETTINGS}
      headingAnchors={headingAnchors}
      renderCode={(block) => (block.lang === "booklet-embed" ? EMBEDS[block.code.trim() as DocEmbed]?.() : undefined)}
    />
  );
}
