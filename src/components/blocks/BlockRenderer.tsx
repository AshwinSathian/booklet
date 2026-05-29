"use client";

import type { Block, DocSettings, ListItem } from "@/lib/blocks";
import dynamic from "next/dynamic";
import type { JSX } from "react";
import { InlineRenderer } from "./InlineRenderer";

// Heavy libraries (KaTeX, highlight.js, Mermaid) are excluded from the SSR
// worker bundle by using ssr:false — they load only in the browser.
const CodeBlock = dynamic(() => import("./CodeBlock").then((m) => m.CodeBlock), { ssr: false });
const DiagramBlock = dynamic(() => import("./DiagramBlock").then((m) => m.DiagramBlock), { ssr: false });
const MathDisplay = dynamic(() => import("./MathDisplay").then((m) => m.MathDisplay), { ssr: false });

function spacingClass(settings: DocSettings): string {
  return settings.spacing === "compact" ? "gap-3" : "gap-4";
}

function proseWidthClass(settings: DocSettings): string {
  return settings.width === "wide" ? "max-w-4xl" : "max-w-3xl";
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
      <div className={["flex flex-col w-full", spacingClass(settings)].join(" ")}>
        {blocks.map((b, idx) => {
          const blockKey = keyPrefix ? `${keyPrefix}.${idx}` : String(idx);

          switch (b.t) {
            case "heading": {
              const Tag = (
                b.level === 1 ? "h1" : b.level === 2 ? "h2" : b.level === 3 ? "h3" : "h4"
              ) as keyof JSX.IntrinsicElements;

              // weight/tracking/leading from @layer base; only size is per-level
              const cls =
                b.level === 1
                  ? "text-[clamp(26px,3.5vw,34px)]"
                  : b.level === 2
                    ? "text-[clamp(20px,2.5vw,26px)]"
                    : b.level === 3
                      ? "text-[clamp(17px,2vw,20px)]"
                      : "text-[16px]";

              const anchorId = headingAnchors?.[blockKey];

              return (
                <Tag
                  key={idx}
                  id={anchorId}
                  className={[
                    "group scroll-mt-24 text-text-primary",
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
                          "text-text-muted",
                          "opacity-0 group-hover:opacity-60",
                          "focus-visible:opacity-100",
                          "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft/50",
                          "text-[0.7em] px-1",
                          "transition",
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
                  className="text-[15px] sm:text-[16px] leading-[1.62] text-text-primary"
                >
                  <InlineRenderer inl={b.inl} />
                </p>
              );

            case "list": {
              const renderItem = (it: ListItem | unknown[], i: number) => {
                // Backwards compat: old published docs stored items as Inline[]
                if (Array.isArray(it)) {
                  return <li key={i}><InlineRenderer inl={it as never} /></li>;
                }
                const item = it as ListItem;
                const isTask = item.checked != null;
                return (
                  <li key={i} className={isTask ? "list-none" : ""}>
                    {isTask ? (
                      <span className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(item.checked)}
                          readOnly
                          className="mt-1 shrink-0 cursor-default accent-accent"
                        />
                        <span className={item.checked ? "line-through text-text-muted" : ""}>
                          <InlineRenderer inl={item.inl} />
                        </span>
                      </span>
                    ) : (
                      <InlineRenderer inl={item.inl} />
                    )}
                    {item.children?.length ? (
                      <BlockRenderer
                        blocks={item.children}
                        settings={settings}
                        headingAnchors={headingAnchors}
                        keyPrefix={`${blockKey}.${i}`}
                      />
                    ) : null}
                  </li>
                );
              };

              return b.ordered ? (
                <ol
                  key={idx}
                  className="list-decimal pl-6 space-y-1.5 text-[15px] sm:text-[16px] leading-[1.62] text-text-primary"
                >
                  {b.items.map(renderItem)}
                </ol>
              ) : (
                <ul
                  key={idx}
                  className="list-disc pl-6 space-y-1.5 text-[15px] sm:text-[16px] leading-[1.62] text-text-primary"
                >
                  {b.items.map(renderItem)}
                </ul>
              );
            }

            case "quote":
              return (
                <div
                  key={idx}
                  className="relative pl-4 py-0.5"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-0.75 rounded-full bg-accent/50" />
                  <div className="text-[15px] leading-[1.62] text-text-muted italic">
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
                <CodeBlock key={idx} lang={b.lang} code={b.code} settings={settings} />
              );

            case "table":
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-border-default overflow-hidden"
                >
                  <div className="overflow-auto">
                    <table className="min-w-2xl w-full text-[14px]">
                      <thead className="bg-fill-2">
                        <tr>
                          {b.head.map((cell, i) => (
                            <th
                              key={i}
                              className="text-left px-4 py-2.5 font-semibold text-text-primary border-b border-border-default"
                            >
                              <InlineRenderer inl={cell} />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {b.rows.map((row, r) => (
                          <tr key={r} className="odd:bg-fill-1 transition hover:bg-fill-3">
                            {row.map((cell, c) => (
                              <td
                                key={c}
                                className="px-4 py-2.5 align-top border-b border-border-subtle text-text-primary"
                              >
                                <InlineRenderer inl={cell} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );

            case "hr":
              return <hr key={idx} className="border-border-default" />;

            case "image": {
              const src = /^https?:\/\//i.test(b.src) ? b.src : "";
              if (!src) return null;
              return (
                <figure key={idx} className="my-0">
                  {/* Markdown images are arbitrary external URLs; next/image cannot safely optimize them without domain allowlists. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={b.alt}
                    className="max-w-full rounded-lg border border-border-subtle"
                  />
                  {b.alt ? (
                    <figcaption className="mt-1.5 text-[13px] text-center text-text-muted italic">
                      {b.alt}
                    </figcaption>
                  ) : null}
                </figure>
              );
            }

            case "diagram":
              return <DiagramBlock key={idx} lang={b.lang} code={b.code} />;

            case "math":
              return <MathDisplay key={idx} code={b.code} />;

            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}
