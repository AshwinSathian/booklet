"use client";

import { useMemo, useState } from "react";
import type { ExploreItem } from "@/lib/db";
import Link from "next/link";

function pageHref(item: { id: string; slug: string | null }) {
  return `/p/${item.slug ?? item.id}`;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function PageCard({ page }: { page: ExploreItem }) {
  const hasTags = page.tags && page.tags.length > 0;

  return (
    <Link
      href={pageHref(page)}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-xl border p-4 transition border-border-subtle bg-bg-elevated hover:border-accent-soft/30 hover:bg-fill-1"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary group-hover:text-accent transition line-clamp-2 leading-snug mb-1">
          {page.title ?? "Untitled"}
        </p>
        <p className="text-2xs text-text-muted font-mono truncate mb-2">
          {page.slug ? `/p/${page.slug}` : `/p/${page.id}`}
        </p>

        {hasTags && (
          <div className="flex flex-wrap gap-1 mt-1">
            {page.tags!.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-pill bg-fill-1 border border-border-subtle text-2xs text-text-muted px-1.5 py-0.5"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-2xs text-text-muted">{timeAgo(page.created_at)}</span>
        <div className="flex items-center gap-1 text-2xs text-text-muted">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M1 8C2.5 4.5 5 3 8 3s5.5 1.5 7 5c-1.5 3.5-4 5-7 5S2.5 11.5 1 8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          {page.view_count.toLocaleString()}
        </div>
      </div>
    </Link>
  );
}

/** `pages` arrives newest first (see getRecentPublicPages). */
export function ExploreClient({ pages }: { pages: ExploreItem[] }) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Top tags derived from the page data, sorted by frequency
  const popularTags = useMemo(() => {
    const freq = new Map<string, number>();
    for (const p of pages) {
      if (!p.tags) continue;
      for (const t of p.tags) {
        freq.set(t, (freq.get(t) ?? 0) + 1);
      }
    }
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag]) => tag);
  }, [pages]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let pool = pages;

    if (activeTag) {
      pool = pool.filter((p) => p.tags?.includes(activeTag));
    }

    if (!q) return pool;
    return pool.filter((p) =>
      (p.title ?? "").toLowerCase().includes(q) ||
      (p.slug ?? "").toLowerCase().includes(q) ||
      (p.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [query, activeTag, pages]);

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-xs">
          <svg
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
            width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden
          >
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter pages…"
            className="w-full rounded-lg border border-border-default bg-bg pl-8 pr-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft"
          />
        </div>

        {(query || activeTag) && (
          <span className="text-xs text-text-muted shrink-0">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Popular tags strip */}
      {popularTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {activeTag && (
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className="inline-flex items-center gap-1 rounded-pill border border-border-subtle bg-fill-2 px-2.5 py-1 text-2xs text-text-muted transition hover:text-text-primary hover:bg-fill-1"
            >
              <svg width="8" height="8" fill="none" viewBox="0 0 8 8" aria-hidden>
                <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Clear
            </button>
          )}
          {popularTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={[
                "rounded-pill border px-2.5 py-1 text-2xs font-medium transition",
                activeTag === tag
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border-subtle bg-bg-elevated text-text-muted hover:border-accent/30 hover:text-text-primary hover:bg-fill-1",
              ].join(" ")}
            >
              #{tag}
            </button>
          ))}
          <Link
            href="/tags"
            className="rounded-pill border border-border-subtle bg-bg-elevated px-2.5 py-1 text-2xs text-text-muted transition hover:text-text-primary hover:bg-fill-1 hidden sm:inline-flex items-center gap-1"
          >
            All tags
            <svg width="8" height="8" fill="none" viewBox="0 0 8 8" aria-hidden>
              <path d="M1.5 6.5L6.5 1.5M6.5 1.5H3M6.5 1.5V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-subtle py-16 text-center text-sm text-text-muted">
          {query || activeTag
            ? `No pages match${activeTag ? ` #${activeTag}` : ""}${query ? ` "${query}"` : ""}`
            : "No pages yet."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((page) => (
            <PageCard key={page.id} page={page} />
          ))}
        </div>
      )}
    </div>
  );
}
