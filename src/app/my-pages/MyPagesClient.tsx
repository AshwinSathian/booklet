"use client";

import { Icon } from "@/components/ui/Icon";
import { ROUTES } from "@/lib/constants";
import { useCallback, useEffect, useRef, useState } from "react";

// Mirrors server-side validation.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$|^[a-z0-9]{1,60}$/;
function isValidSlug(s: string) { return SLUG_RE.test(s) && !s.includes("--"); }

type PageRow = {
  id: string;
  slug: string | null;
  title: string | null;
  visibility: "public" | "unlisted";
  collection_id: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  baseUrl: string;
};

type CollectionRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type CollectionFilter = "all" | "uncollected" | string;

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

type SlugAvailability = "idle" | "checking" | "available" | "taken";

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
  const [availability, setAvailability] = useState<SlugAvailability>("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const hostLabel = baseUrl.replace(/^https?:\/\//, "");

  // Debounced availability check while editing
  useEffect(() => {
    if (!editing) return;
    const value = draft.trim().toLowerCase();

    // No check needed if empty, unchanged, or invalid format
    if (!value || value === slug || !isValidSlug(value)) {
      setAvailability("idle");
      return;
    }

    setAvailability("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/pages/check-slug?slug=${encodeURIComponent(value)}&exclude=${pageId}`,
        );
        const data = (await res.json()) as { available: boolean };
        setAvailability(data.available ? "available" : "taken");
      } catch {
        setAvailability("idle");
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [draft, editing, slug, pageId]);

  const beginEdit = () => {
    setDraft(slug ?? "");
    setError(null);
    setAvailability("idle");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancel = () => {
    setEditing(false);
    setError(null);
    setAvailability("idle");
  };

  const save = async () => {
    const value = draft.trim().toLowerCase() || null;
    if (value === slug) { cancel(); return; }

    if (value !== null && !isValidSlug(value)) {
      setError("Use 1–60 lowercase letters, digits, or hyphens.");
      return;
    }

    if (availability === "taken") {
      setError("That slug is already taken.");
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
      setAvailability("idle");
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
          className={[
            "min-w-0 w-40 px-2 py-1 text-xs bg-bg border rounded-r-md text-text-primary placeholder:text-text-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft",
            availability === "taken" ? "border-red-400/60" : "border-outline",
          ].join(" ")}
          aria-label="Custom slug"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || availability === "taken" || availability === "checking"}
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
      {/* Availability indicator — shown only when actively checking / has a result */}
      {!error && availability === "checking" && (
        <p className="text-xs text-text-muted">Checking…</p>
      )}
      {!error && availability === "available" && (
        <p className="text-xs text-green-400">✓ Available</p>
      )}
      {!error && availability === "taken" && (
        <p className="text-xs text-red-400">✗ Already taken</p>
      )}
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
  onDragStart,
  onDragEnd,
}: {
  page: PageRow;
  onDeleted: (id: string) => void;
  onSlugSaved: (id: string, slug: string | null) => void;
  onVisibilityChanged: (id: string, v: "public" | "unlisted") => void;
  onDragStart: (pageId: string) => void;
  onDragEnd: () => void;
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
    <div
      className="group flex flex-col gap-2 rounded-xl border border-outline bg-bg-elevated px-4 py-3.5 transition hover:border-accent-soft/40"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", page.id);
        onDragStart(page.id);
      }}
      onDragEnd={onDragEnd}
    >
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

          <a
            href={`/my-pages/analytics/${page.id}`}
            title="View analytics"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:text-text-primary hover:bg-fill-2"
          >
            <Icon name="chart" size={14} />
          </a>

          <a
            href={`/my-pages/versions/${page.id}`}
            title="Version history"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:text-text-primary hover:bg-fill-2"
          >
            <Icon name="history" size={14} />
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

function CollectionSidebar({
  collections,
  pages,
  selected,
  newCollectionName,
  creatingCollection,
  draggingPageId,
  onSelected,
  onNewCollectionName,
  onCreateCollection,
  onDeleteCollection,
  onDropPage,
}: {
  collections: CollectionRow[];
  pages: PageRow[];
  selected: CollectionFilter;
  newCollectionName: string;
  creatingCollection: boolean;
  draggingPageId: string | null;
  onSelected: (next: CollectionFilter) => void;
  onNewCollectionName: (next: string) => void;
  onCreateCollection: () => void;
  onDeleteCollection: (collectionId: string) => void;
  onDropPage: (collectionId: string | null) => void;
}) {
  const pageCount = (collectionId: CollectionFilter) => {
    if (collectionId === "all") return pages.length;
    if (collectionId === "uncollected") return pages.filter((p) => p.collection_id === null).length;
    return pages.filter((p) => p.collection_id === collectionId).length;
  };

  const DropButton = ({
    id,
    label,
    count,
    canDelete,
  }: {
    id: CollectionFilter;
    label: string;
    count: number;
    canDelete?: boolean;
  }) => (
    <div
      className="group flex items-center gap-1"
      onDragOver={(e) => {
        if (draggingPageId) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (id === "all") return;
        onDropPage(id === "uncollected" ? null : id);
      }}
    >
      <button
        type="button"
        onClick={() => onSelected(id)}
        className={[
          "flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition",
          selected === id
            ? "bg-accent-dim text-accent"
            : "text-text-secondary hover:bg-fill-2 hover:text-text-primary",
        ].join(" ")}
      >
        <span className="truncate">{label}</span>
        <span className="shrink-0 rounded-full bg-fill-2 px-1.5 py-0.5 text-2xs text-text-muted">
          {count}
        </span>
      </button>
      {canDelete ? (
        <button
          type="button"
          onClick={() => onDeleteCollection(id)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-text-muted opacity-0 transition hover:bg-red-400/10 hover:text-red-400 group-hover:opacity-100 focus-visible:opacity-100"
          aria-label={`Delete ${label}`}
          title={`Delete ${label}`}
        >
          <Icon name="trash" size={12} />
        </button>
      ) : null}
    </div>
  );

  return (
    <aside className="rounded-xl border border-outline bg-bg-elevated p-3 lg:sticky lg:top-16 lg:self-start">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
        Collections
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        <DropButton id="all" label="All pages" count={pageCount("all")} />
        <DropButton id="uncollected" label="Uncollected" count={pageCount("uncollected")} />
        {collections.map((collection) => (
          <DropButton
            key={collection.id}
            id={collection.id}
            label={collection.name}
            count={pageCount(collection.id)}
            canDelete
          />
        ))}
      </div>

      <div className="mt-3 flex gap-1.5">
        <input
          value={newCollectionName}
          onChange={(e) => onNewCollectionName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCreateCollection();
            }
          }}
          placeholder="New collection"
          className="min-w-0 flex-1 rounded-lg border border-outline bg-bg px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft"
        />
        <button
          type="button"
          onClick={onCreateCollection}
          disabled={creatingCollection || !newCollectionName.trim()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition hover:bg-accent-hover disabled:opacity-40"
          aria-label="Create collection"
          title="Create collection"
        >
          <Icon name={creatingCollection ? "spinner" : "plus"} size={13} className={creatingCollection ? "animate-spin" : undefined} />
        </button>
      </div>
    </aside>
  );
}

export function MyPagesList({
  initialPages,
  initialCollections,
  baseUrl,
}: {
  initialPages: Array<{ id: string; slug: string | null; title: string | null; visibility: "public" | "unlisted"; collection_id: string | null; view_count: number; created_at: string; updated_at: string }>;
  initialCollections: CollectionRow[];
  baseUrl: string;
}) {
  const [pages, setPages] = useState<PageRow[]>(() =>
    initialPages.map((p) => ({ ...p, baseUrl }))
  );
  const [collections, setCollections] = useState<CollectionRow[]>(initialCollections);
  const [selectedCollection, setSelectedCollection] = useState<CollectionFilter>("all");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [draggingPageId, setDraggingPageId] = useState<string | null>(null);

  const handleDeleted = useCallback((id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleSlugSaved = useCallback((id: string, slug: string | null) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, slug } : p)));
  }, []);

  const handleVisibilityChanged = useCallback((id: string, visibility: "public" | "unlisted") => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, visibility } : p)));
  }, []);

  const handleCreateCollection = useCallback(async () => {
    const name = newCollectionName.trim();
    if (!name) return;

    setCreatingCollection(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { collection: CollectionRow };
      setCollections((prev) => [...prev, body.collection].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedCollection(body.collection.id);
      setNewCollectionName("");
    } finally {
      setCreatingCollection(false);
    }
  }, [newCollectionName]);

  const handleDeleteCollection = useCallback(async (collectionId: string) => {
    const res = await fetch(`/api/collections/${collectionId}`, { method: "DELETE" });
    if (!res.ok) return;
    setCollections((prev) => prev.filter((c) => c.id !== collectionId));
    setPages((prev) => prev.map((p) => (p.collection_id === collectionId ? { ...p, collection_id: null } : p)));
    setSelectedCollection((prev) => (prev === collectionId ? "all" : prev));
  }, []);

  const assignPageToCollection = useCallback(async (pageId: string, collectionId: string | null) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page || page.collection_id === collectionId) return;

    const previousCollectionId = page.collection_id;
    setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, collection_id: collectionId } : p)));

    try {
      if (collectionId) {
        const res = await fetch(`/api/collections/${collectionId}/pages`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pageId }),
        });
        if (!res.ok) throw new Error();
      } else if (previousCollectionId) {
        const res = await fetch(`/api/collections/${previousCollectionId}/pages`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pageId }),
        });
        if (!res.ok) throw new Error();
      }
    } catch {
      setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, collection_id: previousCollectionId } : p)));
    }
  }, [pages]);

  const filteredPages = pages.filter((page) => {
    if (selectedCollection === "all") return true;
    if (selectedCollection === "uncollected") return page.collection_id === null;
    return page.collection_id === selectedCollection;
  });

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
          <a href={ROUTES.app} className="text-accent hover:underline">Publish your first →</a>
          <span className="text-text-muted/40">·</span>
          <a href="/#examples" className="text-text-muted hover:text-text-primary hover:underline">See example pages</a>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <CollectionSidebar
        collections={collections}
        pages={pages}
        selected={selectedCollection}
        newCollectionName={newCollectionName}
        creatingCollection={creatingCollection}
        draggingPageId={draggingPageId}
        onSelected={setSelectedCollection}
        onNewCollectionName={setNewCollectionName}
        onCreateCollection={handleCreateCollection}
        onDeleteCollection={handleDeleteCollection}
        onDropPage={(collectionId) => {
          if (draggingPageId) void assignPageToCollection(draggingPageId, collectionId);
          setDraggingPageId(null);
        }}
      />

      <div className="flex flex-col gap-2">
        {filteredPages.length > 0 ? (
          filteredPages.map((page) => (
            <PageCard
              key={page.id}
              page={page}
              onDeleted={handleDeleted}
              onSlugSaved={handleSlugSaved}
              onVisibilityChanged={handleVisibilityChanged}
              onDragStart={setDraggingPageId}
              onDragEnd={() => setDraggingPageId(null)}
            />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-outline px-4 py-10 text-sm text-text-muted">
            No pages in this collection.
          </div>
        )}
      </div>
    </div>
  );
}
