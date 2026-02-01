import type { Inline } from "@/lib/blocks";
import React from "react";

function safeHref(href: string): string {
  // Keep links safe: allow http(s) and mailto only.
  const trimmed = href.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^mailto:/i.test(trimmed)) return trimmed;
  return "#";
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
              <strong key={i} className="font-semibold text-[rgb(var(--fg))]">
                <InlineRenderer inl={node.c} />
              </strong>
            );
          case "em":
            return (
              <em key={i} className="italic text-[rgb(var(--fg))]">
                <InlineRenderer inl={node.c} />
              </em>
            );
          case "code":
            return (
              <code
                key={i}
                className="px-1.5 py-0.5 rounded bg-[rgb(var(--border))]/40 border border-[rgb(var(--border))] text-[0.92em]"
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
                className="underline decoration-[rgb(var(--muted))] underline-offset-4 hover:decoration-[rgb(var(--fg))]"
              >
                <InlineRenderer inl={node.c} />
              </a>
            );
          default:
            return null;
        }
      })}
    </>
  );
}
