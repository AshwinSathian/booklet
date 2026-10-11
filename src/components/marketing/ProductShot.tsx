"use client";

import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { DocHeaderStrip } from "@/components/share/DocHeaderStrip";
import { DEFAULT_SETTINGS, type Block } from "@/lib/blocks";
import { useHydrated } from "@/lib/ui/hydration";
import { usePrefersReducedMotion } from "@/lib/motion";
import { onTablistKeyDown } from "@/lib/ui/tablist";
import { useEffect, useRef, useState } from "react";

/** The parser's output after the first `chars` characters of the source. */
export type ShotFrame = { chars: number; blocks: Block[]; strip: boolean };
export type ShotData = Array<{
  id: string;
  label: string;
  file: string;
  url: string;
  source: string;
  meta: Record<string, unknown>;
  frames: ShotFrame[];
}>;

const STEP_MS = 190;
const SETTINGS = { ...DEFAULT_SETTINGS, code: "show" as const };

/**
 * The homepage's product shot. A document is typed on the left and the page
 * it becomes is drawn on the right, from parser output computed on the
 * server (see buildShotData), so the parser is not in this bundle.
 *
 * The server renders the finished page. Playback starts when the shot comes
 * into view, never under reduced motion, and can be paused.
 */
export function ProductShot({ data }: { data: ShotData }) {
  const [tab, setTab] = useState(0);
  const sample = data[tab];
  const last = sample.frames.length - 1;
  const [frame, setFrame] = useState(last);
  const [paused, setPaused] = useState(false);
  const hydrated = useHydrated();
  const reducedMotion = usePrefersReducedMotion();
  const canPlay = hydrated && !reducedMotion;

  const root = useRef<HTMLDivElement>(null);
  const sourcePane = useRef<HTMLPreElement>(null);
  const pagePane = useRef<HTMLDivElement>(null);
  // Whether the visitor has chosen a tab: from then on the shot is theirs, and scrolling it into view restarts nothing.
  const touched = useRef(false);
  // Without playback (before hydration, or under reduced motion) the finished page is what shows.
  const shown = canPlay ? Math.min(frame, last) : last;
  const done = shown >= last;

  // Start the first play when the shot is on screen.
  useEffect(() => {
    if (!canPlay || !root.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        if (!touched.current) setFrame(0);
        observer.disconnect();
      },
      { threshold: 0.35 },
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [canPlay]);

  useEffect(() => {
    if (!canPlay || paused || done) return;
    const timer = setTimeout(() => setFrame((f) => Math.min(f + 1, last)), STEP_MS);
    return () => clearTimeout(timer);
  }, [canPlay, paused, done, frame, last]);

  // Follow the typing; return to the top of both panes when the page is finished.
  useEffect(() => {
    for (const pane of [sourcePane.current, pagePane.current]) {
      if (pane) pane.scrollTop = done ? 0 : pane.scrollHeight;
    }
  }, [frame, done]);

  function select(index: number) {
    touched.current = true;
    setTab(index);
    setPaused(false);
    setFrame(canPlay ? 0 : data[index].frames.length - 1);
  }

  const current = sample.frames[shown];

  return (
    <div ref={root} data-testid="product-shot" data-state={done ? "done" : "playing"} className="mx-auto w-full max-w-[68rem]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Example document" onKeyDown={onTablistKeyDown} className="flex flex-wrap gap-1.5">
          {data.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`shot-tab-${s.id}`}
              aria-selected={i === tab}
              tabIndex={i === tab ? 0 : -1}
              aria-controls="shot-panel"
              onClick={() => select(i)}
              className={
                i === tab
                  ? "rounded-lg bg-accent px-3.5 py-1.5 text-sm font-semibold text-accent-contrast"
                  : "rounded-lg border border-border-strong bg-bg-elevated px-3.5 py-1.5 text-sm font-medium text-text-secondary hover:border-accent hover:text-text-primary"
              }
            >
              {s.label}
            </button>
          ))}
        </div>
        {canPlay ? (
          <button
            type="button"
            onClick={() => (done ? (setPaused(false), setFrame(0)) : setPaused((p) => !p))}
            className="h-8 w-[4.5rem] rounded-lg text-sm font-medium text-text-secondary hover:bg-fill-2 hover:text-text-primary"
          >
            {done ? "Replay" : paused ? "Play" : "Pause"}
          </button>
        ) : (
          // Holds the button's place, so nothing moves when it appears after hydration.
          <span aria-hidden className="h-8 w-[4.5rem]" />
        )}
      </div>

      <div
        id="shot-panel"
        role="tabpanel"
        aria-labelledby={`shot-tab-${sample.id}`}
        className="grid overflow-hidden rounded-2xl border border-border-strong bg-bg-elevated shadow-[0_24px_60px_-28px_rgba(22,21,15,0.35)] md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
      >
        <p className="sr-only">
          An example {sample.label} written in Markdown, shown as its source and as the page Booklet publishes from it.
        </p>

        {/* Source */}
        <div aria-hidden className="flex min-w-0 flex-col border-b border-border-default bg-bg-soft md:border-b-0 md:border-r">
          <div className="flex h-10 items-center gap-2 border-b border-border-default px-4 font-mono text-xs text-text-muted">
            <span className="h-2 w-2 rounded-full bg-text-muted/40" />
            {sample.file}
          </div>
          <pre
            ref={sourcePane}
            data-sample
            className="h-56 overflow-hidden whitespace-pre-wrap break-words px-4 py-4 font-mono text-[12.5px] leading-[1.65] text-text-secondary md:h-[27rem]"
          >
            {sample.source.slice(0, current.chars)}
            {!done ? <span className="ml-px inline-block h-[1.1em] w-[2px] translate-y-[3px] bg-accent" /> : null}
          </pre>
        </div>

        {/* Page */}
        <div className="flex min-w-0 flex-col">
          <div className="flex h-10 items-center gap-2 border-b border-border-default px-4 font-mono text-xs text-text-muted">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
              <rect x="2" y="5.2" width="8" height="5.3" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4 5.2V3.8a2 2 0 0 1 4 0v1.4" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            {done ? (
              <span data-testid="shot-url" className="truncate text-text-primary">
                <span className="rounded-sm bg-highlight px-1 text-on-highlight">{sample.url}</span>
              </span>
            ) : (
              <span className="truncate">Preview</span>
            )}
          </div>
          {/* Decorative: nothing in the page can be focused or clicked. */}
          <div
            ref={pagePane}
            data-testid="shot-page"
            data-sample
            inert
            className="h-[22rem] overflow-hidden px-5 py-6 sm:px-8 md:h-[27rem]"
          >
            {current.strip ? <DocHeaderStrip meta={sample.meta} userId={null} /> : null}
            <BlockRenderer blocks={current.blocks} settings={SETTINGS} headingOffset={1} />
          </div>
        </div>
      </div>
    </div>
  );
}
