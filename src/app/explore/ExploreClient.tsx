"use client";

import { useMemo, useState } from "react";
import type { ExploreItem } from "@/lib/db";
import Link from "next/link";

type Tab = "trending" | "recent" | "featured";

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

function PageCard({ page, featured: isFeatured }: { page: ExploreItem; featured?: boolean }) {
  const hasTags = page.tags && page.tags.length > 0;

  return (
    <Link
      href={pageHref(page)}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        "group flex flex-col rounded-xl border p-4 transition",
        isFeatured
          ? "border-accent-soft/30 bg-accent-dim/20 hover:border-accent-soft/60 hover:bg-accent-dim/40"
          : "border-border-subtle bg-bg-elevated hover:border-accent-soft/30 hover:bg-fill-1",
      ].join(" ")}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-medium text-text-primary group-hover:text-accent transition line-clamp-2 leading-snug">
            {page.title ?? "Untitled"}
          </p>
          {isFeatured && (
            <span className="shrink-0 rounded-pill bg-accent/10 text-accent text-2xs font-semibold px-2 py-0.5 border border-accent/20">
              Featured
            </span>
          )}
        </div>
        <p className="text-2xs text-text-muted/60 font-mono truncate mb-2">
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

export function ExploreClient({
  featured,
  recent,
}: {
  featured: ExploreItem[];
  recent: ExploreItem[];
}) {
  const [tab, setTab] = useState<Tab>("recent");
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const all = useMemo(() => {
    const seen = new Set<string>();
    const merged: ExploreItem[] = [];
    for (const p of [...featured, ...recent]) {
      if (!seen.has(p.id)) { seen.add(p.id); merged.push(p); }
    }
    return merged;
  }, [featured, recent]);

  // Top tags derived from the page data, sorted by frequency
  const popularTags = useMemo(() => {
    const freq = new Map<string, number>();
    for (const p of all) {
      if (!p.tags) continue;
      for (const t of p.tags) {
        freq.set(t, (freq.get(t) ?? 0) + 1);
      }
    }
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag]) => tag);
  }, [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let pool: ExploreItem[];

    if (tab === "featured") {
      pool = featured;
    } else if (tab === "trending") {
      pool = [...all].sort((a, b) => b.view_count - a.view_count);
    } else {
      pool = [...all].sort((a, b) => b.created_at.localeCompare(a.created_at));
    }

    if (activeTag) {
      pool = pool.filter((p) => p.tags?.includes(activeTag));
    }

    if (!q) return pool;
    return pool.filter((p) =>
      (p.title ?? "").toLowerCase().includes(q) ||
      (p.slug ?? "").toLowerCase().includes(q) ||
      (p.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [tab, query, activeTag, all, featured]);

  const TABS: { id: Tab; label: string }[] = [
    { id: "recent", label: "Recent" },
    { id: "trending", label: "Trending" },
    { id: "featured", label: "Featured" },
  ];

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        {/* Tab bar */}
        <div className="flex items-center gap-0.5 rounded-lg border border-border-default bg-bg-soft p-0.5">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={[
                "px-3 py-1.5 text-xs font-medium rounded-md transition",
                tab === id
                  ? "bg-bg text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-secondary",
              ].join(" ")}
            >
              {label}
              {id === "featured" && featured.length > 0 && (
                <span className="ml-1.5 text-2xs text-accent">{featured.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-xs">
          <svg
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted/50"
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
            className="w-full rounded-lg border border-border-default bg-bg pl-8 pr-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft"
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
            <PageCard key={page.id} page={page} featured={featured.some((f) => f.id === page.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
