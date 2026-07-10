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

// Docs published before `typeface` existed have no stored value — treat
// missing as "serif" (the reading-typography default), not "sans", so old
// docs pick up the new typography rather than silently opting out of it.
function isSerifMode(settings: DocSettings): boolean {
  return settings.typeface !== "sans";
}

// Prose (continuous-reading) text gets the distinct reading face, a larger
// optical size, and a measure capped at ~68ch — the classic "readable line
// length" constraint. Non-prose content (tables, code, images, diagrams)
// stays full-width and in the UI font, since a character-measure cap makes
// no sense for tabular/code content. In "sans" mode (opt-out), everything
// reverts to the original compact Inter treatment.
function proseTextClass(settings: DocSettings): string {
  return isSerifMode(settings)
    ? "font-reading text-[18px] sm:text-[19px] leading-[1.7] max-w-[68ch]"
    : "text-[15px] sm:text-[16px] leading-[1.62]";
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
  const serif = isSerifMode(settings);
  // First top-level paragraph (either the very first block, or the first
  // block right after an opening H1) gets a "lede" treatment — one signature
  // reading detail, applied regardless of document type (technical or not).
  // Only meaningful at the top level: a nested recursive call (list items,
  // blockquote children) passes keyPrefix, so !keyPrefix identifies the
  // outermost render.
  const ledeIdx = !keyPrefix
    ? blocks[0]?.t === "paragraph"
      ? 0
      : blocks[0]?.t === "heading" && blocks[1]?.t === "paragraph"
        ? 1
        : -1
    : -1;

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

              // Refined heading rhythm: more air before a heading than after
              // it, so it reads as introducing what follows rather than
              // floating equidistant between two sections. idx > 0 skips
              // the extra top margin on a doc-opening H1.
              const rhythm =
                serif && idx > 0
                  ? b.level === 2
                    ? "mt-3"
                    : b.level === 3
                      ? "mt-1.5"
                      : ""
                  : "";

              const anchorId = headingAnchors?.[blockKey];

              return (
                <Tag
                  key={idx}
                  id={anchorId}
                  className={[
                    "group scroll-mt-24 text-text-primary",
                    serif ? "font-reading" : "",
                    cls,
                    rhythm,
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

            case "paragraph": {
              const isLede = idx === ledeIdx;
              return (
                <p
                  key={idx}
                  className={[
                    proseTextClass(settings),
                    "text-text-primary",
                    // Signature reading detail: the opening paragraph reads
                    // as a lede — slightly larger, the classic editorial
                    // "deck" treatment. Stays text-primary (not muted) since
                    // the opening line is often the most load-bearing
                    // sentence in a technical doc (an incident summary, a
                    // decision's one-line verdict), not a de-emphasized
                    // aside. Scales from the already-serif size rather than
                    // a fixed px value so it stays proportionate at any
                    // base size.
                    isLede ? "text-[1.15em]" : "",
                  ].join(" ")}
                >
                  <InlineRenderer inl={b.inl} />
                </p>
              );
            }

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
                  className={["list-decimal pl-6 space-y-1.5 text-text-primary", proseTextClass(settings)].join(" ")}
                >
                  {b.items.map(renderItem)}
                </ol>
              ) : (
                <ul
                  key={idx}
                  className={["list-disc pl-6 space-y-1.5 text-text-primary", proseTextClass(settings)].join(" ")}
                >
                  {b.items.map(renderItem)}
                </ul>
              );
            }

            case "quote":
              return (
                <div
                  key={idx}
                  className={serif ? "relative pl-5 py-0.5" : "relative pl-4 py-0.5"}
                >
                  <div className={serif ? "absolute left-0 top-0 bottom-0 w-1 rounded-full bg-accent/60" : "absolute left-0 top-0 bottom-0 w-0.75 rounded-full bg-accent/50"} />
                  <div
                    className={
                      serif
                        ? "font-reading text-[19px] sm:text-[20px] leading-[1.6] text-text-primary italic"
                        : "text-[15px] leading-[1.62] text-text-muted italic"
                    }
                  >
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
                // A single scrolling+bordered container (not a border-clipping
                // outer div wrapping a separately-scrolling inner div) — the
                // previous nested overflow-hidden/overflow-auto split caused
                // the last column to visually clip against the rounded corner
                // when scrolled fully right, since the outer rounded mask
                // followed the wrapper's box while the inner content scrolled
                // independently of it. Keeping the border on the scroll
                // container itself means the border/radius travel with the
                // viewport, not the content, so nothing gets clipped.
                <div
                  key={idx}
                  className="overflow-x-auto rounded-xl border border-border-default [-webkit-overflow-scrolling:touch]"
                >
                  <table className="w-full min-w-max text-[14px]">
                    <thead className="bg-fill-2">
                      <tr>
                        {b.head.map((cell, i) => (
                          <th
                            key={i}
                            className="text-left px-4 py-2.5 font-semibold text-text-primary border-b border-border-default whitespace-nowrap"
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
                              className="px-4 py-2.5 align-top border-b border-border-subtle text-text-primary wrap-break-word"
                            >
                              <InlineRenderer inl={cell} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
