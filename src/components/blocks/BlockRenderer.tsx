import type { Block, DocSettings } from "@/lib/blocks";
import type { JSX } from "react";
import { UI } from "@/lib/constants";
import { ScrollTop } from "primereact/scrolltop";
import { InlineRenderer } from "./InlineRenderer";

function spacingClass(settings: DocSettings): string {
  return settings.spacing === "compact" ? "gap-3" : "gap-5";
}

function proseWidthClass(settings: DocSettings): string {
  return settings.width === "wide" ? "max-w-[920px]" : "max-w-[760px]";
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
  const lines = code.split("\n").length;
  const shouldCollapse =
    settings.code === "collapse" && lines > UI.maxCodeCollapseLines;

  return (
    <div className="rounded-xl border border-outline overflow-hidden bg-bg-glass">
      <div className="flex items-center justify-between px-3 py-2 text-xs text-[rgb(var(--muted))] bg-[rgb(var(--border))]/25">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-[rgb(var(--muted))]/50" />
          <span>{lang ? lang : "code"}</span>
        </div>
        <span>{lines} lines</span>
      </div>

      <pre
        className={[
          "p-3 text-sm leading-relaxed overflow-auto",
          shouldCollapse ? "max-h-[360px]" : "",
        ].join(" ")}
      >
        <code>{code}</code>
      </pre>

      {shouldCollapse ? (
        <div className="px-3 py-2 text-xs text-[rgb(var(--muted))] border-t border-[rgb(var(--border))] bg-[rgb(var(--border))]/15">
          Long code blocks are collapsed to stay readable.
        </div>
      ) : null}

      <ScrollTop
        target="parent"
        threshold={100}
        className="w-2rem h-2rem border-round-md bg-primary"
        icon="pi pi-arrow-up text-base"
      />
    </div>
  );
}

export function BlockRenderer({
  blocks,
  settings,
}: {
  blocks: Block[];
  settings: DocSettings;
}) {
  return (
    <div className={["w-full", proseWidthClass(settings)].join(" ")}>
      <div
        className={["flex flex-col w-full", spacingClass(settings)].join(" ")}
      >
        {blocks.map((b, idx) => {
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
                  ? "text-3xl sm:text-4xl font-semibold tracking-tight"
                  : b.level === 2
                    ? "text-2xl sm:text-3xl font-semibold tracking-tight"
                    : b.level === 3
                      ? "text-xl sm:text-2xl font-semibold"
                      : "text-lg font-semibold";

              return (
                <Tag key={idx} className={cls}>
                  <InlineRenderer inl={b.inl} />
                </Tag>
              );
            }

            case "paragraph":
              return (
                <p
                  key={idx}
                  className="text-base leading-7 text-[rgb(var(--fg))]"
                >
                  <InlineRenderer inl={b.inl} />
                </p>
              );

            case "list":
              return b.ordered ? (
                <ol key={idx} className="list-decimal pl-6 space-y-2">
                  {b.items.map((it, i) => (
                    <li key={i} className="leading-7">
                      <InlineRenderer inl={it} />
                    </li>
                  ))}
                </ol>
              ) : (
                <ul key={idx} className="list-disc pl-6 space-y-2">
                  {b.items.map((it, i) => (
                    <li key={i} className="leading-7">
                      <InlineRenderer inl={it} />
                    </li>
                  ))}
                </ul>
              );

            case "quote":
              return (
                <div
                  key={idx}
                  className="border-l-4 border-[rgb(var(--border))] pl-4 py-1 text-[rgb(var(--fg))]"
                >
                  <BlockRenderer blocks={b.blocks} settings={settings} />
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
                    <table className="min-w-[680px] w-full text-sm">
                      <thead className="bg-[rgb(var(--border))]/25">
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
                          <tr
                            key={r}
                            className="odd:bg-[rgb(var(--border))]/10"
                          >
                            {row.map((cell, c) => (
                              <td
                                key={c}
                                className="px-3 py-2 align-top border-b border-[rgb(var(--border))]/60"
                              >
                                <InlineRenderer inl={cell} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-3 py-2 text-xs text-[rgb(var(--muted))] bg-[rgb(var(--border))]/15 border-t border-[rgb(var(--border))]">
                    Tip: tables scroll horizontally on small screens.
                  </div>
                </div>
              );

            case "hr":
              return <hr key={idx} className="border-[rgb(var(--border))]" />;

            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}
