"use client";

import { useEffect, useRef, useState } from "react";

export function DiagramBlock({ lang, code }: { lang: string; code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stale = false;
    setErrMsg(null);
    setReady(false);

    async function go() {
      try {
        const mermaid = (await import("mermaid")).default;
        const isDark = !document.documentElement.classList.contains("light");

        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "default",
          securityLevel: "strict",
        });

        const uid = `diagram-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(uid, code.trim());

        if (!stale && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setReady(true);
        }
      } catch (e) {
        if (!stale) {
          setErrMsg(e instanceof Error ? e.message : "Failed to render diagram");
        }
      }
    }

    go();
    return () => {
      stale = true;
    };
  }, [code]);

  return (
    <div className="rounded-xl border border-[rgb(var(--border))] bg-bg-elevated overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[rgb(var(--border))]/60 bg-[rgb(var(--border))]/12">
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-[rgb(var(--muted))]/30" />
          <span className="h-2 w-2 rounded-full bg-[rgb(var(--muted))]/30" />
          <span className="h-2 w-2 rounded-full bg-[rgb(var(--muted))]/30" />
        </div>
        <span className="text-[11px] font-mono text-[rgb(var(--muted))]">{lang}</span>
      </div>

      {errMsg ? (
        <div className="p-4 text-[13px] text-red-400/80">
          <span className="font-semibold">Diagram error: </span>
          {errMsg}
        </div>
      ) : null}

      {/* Always mounted so containerRef is stable; hidden until ready */}
      <div
        ref={containerRef}
        className={[
          "flex justify-center overflow-auto p-4 [&_svg]:max-w-full [&_svg]:h-auto",
          errMsg ? "hidden" : "",
          !ready && !errMsg ? "opacity-0 pointer-events-none min-h-16" : "",
        ].join(" ")}
      />

      {!ready && !errMsg ? (
        <div className="flex justify-center items-center pb-6 text-[13px] text-[rgb(var(--muted))] -mt-16">
          Rendering…
        </div>
      ) : null}
    </div>
  );
}
