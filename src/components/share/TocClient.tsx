"use client";

import type { TocItem } from "@/lib/toc";
import { useEffect, useRef, useState } from "react";

export function DesktopTocClient({ toc }: { toc: TocItem[] }) {
  const [activeId, setActiveId] = useState<string>("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const headingIds = toc.map((t) => t.id);
    // IntersectionObserver's callback only reports entries whose intersection
    // state *changed* since the last callback — not every currently-visible
    // target. Picking the first isIntersecting entry in that batch (the
    // previous approach) picks an arbitrary changed heading, not necessarily
    // the topmost one actually on screen — most visible when scrolling fast
    // enough that several headings change state in one callback, which then
    // highlighted the wrong section. Tracking intersecting state per heading
    // and always recomputing from headingIds' document order fixes this
    // regardless of batch order or how many entries changed at once.
    const intersecting = new Set<string>();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) intersecting.add(entry.target.id);
          else intersecting.delete(entry.target.id);
        }
        const topmost = headingIds.find((id) => intersecting.has(id));
        if (topmost) setActiveId(topmost);
      },
      { rootMargin: "-20% 0% -70% 0%", threshold: 0 },
    );

    const obs = observerRef.current;
    for (const id of headingIds) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }

    return () => obs.disconnect();
  }, [toc]);

  return (
    <aside className="hidden lg:block w-56 shrink-0">
      <div className="sticky top-28">
        <div className="text-2xs font-semibold uppercase tracking-widest text-text-muted mb-3">
          On this page
        </div>
        <nav aria-label="Table of contents">
          <ul className="flex flex-col gap-0.5">
            {toc.map((item) => {
              const isActive = activeId === item.id;
              return (
                <li
                  key={item.id}
                  style={{
                    paddingLeft: item.level === 1 ? 0 : item.level === 2 ? "0.75rem" : "1.5rem",
                  }}
                >
                  <a
                    href={`#${item.id}`}
                    className={[
                      "block px-2 py-1 text-xs leading-[1.4] transition border-l-2 rounded-r-sm",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                      isActive
                        ? "font-medium text-accent-soft border-accent"
                        : "text-text-muted border-transparent hover:text-text-primary hover:border-border-default",
                    ].join(" ")}
                  >
                    {item.text}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}

export function MobileTocClient({ toc }: { toc: TocItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden mb-6">
      <div className="rounded-xl border border-border-default bg-bg-elevated overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold transition hover:bg-fill-2"
          aria-expanded={open}
        >
          <span>Table of contents</span>
          <svg
            width="14"
            height="14"
            fill="none"
            viewBox="0 0 14 14"
            aria-hidden
            className={["transition-transform duration-normal", open ? "rotate-180" : ""].join(" ")}
          >
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Animated height using CSS grid trick */}
        <div
          className="grid transition-all duration-normal ease-spring"
          style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <nav aria-label="Table of contents" className="px-4 pb-4 pt-1 border-t border-border-subtle">
              <ul className="flex flex-col gap-1">
                {toc.map((item) => (
                  <li
                    key={item.id}
                    style={{
                      paddingLeft: item.level === 1 ? 0 : item.level === 2 ? "0.75rem" : "1.5rem",
                    }}
                  >
                    <a
                      href={`#${item.id}`}
                      onClick={() => setOpen(false)}
                      className="text-xs text-text-muted hover:text-text-primary transition underline-offset-4 hover:underline"
                    >
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
