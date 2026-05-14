"use client";

import { trackEvent } from "@/lib/analytics";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import type { Block, DocSettings } from "@/lib/blocks";
import { blocksToHtmlDocument } from "@/lib/export";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ActionDrawer, DrawerSection } from "@/components/ui/ActionDrawer";

function sanitizeFilename(title: string): string {
  return (title || "readable-export")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "readable-export";
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
  settings,
  title,
}: {
  blocks: Block[];
  settings: DocSettings;
  raw?: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const drawerWidth = settings.width === "wide" ? "max-w-4xl" : "max-w-3xl";

  const filename = sanitizeFilename(title);

  const handleMarkdown = () => {
    if (!raw) return;
    downloadBlob(raw, `${filename}.md`, "text/markdown;charset=utf-8");
    trackEvent(ANALYTICS_EVENTS.share_export_markdown, {});
    setOpen(false);
  };

  const handleHtml = () => {
    const html = blocksToHtmlDocument(blocks, title);
    downloadBlob(html, `${filename}.html`, "text/html;charset=utf-8");
    trackEvent(ANALYTICS_EVENTS.share_export_html, {});
    setOpen(false);
  };

  const handlePrint = () => {
    trackEvent(ANALYTICS_EVENTS.share_print, {});
    setOpen(false);
    window.print();
  };

  const itemCls =
    "flex w-full items-center gap-3 border-b border-border-subtle px-3 py-3 text-left text-sm text-text-secondary transition last:border-b-0 hover:bg-fill-2 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Export options"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border-default px-2.5 py-1.5 text-xs font-medium text-text-muted transition hover:border-border-strong hover:text-text-primary sm:px-3"
      >
        <Icon name="download" size={13} />
        <span className="hidden sm:inline">Export</span>
      </button>

      <ActionDrawer
        open={open}
        title="Export"
        description="Download this page or use your browser print flow for a PDF."
        contentWidthClass={drawerWidth}
        onClose={() => setOpen(false)}
      >
        <DrawerSection title="Files">
          {raw ? (
            <button type="button" className={itemCls} onClick={handleMarkdown}>
              <span className="text-text-muted shrink-0">
                <Icon name="markdown" size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-text-primary">Download Markdown</span>
                <span className="mt-0.5 block text-xs text-text-muted">Original Markdown source as .md</span>
              </span>
              <span className="text-2xs text-text-muted font-mono">.md</span>
            </button>
          ) : null}

          <button type="button" className={itemCls} onClick={handleHtml}>
            <span className="text-text-muted shrink-0">
              <Icon name="code" size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-text-primary">Download HTML</span>
              <span className="mt-0.5 block text-xs text-text-muted">Standalone HTML document</span>
            </span>
            <span className="text-2xs text-text-muted font-mono">.html</span>
          </button>
        </DrawerSection>

        <DrawerSection title="Print">
          <button type="button" className={itemCls} onClick={handlePrint}>
            <span className="text-text-muted shrink-0">
              <Icon name="print" size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-text-primary">Print or Save as PDF</span>
              <span className="mt-0.5 block text-xs text-text-muted">Uses Readable&apos;s print-optimized layout</span>
            </span>
          </button>
        </DrawerSection>
      </ActionDrawer>
    </>
  );
}
