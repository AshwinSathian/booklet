"use client";

import { trackEvent } from "@/lib/analytics";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import type { Block, DocSettings } from "@/lib/blocks";
import { blocksToHtmlDocument } from "@/lib/export";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Menu, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/ContextMenu";

function sanitizeFilename(title: string): string {
  return (title || "booklet-export")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "booklet-export";
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportMenu({
  blocks,
  raw,
  title,
}: {
  blocks: Block[];
  settings: DocSettings;
  raw?: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [exportingHtml, setExportingHtml] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const filename = sanitizeFilename(title);

  const handleMarkdown = () => {
    if (!raw) return;
    downloadBlob(raw, `${filename}.md`, "text/markdown;charset=utf-8");
    trackEvent(ANALYTICS_EVENTS.share_export_markdown, {});
    setOpen(false);
  };

  const handleHtml = async () => {
    // Compiling any Graphviz/DOT diagrams to SVG loads a WASM module on
    // first use — usually fast, but real enough to guard against a
    // double-click firing two downloads.
    if (exportingHtml) return;
    setExportingHtml(true);
    try {
      const html = await blocksToHtmlDocument(blocks, title);
      downloadBlob(html, `${filename}.html`, "text/html;charset=utf-8");
      trackEvent(ANALYTICS_EVENTS.share_export_html, {});
      setOpen(false);
    } finally {
      setExportingHtml(false);
    }
  };

  const handlePrint = () => {
    trackEvent(ANALYTICS_EVENTS.share_print, {});
    setOpen(false);
    window.print();
  };

  return (
    <>
      <Button ref={triggerRef} variant="secondary" size="md" onClick={() => setOpen((v) => !v)} title="Export options">
        <Icon name="download" size={13} />
        <span className="hidden sm:inline">Export</span>
      </Button>

      <Menu open={open} onClose={() => setOpen(false)} anchorRef={triggerRef} align="end" widthClass="w-72">
        {raw ? (
          <ContextMenuItem
            icon="markdown"
            label="Download Markdown"
            description="Original source as .md"
            onSelect={handleMarkdown}
          />
        ) : null}
        <ContextMenuItem
          icon="code"
          label={exportingHtml ? "Exporting…" : "Download HTML"}
          description="Standalone HTML document"
          disabled={exportingHtml}
          onSelect={() => void handleHtml()}
        />
        <ContextMenuSeparator />
        <ContextMenuItem
          icon="print"
          label="Print or Save as PDF"
          description="Uses Booklet's print-optimized layout"
          onSelect={handlePrint}
        />
      </Menu>
    </>
  );
}
