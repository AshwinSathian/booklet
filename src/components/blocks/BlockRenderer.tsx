"use client";

import type { Block, DocSettings } from "@/lib/blocks";
import { UI } from "@/lib/constants";
import { ScrollTop } from "primereact/scrolltop";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { InlineRenderer } from "./InlineRenderer";

function spacingClass(settings: DocSettings): string {
  return settings.spacing === "compact" ? "gap-4" : "gap-6";
}

function proseWidthClass(settings: DocSettings): string {
  return settings.width === "wide" ? "max-w-4xl" : "max-w-3xl";
}

function CodeBlock({
  lang,
  code,
  settings,
}: {
  lang?: string;
  code: string;
  settings: DocSettings;
}) {
  const [expanded, setExpanded] = useState(false);

  const lines = useMemo(() => code.split("\n").length, [code]);
  const shouldCollapse =
    settings.code === "collapse" && lines > UI.maxCodeCollapseLines;

  const isCollapsed = shouldCollapse && !expanded;

  return (
    <div className="rounded-xl border border-outline overflow-hidden bg-bg-glass">
      <div className="flex items-center justify-between px-3 py-2 text-xs text-[rgb(var(--muted))] bg-[rgb(var(--border))]/20">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-block w-2 h-2 rounded-full bg-[rgb(var(--muted))]/55" />
          <span className="truncate">{lang ? lang : "code"}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="tabular-nums">{lines} lines</span>

          {shouldCollapse ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-md border border-outline px-2 py-1 text-[10px] uppercase tracking-widest hover:bg-[rgb(var(--border))]/15"
              aria-label={
                expanded ? "Collapse code block" : "Expand code block"
              }
            >
              {expanded ? "Collapse" : "Expand"}
            </button>
          ) : null}
        </div>
      </div>

      <pre
        className={[
          "p-3 text-sm leading-6 overflow-auto",
          "font-mono",
          isCollapsed ? "max-h-90" : "",
        ].join(" ")}
      >
        <code>{code}</code>
      </pre>

      {isCollapsed ? (
        <div className="px-3 py-2 text-xs text-[rgb(var(--muted))] border-t border-[rgb(var(--border))]/70 bg-[rgb(var(--border))]/10">
          Collapsed for readability. Use Expand to view the full block.
        </div>
      ) : null}

      <ScrollTop
        target="parent"
        threshold={120}
        className="w-2rem h-2rem border-round-md bg-primary"
        icon="pi pi-arrow-up text-base"
      />
    </div>
  );
}

export function BlockRenderer({
  blocks,
  settings,
  headingAnchors,
  keyPrefix,
}: {
  blocks: Block[];
  settings: DocSettings;
  headingAnchors?: Record<string, string>;
  keyPrefix?: string;
}) {
  return (
    <div className={["w-full", proseWidthClass(settings)].join(" ")}>
      <div
        className={["flex flex-col w-full", spacingClass(settings)].join(" ")}
      >
        {blocks.map((b, idx) => {
          const blockKey = keyPrefix ? `${keyPrefix}.${idx}` : String(idx);

          switch (b.t) {
            case "heading": {
              const Tag = (
                b.level === 1
                  ? "h1"
                  : b.level === 2
                    ? "h2"
                    : b.level === 3
                      ? "h3"
                      : "h4"
              ) as keyof JSX.IntrinsicElements;

              const cls =
                b.level === 1
                  ? "text-3xl sm:text-4xl font-semibold tracking-tight leading-tight"
                  : b.level === 2
                    ? "text-2xl sm:text-3xl font-semibold tracking-tight leading-tight"
                    : b.level === 3
                      ? "text-xl sm:text-2xl font-semibold leading-snug"
                      : "text-lg font-semibold leading-snug";

              const anchorId = headingAnchors?.[blockKey];

              return (
                <Tag
                  key={idx}
                  id={anchorId}
                  className={[
                    "group scroll-mt-24",
                    cls,
                    anchorId ? "relative" : "",
                  ].join(" ")}
                >
                  <span className="inline-flex items-center gap-2">
                    <InlineRenderer inl={b.inl} />
                    {anchorId ? (
                      <a
                        href={`#${anchorId}`}
                        className={[
                          "text-[rgb(var(--muted))]",
                          "opacity-0 group-hover:opacity-70",
                          "focus:opacity-100",
                          "underline-offset-4 hover:underline",
                          "rounded-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--border))]",
                          "px-1",
                        ].join(" ")}
                        aria-label="Link to this section"
                      >
                        #
                      </a>
                    ) : null}
                  </span>
                </Tag>
              );
            }

            case "paragraph":
              return (
                <p
                  key={idx}
                  className="text-[15px] sm:text-base leading-7 text-[rgb(var(--fg))]"
                >
                  <InlineRenderer inl={b.inl} />
                </p>
              );

            case "list":
              return b.ordered ? (
                <ol
                  key={idx}
                  className="list-decimal pl-6 space-y-2 text-[15px] sm:text-base leading-7 text-[rgb(var(--fg))]"
                >
                  {b.items.map((it, i) => (
                    <li key={i}>
                      <InlineRenderer inl={it} />
                    </li>
                  ))}
                </ol>
              ) : (
                <ul
                  key={idx}
                  className="list-disc pl-6 space-y-2 text-[15px] sm:text-base leading-7 text-[rgb(var(--fg))]"
                >
                  {b.items.map((it, i) => (
                    <li key={i}>
                      <InlineRenderer inl={it} />
                    </li>
                  ))}
                </ul>
              );

            case "quote":
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-[rgb(var(--border))]/80 bg-[rgb(var(--border))]/10 px-4 py-3"
                >
                  <div className="border-l-4 border-[rgb(var(--border))] pl-4">
                    <BlockRenderer
                      blocks={b.blocks}
                      settings={settings}
                      headingAnchors={headingAnchors}
                      keyPrefix={blockKey}
                    />
                  </div>
                </div>
              );

            case "code":
              return (
                <CodeBlock
                  key={idx}
                  lang={b.lang}
                  code={b.code}
                  settings={settings}
                />
              );

            case "table":
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-[rgb(var(--border))] overflow-hidden"
                >
                  <div className="overflow-auto">
                    <table className="min-w-170 w-full text-sm">
                      <thead className="bg-[rgb(var(--border))]/20">
                        <tr>
                          {b.head.map((cell, i) => (
                            <th
                              key={i}
                              className="text-left px-3 py-2 font-semibold text-[rgb(var(--fg))] border-b border-[rgb(var(--border))]"
                            >
                              <InlineRenderer inl={cell} />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {b.rows.map((row, r) => (
                          <tr key={r} className="odd:bg-[rgb(var(--border))]/8">
                            {row.map((cell, c) => (
                              <td
                                key={c}
                                className="px-3 py-2 align-top border-b border-[rgb(var(--border))]/50 text-[rgb(var(--fg))]"
                              >
                                <InlineRenderer inl={cell} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-3 py-2 text-xs text-[rgb(var(--muted))] bg-[rgb(var(--border))]/10 border-t border-[rgb(var(--border))]">
                    Tip: tables scroll horizontally on small screens.
                  </div>
                </div>
              );

            case "hr":
              return (
                <hr key={idx} className="border-[rgb(var(--border))]/70" />
              );

            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}
