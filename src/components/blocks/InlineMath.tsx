"use client";

import katex from "katex";

export function InlineMath({ code }: { code: string }) {
  let html = "";
  try {
    html = katex.renderToString(code, { throwOnError: false, displayMode: false });
  } catch {
    return <code className="text-[0.9em] font-mono">{code}</code>;
  }
  return (
    <span
      className="katex-inline"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
