"use client";

import { useCallback, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

type AssistState = "idle" | "streaming" | "done" | "error";

const QUICK_ACTIONS = [
  { key: "improve", label: "Improve writing", icon: "✨" },
  { key: "grammar", label: "Fix grammar", icon: "✓" },
  { key: "shorten", label: "Shorten", icon: "↓" },
  { key: "expand", label: "Expand", icon: "↑" },
  { key: "summarize", label: "Summarize", icon: "◎" },
  { key: "intro", label: "Add introduction", icon: "▶" },
  { key: "conclusion", label: "Add conclusion", icon: "◀" },
] as const;

export function AiAssistPanel({
  raw,
  onInsert,
  onReplace,
  onClose,
}: {
  raw: string;
  onInsert: (text: string) => void;
  onReplace: (text: string) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [state, setState] = useState<AssistState>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const run = useCallback(
    async (opts: { action?: string; custom?: string }) => {
      if (state === "streaming") return;
      abortRef.current?.abort();

      setResult("");
      setError(null);
      setState("streaming");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/ai/assist", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            raw,
            action: opts.action ?? "custom",
            prompt: opts.custom ?? "",
          }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `Request failed (${res.status})`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;
          setResult(accumulated);
          // Auto-scroll
          if (resultRef.current) {
            resultRef.current.scrollTop = resultRef.current.scrollHeight;
          }
        }

        setState("done");
      } catch (e) {
        if ((e as { name?: string }).name === "AbortError") {
          setState("idle");
          return;
        }
        setError(e instanceof Error ? e.message : "Something went wrong");
        setState("error");
      }
    },
    [raw, state],
  );

  const stop = () => {
    abortRef.current?.abort();
    setState(result ? "done" : "idle");
  };

  const handleCustomSubmit = () => {
    if (!prompt.trim()) return;
    void run({ custom: prompt.trim() });
  };

  const hasResult = result.length > 0;

  return (
    <div className="flex flex-col h-full border-l border-border-subtle bg-bg text-text-primary">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-primary">AI Assist</span>
          <span className="rounded-pill border border-accent/30 bg-accent/8 px-1.5 py-0.5 text-2xs font-semibold text-accent leading-none">
            beta
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close AI panel"
          className="flex h-6 w-6 items-center justify-center rounded text-text-muted transition hover:bg-fill-2 hover:text-text-primary"
        >
          <Icon name="close" size={13} />
        </button>
      </div>

      {/* Quick actions */}
      <div className="px-3 py-3 border-b border-border-subtle shrink-0">
        <p className="text-2xs font-semibold text-text-muted uppercase tracking-wider mb-2">Quick actions</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => void run({ action: a.key })}
              disabled={state === "streaming" || !raw.trim()}
              className="inline-flex items-center gap-1 rounded-pill border border-outline bg-bg-elevated px-2.5 py-1 text-xs text-text-secondary transition hover:border-accent-soft/40 hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>{a.icon}</span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom prompt */}
      <div className="px-3 py-3 border-b border-border-subtle shrink-0">
        <p className="text-2xs font-semibold text-text-muted uppercase tracking-wider mb-2">Custom instruction</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleCustomSubmit();
              }
            }}
            placeholder="e.g. Add a risks section…"
            disabled={state === "streaming"}
            className="min-w-0 flex-1 rounded-lg border border-outline bg-bg px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft disabled:opacity-50"
          />
          {state === "streaming" ? (
            <button
              type="button"
              onClick={stop}
              className="shrink-0 rounded-lg border border-red-400/40 bg-red-400/8 px-2.5 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-400/15"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCustomSubmit}
              disabled={!prompt.trim() || !raw.trim()}
              className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Go
            </button>
          )}
        </div>
      </div>

      {/* Result area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {state === "idle" && !hasResult && (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 px-6 text-center">
            <div className="h-10 w-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-lg">
              ✦
            </div>
            <p className="text-sm text-text-muted leading-relaxed">
              Choose a quick action or type a custom instruction above.
            </p>
            {!raw.trim() && (
              <p className="text-xs text-amber-400/80">Write something in the editor first.</p>
            )}
          </div>
        )}

        {(hasResult || state === "streaming") && (
          <div className="flex flex-col flex-1 min-h-0">
            <div
              ref={resultRef}
              className="flex-1 overflow-y-auto px-4 py-3 text-xs font-mono text-text-secondary leading-relaxed whitespace-pre-wrap"
            >
              {result}
              {state === "streaming" && (
                <span className="inline-block w-1.5 h-3.5 bg-accent/70 animate-pulse ml-0.5 align-middle" />
              )}
            </div>

            {state === "done" && hasResult && (
              <div className="shrink-0 flex gap-2 px-4 py-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => onReplace(result)}
                  className="flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98]"
                >
                  Replace document
                </button>
                <button
                  type="button"
                  onClick={() => onInsert(result)}
                  className="flex-1 rounded-lg border border-outline bg-bg-elevated px-3 py-2 text-xs font-medium text-text-secondary transition hover:border-accent-soft/40 hover:text-text-primary active:scale-[0.98]"
                >
                  Append
                </button>
                <button
                  type="button"
                  onClick={() => { setResult(""); setState("idle"); }}
                  className="rounded-lg border border-outline bg-bg px-3 py-2 text-xs text-text-muted transition hover:text-text-primary"
                  title="Clear result"
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
            )}

            {state === "error" && (
              <div className="shrink-0 px-4 py-3 border-t border-border-subtle">
                <p className="text-xs text-red-400">{error}</p>
                <button
                  type="button"
                  onClick={() => { setResult(""); setState("idle"); setError(null); }}
                  className="mt-2 text-xs text-text-muted transition hover:text-text-primary"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
