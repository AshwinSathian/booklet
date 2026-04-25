import type { Inline } from "@/lib/blocks";
import React from "react";

function safeHref(href: string): string {
  const trimmed = href.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^mailto:/i.test(trimmed)) return trimmed;
  return "#";
}

function safeSrc(src: string): string {
  const trimmed = (src ?? "").trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : "";
}

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
          case "link":
            return (
              <a
                key={i}
                href={safeHref(node.href)}
                target={safeHref(node.href) === "#" ? "_self" : "_blank"}
                rel="noreferrer"
                className="text-accent-soft underline decoration-accent/40 underline-offset-4 transition hover:decoration-accent-soft"
              >
                <InlineRenderer inl={node.c} />
              </a>
            );
          case "image": {
            const src = safeSrc(node.src);
            if (!src) return null;
            return (
              <img
                key={i}
                src={src}
                alt={node.alt}
                className="inline-block max-w-full align-middle rounded"
              />
            );
          }
          default:
            return null;
        }
      })}
    </>
  );
}
