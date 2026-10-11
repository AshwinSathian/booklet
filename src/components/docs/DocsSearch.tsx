"use client";

import type { SearchEntry } from "@/lib/docs";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const OPEN_EVENT = "booklet:docs-search";

/** A button that opens the docs search. The layout shows one in the sidebar and one above the page on a phone. */
export function DocsSearchButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className="flex h-10 w-full shrink-0 items-center gap-2.5 rounded-lg border border-border-strong bg-bg-elevated px-3 text-sm text-text-muted hover:border-accent"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className="flex-1 text-left">Search the docs</span>
      <kbd className="rounded border border-border-default bg-bg-soft px-1.5 font-mono text-xs">/</kbd>
    </button>
  );
}

/**
 * The docs search dialog: page titles, headings and the text under them.
 * Mounted once by the docs layout. Opens from a DocsSearchButton, with "/"
 * and with ⌘K or Ctrl+K. The index is fetched the first time it opens, and
 * again on the next open if that failed.
 */
export function DocsSearch() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const router = useRouter();

  useEffect(() => {
    const show = () => setOpen(true);
    function onKey(e: KeyboardEvent) {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        show();
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, show);
    };
  }, []);

  useEffect(() => {
    if (!open || entries) return;
    let cancelled = false;
    fetch("/docs/search-index")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setEntries(data);
      })
      // Left unset, so the next open tries again.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, entries]);

  return (
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
        {entries === null ? (
          <Command.Loading>
            <p className="px-3 py-8 text-center text-sm text-text-muted">Loading the index…</p>
          </Command.Loading>
        ) : (
          <Command.Empty className="px-3 py-8 text-center text-sm text-text-muted">Nothing matches.</Command.Empty>
        )}
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
            <span className="text-sm font-semibold">{entry.heading ? `${entry.title}: ${entry.heading}` : entry.title}</span>
            <span className="line-clamp-1 text-xs opacity-75">
              {entry.section}
              {entry.text ? ` · ${entry.text}` : ""}
            </span>
          </Command.Item>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
