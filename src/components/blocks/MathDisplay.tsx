"use client";

import katex from "katex";

export function MathDisplay({ code }: { code: string }) {
  let html: string;
  try {
    html = katex.renderToString(code, { throwOnError: false, displayMode: true });
  } catch {
    return (
      <div className="katex-display-block overflow-x-auto py-2 text-center">
        <code className="text-[0.9em] font-mono">{code}</code>
      </div>
    );
  }
  return (
    <div
      className="katex-display-block overflow-x-auto py-2 text-center"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
