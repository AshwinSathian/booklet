"use client";

import type { DocSettings } from "@/lib/blocks";
import { UI } from "@/lib/constants";
import { highlightCode } from "@/lib/highlight";
import { useMemo, useState } from "react";

export function CodeBlock({
  lang,
  code,
  settings,
}: {
  lang?: string;
  code: string;
  settings: DocSettings;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const lines = useMemo(() => code.split("\n").length, [code]);
  const shouldCollapse = settings.code === "collapse" && lines > UI.maxCodeCollapseLines;
  const highlighted = useMemo(() => highlightCode(code, lang), [code, lang]);
  const isCollapsed = shouldCollapse && !expanded;

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1600);
    } catch {
      // clipboard may not be available
    }
  }

  return (
    <div className="rounded-xl border border-border-default overflow-hidden bg-bg-elevated">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-default bg-fill-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate text-[12px] font-mono text-text-muted">
            {lang ?? "code"}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="tabular-nums text-[12px] text-text-muted">{lines} lines</span>

          {shouldCollapse ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-md border border-border-default px-2 py-0.5 text-[12px] font-medium text-text-muted transition hover:bg-fill-3 hover:text-text-primary"
              aria-label={expanded ? "Collapse code block" : "Expand code block"}
            >
              {expanded ? "Collapse" : "Expand"}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => void onCopy()}
            className="rounded-md border border-border-default px-2 py-0.5 text-[12px] font-medium text-text-muted transition hover:bg-fill-3 hover:text-text-primary"
            aria-label="Copy code"
          >
            {copyState === "copied" ? "✓ Copied" : "Copy"}
          </button>
        </div>
      </div>

      <pre
        // A scrollable block has to be reachable by keyboard.
        tabIndex={0}
        className={[
          "p-4 text-[13px] leading-[1.55] overflow-auto",
          "font-mono text-text-primary",
          isCollapsed ? "max-h-96" : "",
        ].join(" ")}
      >
        {highlighted ? (
          <code
            className="hljs"
            // highlight.js escapes all HTML entities — safe to use here.
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        ) : (
          <code>{code}</code>
        )}
      </pre>

      {isCollapsed ? (
        <div className="px-3 py-2 text-[12px] text-text-muted border-t border-border-default bg-fill-1">
          Collapsed — use Expand to view the full block.
        </div>
      ) : null}
    </div>
  );
}
