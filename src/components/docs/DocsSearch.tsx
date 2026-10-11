"use client";

import type { SearchEntry } from "@/lib/docs";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Search over the docs: page titles, headings and the text under them.
 * The index is fetched the first time the dialog opens. Opens from the
 * button, with "/" and with ⌘K or Ctrl+K.
 */
export function DocsSearch() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || entries) return;
    fetch("/docs/search-index")
      .then((r) => r.json())
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [open, entries]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-full shrink-0 items-center gap-2.5 rounded-lg border border-border-strong bg-bg-elevated px-3 text-sm text-text-muted hover:border-accent"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="flex-1 text-left">Search the docs</span>
        <kbd className="rounded border border-border-default bg-bg-soft px-1.5 font-mono text-xs">/</kbd>
      </button>

      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Search the docs"
        className="fixed left-1/2 top-[12vh] z-50 w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-border-strong bg-bg-elevated shadow-glass"
        overlayClassName="fixed inset-0 z-40 bg-black/40"
      >
        <Command.Input
          placeholder="Search the docs"
          className="h-14 w-full border-b border-border-default bg-transparent px-5 text-base text-text-primary outline-none placeholder:text-text-muted"
        />
        <Command.List className="max-h-[min(26rem,60vh)] overflow-y-auto p-2">
          {entries === null ? <Command.Loading>Loading…</Command.Loading> : null}
          <Command.Empty className="px-3 py-8 text-center text-sm text-text-muted">Nothing matches.</Command.Empty>
          {entries?.map((entry) => (
            <Command.Item
              key={entry.href}
              value={`${entry.title} ${entry.heading ?? ""} ${entry.text}`}
              onSelect={() => {
                setOpen(false);
                router.push(entry.href);
              }}
              className="flex cursor-pointer flex-col gap-0.5 rounded-lg px-3 py-2.5 data-[selected=true]:bg-highlight data-[selected=true]:text-on-highlight"
            >
              <span className="text-sm font-semibold">
                {entry.heading ? `${entry.title}: ${entry.heading}` : entry.title}
              </span>
              <span className="line-clamp-1 text-xs opacity-75">
                {entry.section}
                {entry.text ? ` · ${entry.text}` : ""}
              </span>
            </Command.Item>
          ))}
        </Command.List>
      </Command.Dialog>
    </>
  );
}
