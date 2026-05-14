"use client";

import { useEffect, useRef, useState } from "react";

export function DiagramBlock({ lang, code }: { lang: string; code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [themeKey, setThemeKey] = useState(0);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeKey((value) => value + 1);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let stale = false;
    setErrMsg(null);
    setReady(false);
    if (containerRef.current) containerRef.current.innerHTML = "";

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
  }, [code, themeKey]);

  return (
    <div className="overflow-hidden rounded-xl border border-border-default bg-bg-elevated">
      <div className="flex items-center gap-2 border-b border-border-default bg-fill-2 px-3 py-2">
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-text-muted/30" />
          <span className="h-2 w-2 rounded-full bg-text-muted/30" />
          <span className="h-2 w-2 rounded-full bg-text-muted/30" />
        </div>
        <span className="text-[11px] font-mono text-text-muted">{lang}</span>
      </div>

      {errMsg ? (
        <div className="m-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm font-semibold text-red-400">Diagram error</p>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-red-300">{errMsg}</pre>
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
        <div className="-mt-16 flex items-center justify-center pb-6 text-[13px] text-text-muted">
          Rendering…
        </div>
      ) : null}
    </div>
  );
}
