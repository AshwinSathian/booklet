"use client";

import type { TocItem } from "@/lib/toc";
import { useEffect, useRef, useState } from "react";

export function DesktopTocClient({ toc }: { toc: TocItem[] }) {
  const [activeId, setActiveId] = useState<string>("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const headingIds = toc.map((t) => t.id);

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
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
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--muted))] mb-3">
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
                      "block rounded-md px-2 py-1 text-[12px] leading-[1.4] transition",
                      "focus:outline-none focus:ring-2 focus:ring-[rgb(var(--border))] rounded-sm",
                      isActive
                        ? "font-medium text-accent"
                        : "text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]",
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
      <div className="rounded-xl border border-outline bg-bg-elevated overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-[13px] font-semibold transition hover:bg-outline/20"
          aria-expanded={open}
        >
          <span>Table of contents</span>
          <svg
            width="14"
            height="14"
            fill="none"
            viewBox="0 0 14 14"
            aria-hidden
            className={["transition", open ? "rotate-180" : ""].join(" ")}
          >
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open ? (
          <nav aria-label="Table of contents" className="px-4 pb-4 pt-1 border-t border-outline">
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
                    className="text-[13px] text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] transition underline-offset-4 hover:underline"
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
