"use client";

import { Icon } from "@/components/ui/Icon";
import { useCallback, useState } from "react";

type PageRow = {
  id: string;
  url: string;
  view_count: number;
  created_at: string;
  updated_at: string;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function PageCard({ page, onDeleted }: { page: PageRow; onDeleted: (id: string) => void }) {
  const [copying, setCopying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(page.url);
      setCopying(true);
      setTimeout(() => setCopying(false), 1400);
    } catch {
      // ignore
    }
  }, [page.url]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/pages/${page.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDeleted(page.id);
    } catch {
      setDeleting(false);
      setConfirming(false);
    }
  }, [page.id, onDeleted]);

  return (
    <div className="group flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-outline bg-bg-elevated px-4 py-3.5 transition hover:border-accent-soft/40">
      {/* ── Info ── */}
      <div className="min-w-0 flex-1">
        <a
          href={page.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-sm font-medium text-text-primary hover:text-accent transition"
        >
          {page.url.replace(/^https?:\/\//, "")}
        </a>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
          <span>{page.view_count === 1 ? "1 view" : `${page.view_count} views`}</span>
          <span className="h-3 w-px bg-outline" aria-hidden />
          <span>Published {formatDate(page.created_at)}</span>
          {page.updated_at !== page.created_at && (
            <>
              <span className="h-3 w-px bg-outline" aria-hidden />
              <span>Updated {formatDate(page.updated_at)}</span>
            </>
          )}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => void handleCopy()}
          title="Copy share link"
          className={[
            "flex h-8 w-8 items-center justify-center rounded-lg transition",
            copying
              ? "text-accent bg-accent-dim"
              : "text-text-muted hover:text-text-primary hover:bg-fill-2",
          ].join(" ")}
        >
          <Icon name={copying ? "check" : "copy"} size={14} />
        </button>

        <a
          href={page.url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open page"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:text-text-primary hover:bg-fill-2"
        >
          <Icon name="external" size={14} />
        </a>

        {confirming ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-400 border border-red-400/30 hover:bg-red-400/10 transition disabled:opacity-50"
            >
              {deleting ? (
                <svg width="12" height="12" viewBox="0 0 13 13" fill="none" className="animate-spin" aria-hidden>
                  <path d="M6.5 1a5.5 5.5 0 1 0 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ) : null}
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-fill-2 hover:text-text-primary"
            >
              <Icon name="close" size={13} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            title="Delete page"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:text-red-400 hover:bg-red-400/8 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Icon name="trash" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export function MyPagesList({ initialPages, baseUrl }: { initialPages: Array<{ id: string; view_count: number; created_at: string; updated_at: string }>; baseUrl: string }) {
  const [pages, setPages] = useState(() =>
    initialPages.map((p) => ({ ...p, url: `${baseUrl}/p/${p.id}` }))
  );

  const handleDeleted = useCallback((id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
  }, []);

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <div className="text-3xl">📄</div>
        <p className="text-sm text-text-secondary">No pages yet. Go publish something!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {pages.map((page) => (
        <PageCard key={page.id} page={page} onDeleted={handleDeleted} />
      ))}
    </div>
  );
}
