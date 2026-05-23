"use client";

import katex from "katex";

export function MathDisplay({ code }: { code: string }) {
  let html = "";
  try {
    html = katex.renderToString(code, { throwOnError: false, displayMode: true });
  } catch {
    html = `<code>${code}</code>`;
  }
  return (
    <div
      className="katex-display-block overflow-x-auto py-2 text-center"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
