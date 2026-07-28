import type { Inline } from "@/lib/blocks";
import { sanitizeImageUrl, sanitizeUrl } from "@/lib/render-shared";
import type { WikilinkRenderCtx } from "@/lib/wikilinks/render-context";
import React from "react";
import { InlineMath } from "./InlineMath";

export function InlineRenderer({
  inl,
  wikilinkCtx,
}: {
  inl: Inline[];
  /** Omitted for a published page — a stored `Block[]` never contains a
   * `wikilink` node (see src/lib/wikilinks/strip.ts), so this only matters
   * for the editor's live preview. */
  wikilinkCtx?: WikilinkRenderCtx;
}) {
  return (
    <>
      {inl.map((node, i) => {
        switch (node.t) {
          case "text":
            return <React.Fragment key={i}>{node.v}</React.Fragment>;
          case "strong":
            return (
              <strong key={i} className="font-semibold text-text-primary">
                <InlineRenderer inl={node.c} wikilinkCtx={wikilinkCtx} />
              </strong>
            );
          case "em":
            return (
              <em key={i} className="italic text-text-primary">
                <InlineRenderer inl={node.c} wikilinkCtx={wikilinkCtx} />
              </em>
            );
          case "del":
            return (
              <s key={i} className="text-text-muted">
                <InlineRenderer inl={node.c} wikilinkCtx={wikilinkCtx} />
              </s>
            );
          case "code":
            return (
              <code
                key={i}
                className="px-1.5 py-0.5 rounded-sm bg-accent-dim border border-border-default font-mono text-[0.9em] text-accent-soft"
              >
                {node.v}
              </code>
            );
          case "link": {
            const href = sanitizeUrl(node.href);
            return (
              <a
                key={i}
                href={href}
                target={href === "#" ? "_self" : "_blank"}
                rel="noreferrer"
                className="text-accent-soft underline decoration-accent/40 underline-offset-4 transition hover:decoration-accent-soft"
              >
                <InlineRenderer inl={node.c} wikilinkCtx={wikilinkCtx} />
              </a>
            );
          }
          case "image": {
            const src = sanitizeImageUrl(node.src);
            if (!src) return null;
            return (
              // Markdown images are arbitrary external URLs; next/image cannot safely optimize them without domain allowlists.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt={node.alt}
                className="inline-block max-w-full align-middle rounded"
              />
            );
          }
          case "math":
            return <InlineMath key={i} code={node.v} />;
          case "footnoteRef":
            return (
              <sup key={i} className="ml-0.5">
                <a
                  href={`#fn-${encodeURIComponent(node.id)}`}
                  id={`fnref-${encodeURIComponent(node.id)}`}
                  className="text-accent-soft no-underline hover:underline"
                  aria-label={`Jump to footnote ${node.n}`}
                >
                  [{node.n}]
                </a>
              </sup>
            );
          case "wikilink": {
            const label = node.label ?? node.target;
            const resolved = wikilinkCtx?.isResolved(node.target) ?? false;
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (resolved) wikilinkCtx?.onNavigate?.(node.target);
                }}
                title={
                  resolved
                    ? `Open "${label}"`
                    : `No draft titled "${node.target}" yet`
                }
                className={[
                  "rounded px-1 py-0.5 text-[0.95em] font-medium align-baseline",
                  resolved
                    ? "bg-accent/10 text-accent-soft transition hover:bg-accent/20 cursor-pointer"
                    : "bg-fill-2 text-text-muted cursor-default",
                ].join(" ")}
              >
                {label}
              </button>
            );
          }
          default:
            return null;
        }
      })}
    </>
  );
}
