import type { Inline } from "@/lib/blocks";
import { sanitizeImageUrl, sanitizeUrl } from "@/lib/render-shared";
import React from "react";
import { InlineMath } from "./InlineMath";

export function InlineRenderer({ inl }: { inl: Inline[] }) {
  return (
    <>
      {inl.map((node, i) => {
        switch (node.t) {
          case "text":
            return <React.Fragment key={i}>{node.v}</React.Fragment>;
          case "strong":
            return (
              <strong key={i} className="font-semibold text-text-primary">
                <InlineRenderer inl={node.c} />
              </strong>
            );
          case "em":
            return (
              <em key={i} className="italic text-text-primary">
                <InlineRenderer inl={node.c} />
              </em>
            );
          case "del":
            return (
              <s key={i} className="text-text-muted">
                <InlineRenderer inl={node.c} />
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
                <InlineRenderer inl={node.c} />
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
          default:
            return null;
        }
      })}
    </>
  );
}
