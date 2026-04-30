"use client";

import { Icon } from "@/components/ui/Icon";
import { useCallback, useRef, useState } from "react";

// Mirrors server-side validation.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$|^[a-z0-9]{1,60}$/;
function isValidSlug(s: string) { return SLUG_RE.test(s) && !s.includes("--"); }

type PageRow = {
  id: string;
  slug: string | null;
  title: string | null;
  visibility: "public" | "unlisted";
  view_count: number;
  created_at: string;
  updated_at: string;
  baseUrl: string;
};

function pageUrl(page: PageRow) {
  const path = page.slug ? `/p/${page.slug}` : `/p/${page.id}`;
  return `${page.baseUrl}${path}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Slug editor
// ---------------------------------------------------------------------------

function SlugEditor({
  pageId,
  slug,
  baseUrl,
  onSlugSaved,
}: {
  pageId: string;
  slug: string | null;
  baseUrl: string;
  onSlugSaved: (next: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hostLabel = baseUrl.replace(/^https?:\/\//, "");

  const beginEdit = () => {
    setDraft(slug ?? "");
    setError(null);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancel = () => {
    setEditing(false);
    setError(null);
  };

  const save = async () => {
    const value = draft.trim().toLowerCase() || null;
    if (value === slug) { cancel(); return; }

    if (value !== null && !isValidSlug(value)) {
      setError("1-60 chars, lowercase letters/numbers/hyphens only.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/pages/${pageId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to save slug");
      }
      onSlugSaved(value);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5 mt-1">
        {slug ? (
          <span className="flex items-center gap-1 text-xs text-text-muted">
            <span className="text-text-muted/60">{hostLabel}/p/</span>
            <span className="font-medium text-accent">{slug}</span>
          </span>
        ) : (
          <span className="text-xs text-text-muted/50 italic">No custom slug</span>
        )}
        <button
          type="button"
          onClick={beginEdit}
          title={slug ? "Edit slug" : "Add custom slug"}
          className="flex items-center justify-center h-5 w-5 rounded text-text-muted/50 transition hover:text-text-muted hover:bg-fill-2"
        >
          <Icon name="pencil" size={10} />
        </button>
        {slug && (
          <button
            type="button"
            onClick={async () => {
              setSaving(true);
              try {
                const res = await fetch(`/api/pages/${pageId}`, {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ slug: null }),
                });
                if (res.ok) onSlugSaved(null);
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            title="Remove slug"
            className="flex items-center justify-center h-5 w-5 rounded text-text-muted/40 transition hover:text-red-400 hover:bg-red-400/8 disabled:opacity-40"
          >
            <Icon name="close" size={9} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-1.5 flex flex-col gap-1">
      <div className="flex items-center gap-0">
        <span className="text-xs text-text-muted/60 px-2 py-1 bg-bg-soft border border-r-0 border-outline rounded-l-md whitespace-nowrap">
          {hostLabel}/p/
        </span>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setError(null); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); void save(); }
            if (e.key === "Escape") { e.preventDefault(); cancel(); }
          }}
          placeholder="my-custom-slug"
          className="min-w-0 w-40 px-2 py-1 text-xs bg-bg border border-outline rounded-r-md text-text-primary placeholder:text-text-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft"
          aria-label="Custom slug"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="ml-1.5 flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-white bg-accent hover:bg-accent-hover transition disabled:opacity-50"
        >
          {saving ? (
            <svg width="11" height="11" viewBox="0 0 13 13" fill="none" className="animate-spin" aria-hidden>
              <path d="M6.5 1a5.5 5.5 0 1 0 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          ) : "Save"}
        </button>
        <button
          type="button"
          onClick={cancel}
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition hover:bg-fill-2 hover:text-text-primary"
        >
          <Icon name="close" size={11} />
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page card
// ---------------------------------------------------------------------------

function PageCard({
  page,
  onDeleted,
  onSlugSaved,
  onVisibilityChanged,
}: {
  page: PageRow;
  onDeleted: (id: string) => void;
  onSlugSaved: (id: string, slug: string | null) => void;
  onVisibilityChanged: (id: string, v: "public" | "unlisted") => void;
}) {
  const [copying, setCopying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  const url = pageUrl(page);

  const handleToggleVisibility = useCallback(async () => {
    const next = page.visibility === "public" ? "unlisted" : "public";
    setTogglingVisibility(true);
    try {
      const res = await fetch(`/api/pages/${page.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visibility: next }),
      });
      if (res.ok) onVisibilityChanged(page.id, next);
    } finally {
      setTogglingVisibility(false);
    }
  }, [page.id, page.visibility, onVisibilityChanged]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopying(true);
      setTimeout(() => setCopying(false), 1400);
    } catch {
      // ignore
    }
  }, [url]);

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
    <div className="group flex flex-col gap-2 rounded-xl border border-outline bg-bg-elevated px-4 py-3.5 transition hover:border-accent-soft/40">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        {/* ── Info ── */}
        <div className="min-w-0 flex-1">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-sm font-medium text-text-primary hover:text-accent transition"
          >
            {page.title ?? <span className="text-text-muted italic">Untitled</span>}
          </a>
          <div className="text-xs text-text-muted/60 truncate mt-0.5">{url.replace(/^https?:\/\//, "")}</div>
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
            {page.visibility === "unlisted" && (
              <>
                <span className="h-3 w-px bg-outline" aria-hidden />
                <span className="text-amber-400/80">Unlisted</span>
              </>
            )}
          </div>

          <SlugEditor
            pageId={page.id}
            slug={page.slug}
            baseUrl={page.baseUrl}
            onSlugSaved={(next) => onSlugSaved(page.id, next)}
          />
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center gap-1.5 shrink-0 self-start">
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
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open page"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:text-text-primary hover:bg-fill-2"
          >
            <Icon name="external" size={14} />
          </a>

          <button
            type="button"
            onClick={() => void handleToggleVisibility()}
            disabled={togglingVisibility}
            aria-label={page.visibility === "public" ? "Make unlisted" : "Make public"}
            title={page.visibility === "public" ? "Make unlisted" : "Make public"}
            className={[
              "flex h-8 w-8 items-center justify-center rounded-lg transition disabled:opacity-40",
              page.visibility === "unlisted"
                ? "text-amber-400 bg-amber-400/8 hover:bg-amber-400/15"
                : "text-text-muted hover:text-text-primary hover:bg-fill-2 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100",
            ].join(" ")}
          >
            <Icon name={page.visibility === "public" ? "eye" : "eye-off"} size={14} />
          </button>

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
    </div>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export function MyPagesList({
  initialPages,
  baseUrl,
}: {
  initialPages: Array<{ id: string; slug: string | null; title: string | null; visibility: "public" | "unlisted"; view_count: number; created_at: string; updated_at: string }>;
  baseUrl: string;
}) {
  const [pages, setPages] = useState<PageRow[]>(() =>
    initialPages.map((p) => ({ ...p, baseUrl }))
  );

  const handleDeleted = useCallback((id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleSlugSaved = useCallback((id: string, slug: string | null) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, slug } : p)));
  }, []);

  const handleVisibilityChanged = useCallback((id: string, visibility: "public" | "unlisted") => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, visibility } : p)));
  }, []);

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-start justify-center py-20 gap-3">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden className="text-text-muted/40">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <polyline points="10 9 9 9 8 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <p className="text-sm font-medium text-text-primary">No pages yet.</p>
        <div className="flex items-center gap-3 text-sm">
          <a href="/app" className="text-accent hover:underline">Publish your first →</a>
          <span className="text-text-muted/40">·</span>
          <a href="/#examples" className="text-text-muted hover:text-text-primary hover:underline">See example pages</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {pages.map((page) => (
        <PageCard
          key={page.id}
          page={page}
          onDeleted={handleDeleted}
          onSlugSaved={handleSlugSaved}
          onVisibilityChanged={handleVisibilityChanged}
        />
      ))}
    </div>
  );
}
