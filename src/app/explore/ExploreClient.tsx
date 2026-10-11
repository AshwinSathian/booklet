"use client";

import type { ExploreItem } from "@/lib/db";
import Link from "next/link";
import { useMemo, useState } from "react";

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** One public page, as listed on Explore and on a tag's page. */
export function PageCard({ page }: { page: ExploreItem }) {
  return (
    <Link
      href={`/p/${page.slug ?? page.id}`}
      className="group flex flex-col rounded-xl border border-border-default bg-bg-elevated p-5 hover:border-accent"
    >
      <span className="line-clamp-2 font-semibold leading-snug group-hover:underline group-hover:underline-offset-4">
        {page.title ?? "Untitled"}
      </span>
      <span className="mt-1.5 truncate font-mono text-xs text-text-muted">/p/{page.slug ?? page.id}</span>
      {page.tags?.length ? (
        <span className="mt-3 flex flex-wrap gap-1.5">
          {page.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded bg-bg-soft px-1.5 py-0.5 text-xs text-text-secondary">
              {tag}
            </span>
          ))}
        </span>
      ) : null}
      <span className="mt-auto flex items-center justify-between pt-4 text-xs text-text-muted">
        <span suppressHydrationWarning>{timeAgo(page.created_at)}</span>
        <span className="tabular-nums">{page.view_count === 1 ? "1 view" : `${page.view_count.toLocaleString()} views`}</span>
      </span>
    </Link>
  );
}

/** `pages` arrives newest first (see getRecentPublicPages). */
export function ExploreClient({ pages }: { pages: ExploreItem[] }) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const tags = useMemo(() => {
    const count = new Map<string, number>();
    for (const page of pages) for (const tag of page.tags ?? []) count.set(tag, (count.get(tag) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([tag]) => tag);
  }, [pages]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pages.filter(
      (p) =>
        (!activeTag || p.tags?.includes(activeTag)) &&
        (!q || [p.title ?? "", p.slug ?? "", ...(p.tags ?? [])].some((text) => text.toLowerCase().includes(q))),
    );
  }, [query, activeTag, pages]);

  if (pages.length === 0) {
    return (
      <p className="max-w-xl rounded-xl border border-dashed border-border-strong px-6 py-12 text-center text-text-secondary">
        No public pages yet. A page appears here when its author sets it to Public.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="explore-filter">
          Filter pages
        </label>
        <input
          id="explore-filter"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter pages"
          className="h-10 w-full max-w-xs rounded-lg border border-border-strong bg-bg-elevated px-3 text-sm placeholder:text-text-muted"
        />
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-pressed={activeTag === tag}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            className={
              activeTag === tag
                ? "rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-contrast"
                : "rounded-lg border border-border-strong bg-bg-elevated px-3 py-1.5 text-sm text-text-secondary hover:border-accent"
            }
          >
            {tag}
          </button>
        ))}
        {tags.length ? (
          <Link href="/tags" className="text-sm text-text-secondary underline underline-offset-4 hover:text-text-primary">
            All tags
          </Link>
        ) : null}
      </div>

      <p aria-live="polite" className="mt-4 text-sm text-text-muted">
        {shown.length} {shown.length === 1 ? "page" : "pages"}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((page) => (
          <PageCard key={page.id} page={page} />
        ))}
      </div>
    </div>
  );
}
