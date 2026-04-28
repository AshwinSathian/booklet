"use client";

import { trackEvent } from "@/lib/analytics";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import type { Block, DocSettings } from "@/lib/blocks";
import { blocksToHtmlDocument } from "@/lib/export";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

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
  settings,
  raw,
  title,
}: {
  blocks: Block[];
  settings: DocSettings;
  raw?: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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

  // Shared button class
  const itemCls =
    "flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text-secondary transition hover:bg-fill-2 hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Export options"
        className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-muted transition hover:border-border-strong hover:text-text-primary"
      >
        <Icon name="download" size={13} />
        Export
        <Icon name="chevron-down" size={11} />
      </button>

      {open ? (
        <div className="absolute right-0 top-full mt-1.5 z-20 min-w-52 rounded-xl border border-border-default bg-bg-elevated shadow-glass py-1 animate-dropdown-in">
          {raw ? (
            <button type="button" className={itemCls} onClick={handleMarkdown}>
              <span className="text-text-muted shrink-0">
                <Icon name="markdown" size={14} />
              </span>
              <span className="flex-1 text-left">Download Markdown</span>
              <span className="text-2xs text-text-muted font-mono">.md</span>
            </button>
          ) : null}

          <button type="button" className={itemCls} onClick={handleHtml}>
            <span className="text-text-muted shrink-0">
              <Icon name="code" size={14} />
            </span>
            <span className="flex-1 text-left">Download HTML</span>
            <span className="text-2xs text-text-muted font-mono">.html</span>
          </button>

          <div className="my-1 h-px bg-border-subtle" />

          <button type="button" className={itemCls} onClick={handlePrint}>
            <span className="text-text-muted shrink-0">
              <Icon name="print" size={14} />
            </span>
            <span className="flex-1 text-left">Print / Save as PDF</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
