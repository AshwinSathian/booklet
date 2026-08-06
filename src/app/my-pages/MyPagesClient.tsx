"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ROUTES } from "@/lib/constants";
import { createDraft, setActiveDraftId } from "@/lib/drafts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CollectionTree } from "./CollectionTree";
import { Breadcrumb } from "./Breadcrumb";
import { FolderRow } from "./FolderRow";
import { canNestInto, getChildren } from "@/lib/collections-tree";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, Menu, type ContextMenuPosition } from "@/components/ui/ContextMenu";
import { useToast } from "@/components/ui/ToastProvider";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$|^[a-z0-9]{3,60}$/;
function isValidSlug(s: string) { return SLUG_RE.test(s) && !s.includes("--"); }

export type PageRow = {
  id: string;
  slug: string | null;
  title: string | null;
  visibility: "public" | "unlisted";
  collection_id: string | null;
  view_count: number;
  has_password: boolean;
  featured: boolean;
  remove_attribution_badge: boolean;
  created_at: string;
  updated_at: string;
  baseUrl: string;
};

export type CollectionRow = {
  id: string;
  name: string;
  is_team_space: boolean;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CollectionFilter = "all" | "uncollected" | string;
type SortKey = "newest" | "oldest" | "views" | "alpha";

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

  useEffect(() => {
    if (!editing) return;
    const value = draft.trim().toLowerCase();
    if (!value || value === slug || !isValidSlug(value)) {
      setAvailability("idle");
      return;
    }
    setAvailability("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pages/check-slug?slug=${encodeURIComponent(value)}&exclude=${pageId}`);
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
      setError("Use 3–60 lowercase letters, digits, or hyphens.");
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
      <div className="flex items-center gap-1.5 mt-1.5">
        {slug ? (
          <span className="flex items-center gap-1 text-xs text-text-muted">
            <span className="text-text-muted/50">{hostLabel}/p/</span>
            <span className="font-medium text-accent">{slug}</span>
          </span>
        ) : (
          <span className="text-xs text-text-muted/40 italic">No custom URL</span>
        )}
        <button
          type="button"
          onClick={beginEdit}
          title={slug ? "Edit URL" : "Add custom URL"}
          className="flex items-center justify-center h-5 w-5 rounded text-text-muted/40 transition hover:text-text-muted hover:bg-fill-2"
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
            title="Remove custom URL"
            className="flex items-center justify-center h-5 w-5 rounded text-text-muted/40 transition hover:text-red-400 hover:bg-red-400/8 disabled:opacity-40"
          >
            <Icon name="close" size={9} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-1">
      <div className="flex items-center gap-0">
        <span className="text-xs text-text-muted/60 px-2 py-1 bg-bg-soft border border-r-0 border-border-default rounded-l-md whitespace-nowrap hidden sm:inline">
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
            "min-w-0 w-44 px-2 py-1 text-xs bg-bg border rounded-md sm:rounded-l-none sm:rounded-r-md text-text-primary placeholder:text-text-muted/40",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft",
            availability === "taken" ? "border-red-400/60" : "border-border-default",
          ].join(" ")}
          aria-label="Custom URL slug"
        />
        <Button
          variant="primary"
          size="sm"
          onClick={() => void save()}
          disabled={saving || availability === "taken" || availability === "checking"}
          className="ml-1.5"
        >
          {saving ? (
            <svg width="11" height="11" viewBox="0 0 13 13" fill="none" className="animate-spin" aria-hidden>
              <path d="M6.5 1a5.5 5.5 0 1 0 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          ) : "Save"}
        </Button>
        <Button variant="ghost" size="sm" iconOnly onClick={cancel} aria-label="Cancel" className="ml-1">
          <Icon name="close" size={11} />
        </Button>
      </div>
      {!error && availability === "checking" && <p className="text-xs text-text-muted">Checking…</p>}
      {!error && availability === "available" && <p className="text-xs text-green-400">✓ Available</p>}
      {!error && availability === "taken" && <p className="text-xs text-red-400">✗ Already taken</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page card
// ---------------------------------------------------------------------------

function PageCard({
  page,
  index,
  selected,
  onSelectClick,
  onContextMenu,
  onDeleted,
  onSlugSaved,
  onVisibilityChanged,
  onDragStart,
  onDragEnd,
}: {
  page: PageRow;
  index: number;
  selected: boolean;
  onSelectClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDeleted: (id: string) => void;
  onSlugSaved: (id: string, slug: string | null) => void;
  onVisibilityChanged: (id: string, v: "public" | "unlisted") => void;
  onDragStart: (pageId: string) => string[];
  onDragEnd: () => void;
}) {
  const router = useRouter();
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [copying, setCopying] = useState(false);
  const [copyingEmbed, setCopyingEmbed] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [hasPassword, setHasPassword] = useState(page.has_password);
  const [passwordPrompt, setPasswordPrompt] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [featured, setFeatured] = useState(page.featured);
  const [togglingFeatured, setTogglingFeatured] = useState(false);

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
    } catch { /* ignore */ }
  }, [url]);

  const handleCopyEmbed = useCallback(async () => {
    const src = `${page.baseUrl}/p/${page.id}/embed`;
    const safeTitle = (page.title ?? "").replace(/"/g, "&quot;");
    const code = `<iframe\n  src="${src}"\n  style="width:100%;min-height:400px;border:none;border-radius:8px;"\n  title="${safeTitle}"\n  loading="lazy"\n></iframe>`;
    try {
      await navigator.clipboard.writeText(code);
      setCopyingEmbed(true);
      setTimeout(() => setCopyingEmbed(false), 1800);
    } catch { /* ignore */ }
  }, [page.baseUrl, page.id, page.title]);

  const handleSetPassword = useCallback(async (pw: string | null) => {
    setSavingPassword(true);
    try {
      const res = await fetch(`/api/pages/${page.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        setHasPassword(pw !== null && pw.length > 0);
        setPasswordPrompt(false);
        setPasswordDraft("");
      }
    } finally {
      setSavingPassword(false);
    }
  }, [page.id]);

  const handleToggleFeatured = useCallback(async () => {
    setTogglingFeatured(true);
    try {
      const res = await fetch(`/api/pages/${page.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ featured: !featured }),
      });
      if (res.ok) setFeatured((f) => !f);
    } finally {
      setTogglingFeatured(false);
    }
  }, [page.id, featured]);

  const handleDuplicate = useCallback(async () => {
    setDuplicating(true);
    try {
      const res = await fetch(`/api/pages/${page.id}`);
      if (!res.ok) return;
      const data = (await res.json()) as { raw?: string | null; title?: string | null };
      const draft = createDraft({
        title: data.title ? `Copy of ${data.title}` : "Copy",
        raw: data.raw ?? "",
      });
      setActiveDraftId(draft.id);
      setMenuOpen(false);
      router.push(ROUTES.app);
    } finally {
      setDuplicating(false);
    }
  }, [page.id, router]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/pages/${page.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setMenuOpen(false);
      onDeleted(page.id);
    } catch {
      setDeleting(false);
      setConfirming(false);
    }
  }, [page.id, onDeleted]);

  return (
    <>
      <div
        className={[
          "group flex flex-col gap-0 rounded-xl border bg-bg-elevated transition hover:shadow-hard cursor-grab active:cursor-grabbing animate-fade-up",
          selected ? "border-accent-soft/50 bg-accent-dim" : "border-border-default hover:border-accent-soft/30",
        ].join(" ")}
        style={{ animationDelay: `${Math.min(index * 40, 300)}ms` }}
        draggable
        onClick={onSelectClick}
        onContextMenu={onContextMenu}
        onDragStart={(e) => {
          const ids = onDragStart(page.id);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", ids[0]);
          if (ids.length > 1) e.dataTransfer.setData("application/x-booklet-pages", JSON.stringify(ids));
        }}
        onDragEnd={onDragEnd}
      >
        <div className="flex items-start gap-3 px-4 pt-4 pb-3">
          {/* ── Info ── */}
          <div className="min-w-0 flex-1">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm font-semibold text-text-primary hover:text-accent transition truncate"
            >
              {page.title ?? <span className="text-text-muted font-normal italic">Untitled</span>}
            </a>

            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-text-muted">
              <span>{page.view_count === 1 ? "1 view" : `${page.view_count} views`}</span>
              <span className="opacity-30" aria-hidden>·</span>
              <span>{formatDate(page.created_at)}</span>
              {page.updated_at !== page.created_at && (
                <>
                  <span className="opacity-30" aria-hidden>·</span>
                  <span>Updated {formatDate(page.updated_at)}</span>
                </>
              )}
              {page.visibility === "unlisted" && (
                <>
                  <span className="opacity-30" aria-hidden>·</span>
                  <span className="text-amber-400/80 font-medium">Unlisted</span>
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
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant={copying ? "primary" : "secondary"}
              size="md"
              onClick={() => void handleCopy()}
              title="Copy link"
              aria-label="Copy share link"
              className={copying ? "bg-accent-dim text-accent border-accent/40 hover:bg-accent-dim hover:border-accent/40 hover:text-accent shadow-none" : ""}
            >
              <Icon name={copying ? "check" : "copy"} size={13} />
              <span className="hidden sm:inline">{copying ? "Copied" : "Copy"}</span>
            </Button>

            <Button
              ref={menuTriggerRef}
              variant="ghost"
              size="md"
              iconOnly
              onClick={() => { setConfirming(false); setMenuOpen((v) => !v); }}
              title="Page actions"
              aria-label="More actions"
            >
              <Icon name="dots" size={15} />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Page actions menu ── */}
      <Menu
        open={menuOpen}
        anchorRef={menuTriggerRef}
        align="end"
        widthClass="w-80"
        onClose={() => { setMenuOpen(false); setConfirming(false); setPasswordPrompt(false); setPasswordDraft(""); }}
      >
        <ContextMenuItem
          icon="external"
          label="Open page"
          description="View the published page"
          href={url}
          onSelect={() => setMenuOpen(false)}
        />
        <ContextMenuItem
          icon="chart"
          label="Analytics"
          description="Views, scroll depth, referrers"
          href={`/my-pages/analytics/${page.id}`}
          onSelect={() => setMenuOpen(false)}
        />
        <ContextMenuItem
          icon="history"
          label="Version history"
          description="Browse and restore previous versions"
          href={`/my-pages/versions/${page.id}`}
          onSelect={() => setMenuOpen(false)}
        />
        <ContextMenuItem
          icon="code"
          label={copyingEmbed ? "Copied!" : "Copy embed code"}
          description="Get an <iframe> snippet to embed this page"
          onSelect={() => void handleCopyEmbed()}
          active={copyingEmbed}
        />
        <ContextMenuItem
          icon="duplicate"
          label={duplicating ? "Opening editor…" : "Duplicate in editor"}
          description="Copy this page's content into a new draft"
          disabled={duplicating}
          onSelect={() => void handleDuplicate()}
        />

        <ContextMenuSeparator />

        <ContextMenuItem
          icon={page.visibility === "public" ? "eye" : "eye-off"}
          label={page.visibility === "public" ? "Make unlisted" : "Make public"}
          description={
            page.visibility === "public"
              ? "Hide from search engines and explore"
              : "Allow indexing and discovery"
          }
          active={page.visibility === "unlisted"}
          activeLabel="Unlisted"
          disabled={togglingVisibility}
          onSelect={async () => {
            await handleToggleVisibility();
            setMenuOpen(false);
          }}
        />
        {hasPassword ? (
          <ContextMenuItem
            icon="lock"
            label="Remove password"
            description="Page is currently password-protected"
            active
            activeLabel="Protected"
            disabled={savingPassword}
            onSelect={() => void handleSetPassword(null)}
          />
        ) : passwordPrompt ? (
          <div className="px-3 py-2 flex flex-col gap-2">
            <input
              type="password"
              value={passwordDraft}
              onChange={(e) => setPasswordDraft(e.target.value)}
              placeholder="Set a password (min. 6 chars)"
              autoFocus
              className="w-full rounded-lg border border-border-default bg-bg px-3 py-2 text-sm outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15 transition"
            />
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                disabled={passwordDraft.length < 6 || savingPassword}
                onClick={() => void handleSetPassword(passwordDraft)}
              >
                Save
              </Button>
              <Button variant="secondary" size="sm" onClick={() => { setPasswordPrompt(false); setPasswordDraft(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <ContextMenuItem
            icon="lock"
            label="Password protect"
            description="Require a password to view this page"
            onSelect={() => setPasswordPrompt(true)}
          />
        )}
        <ContextMenuItem
          icon={featured ? "star-filled" : "star"}
          label={featured ? "Remove from Explore" : "Feature on Explore"}
          description={featured ? "Page is shown on the public Explore page" : "Show this page on the public Explore page"}
          active={featured}
          activeLabel="Featured"
          disabled={togglingFeatured}
          onSelect={() => void handleToggleFeatured()}
        />

        <ContextMenuSeparator />

        {confirming ? (
          <div className="flex items-center gap-3 px-3 py-2">
            <span className="flex-1 text-sm text-text-secondary">Delete permanently?</span>
            <Button variant="danger" size="sm" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? (
                <svg width="11" height="11" viewBox="0 0 13 13" fill="none" className="animate-spin" aria-hidden>
                  <path d="M6.5 1a5.5 5.5 0 1 0 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ) : null}
              Delete
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <ContextMenuItem
            icon="trash"
            label="Delete page"
            description="Permanently remove this page and its URL"
            danger
            onSelect={() => setConfirming(true)}
          />
        )}
      </Menu>
    </>
  );
}

// ---------------------------------------------------------------------------
// Search + Sort bar
// ---------------------------------------------------------------------------

function SearchSortBar({
  query,
  sort,
  count,
  total,
  onQuery,
  onSort,
}: {
  query: string;
  sort: SortKey;
  count: number;
  total: number;
  onQuery: (q: string) => void;
  onSort: (s: SortKey) => void;
}) {
  const SORTS: { key: SortKey; label: string }[] = [
    { key: "newest", label: "Newest" },
    { key: "oldest", label: "Oldest" },
    { key: "views", label: "Most viewed" },
    { key: "alpha", label: "A–Z" },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
      <div className="relative flex-1 w-full sm:max-w-xs">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted/50"
          width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden
        >
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search pages…"
          className="w-full rounded-lg border border-border-default bg-bg pl-8 pr-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft"
        />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value as SortKey)}
          className="rounded-lg border border-border-default bg-bg px-2.5 py-1.5 text-sm text-text-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft appearance-none pr-7 bg-no-repeat"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2398989f' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundPosition: "right 8px center" }}
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>

        {(query || count !== total) && (
          <span className="text-xs text-text-muted whitespace-nowrap">
            {count} of {total}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main list
// ---------------------------------------------------------------------------

export function MyPagesList({
  initialPages,
  initialCollections,
  baseUrl,
}: {
  initialPages: Array<{
    id: string;
    slug: string | null;
    title: string | null;
    visibility: "public" | "unlisted";
    collection_id: string | null;
    view_count: number;
    has_password: boolean;
    featured: boolean;
    remove_attribution_badge: boolean;
    created_at: string;
    updated_at: string;
  }>;
  initialCollections: CollectionRow[];
  baseUrl: string;
}) {
  const [pages, setPages] = useState<PageRow[]>(() =>
    initialPages.map((p) => ({ ...p, baseUrl }))
  );
  const [collections, setCollections] = useState<CollectionRow[]>(initialCollections);
  const [selectedCollection, setSelectedCollection] = useState<CollectionFilter>("all");
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [draggingPageIds, setDraggingPageIds] = useState<string[] | null>(null);
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);
  const [bulkDeleteConfirming, setBulkDeleteConfirming] = useState(false);
  const [confirmingDeleteFolderId, setConfirmingDeleteFolderId] = useState<string | null>(null);
  const [folderMenu, setFolderMenu] = useState<{ folderId: string; position: ContextMenuPosition } | null>(null);
  const [pageMenu, setPageMenu] = useState<{ pageId: string; position: ContextMenuPosition } | null>(null);
  const toast = useToast();

  const handleDeleted = useCallback((id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleSlugSaved = useCallback((id: string, slug: string | null) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, slug } : p)));
  }, []);

  const handleVisibilityChanged = useCallback((id: string, visibility: "public" | "unlisted") => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, visibility } : p)));
  }, []);

  const handleCreateCollection = useCallback(async (parentId: string | null, name: string) => {
    setCreatingCollection(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, parent_id: parentId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        toast.error("Couldn't create folder", body.error ?? "Try again.");
        return;
      }
      const body = (await res.json()) as { collection: CollectionRow };
      setCollections((prev) => [...prev, body.collection].sort((a, b) => a.name.localeCompare(b.name)));
      // Deliberately don't switch the filter to the new (necessarily empty)
      // folder — that used to strand the user looking at an empty list,
      // with no prompt to assign anything to it. The new folder just
      // appears in the sidebar while the current page list stays put, so
      // pages the user was already looking at are still visible to drag
      // onto it (the existing drag-and-drop flow, wired via
      // CollectionTree's onDropOnFolder below).
    } finally {
      setCreatingCollection(false);
    }
  }, [toast]);

  const handleDeleteCollection = useCallback(async (collectionId: string) => {
    if (confirmingDeleteFolderId !== collectionId) {
      setConfirmingDeleteFolderId(collectionId);
      const childCount = collections.filter((c) => c.parent_id === collectionId).length;
      const directPageCount = pages.filter((p) => p.collection_id === collectionId).length;
      const nestedPageCount = pages.filter((p) => {
        const owner = collections.find((c) => c.id === p.collection_id);
        return owner?.parent_id === collectionId;
      }).length;
      const totalPages = directPageCount + nestedPageCount;
      const parts: string[] = [];
      if (childCount > 0) parts.push(`${childCount} sub-folder${childCount === 1 ? "" : "s"}`);
      if (totalPages > 0) parts.push(`${totalPages} page${totalPages === 1 ? "" : "s"}`);
      toast.warn(
        "Delete this folder?",
        parts.length > 0
          ? `Contains ${parts.join(" and ")}. Sub-folders will be deleted; pages become Uncollected — pages themselves are never deleted. Click delete again to confirm.`
          : "This folder is empty. Click delete again to confirm.",
      );
      setTimeout(() => setConfirmingDeleteFolderId((prev) => (prev === collectionId ? null : prev)), 4000);
      return;
    }

    setConfirmingDeleteFolderId(null);
    const res = await fetch(`/api/collections/${collectionId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Couldn't delete folder", "Try again in a moment.");
      return;
    }
    const removedIds = new Set([collectionId, ...collections.filter((c) => c.parent_id === collectionId).map((c) => c.id)]);
    setCollections((prev) => prev.filter((c) => !removedIds.has(c.id)));
    setPages((prev) => prev.map((p) => (p.collection_id && removedIds.has(p.collection_id) ? { ...p, collection_id: null } : p)));
    setSelectedCollection((prev) => (removedIds.has(prev) ? "all" : prev));
    toast.success("Folder deleted");
  }, [confirmingDeleteFolderId, collections, pages, toast]);

  const handleRenameCollection = useCallback(async (id: string, name: string) => {
    setRenamingFolderId(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    const current = collections.find((c) => c.id === id);
    if (!current || current.name === trimmed) return;
    const res = await fetch(`/api/collections/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      toast.error("Couldn't rename folder", body.error ?? "Try again.");
      return;
    }
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, name: trimmed } : c)));
  }, [collections, toast]);

  const handleMoveFolder = useCallback(async (id: string, newParentId: string | null) => {
    const current = collections.find((c) => c.id === id);
    if (!current || current.parent_id === newParentId) return;
    const previousParentId = current.parent_id;
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, parent_id: newParentId } : c)));
    const res = await fetch(`/api/collections/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parent_id: newParentId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      toast.error("Couldn't move folder", body.error ?? "Try again.");
      setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, parent_id: previousParentId } : c)));
    }
  }, [collections, toast]);

  const assignPagesToCollection = useCallback(async (pageIds: string[], collectionId: string | null) => {
    for (const pageId of pageIds) {
      const page = pages.find((p) => p.id === pageId);
      if (!page || page.collection_id === collectionId) continue;
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
    }
  }, [pages]);

  const handleBulkDelete = useCallback(async () => {
    const pageIds = [...selectedIds].filter((id) => pages.some((p) => p.id === id));
    const folderIds = [...selectedIds].filter((id) => collections.some((c) => c.id === id));
    await Promise.all([
      ...pageIds.map((id) => fetch(`/api/pages/${id}`, { method: "DELETE" })),
      ...folderIds.map((id) => fetch(`/api/collections/${id}`, { method: "DELETE" })),
    ]);
    setPages((prev) => prev.filter((p) => !pageIds.includes(p.id)));
    setCollections((prev) => prev.filter((c) => !folderIds.includes(c.id)));
    setPages((prev) => prev.map((p) => (p.collection_id && folderIds.includes(p.collection_id) ? { ...p, collection_id: null } : p)));
    setSelectedIds(new Set());
    setBulkDeleteConfirming(false);
  }, [selectedIds, pages, collections]);

  const filteredAndSorted = useMemo(() => {
    let result = pages.filter((page) => {
      const matchesCollection =
        selectedCollection === "all" ||
        (selectedCollection === "uncollected" ? page.collection_id === null : page.collection_id === selectedCollection);
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q || (page.title ?? "").toLowerCase().includes(q) || (page.slug ?? "").toLowerCase().includes(q);
      return matchesCollection && matchesSearch;
    });

    switch (sort) {
      case "oldest":   result = [...result].sort((a, b) => a.created_at.localeCompare(b.created_at)); break;
      case "views":    result = [...result].sort((a, b) => b.view_count - a.view_count); break;
      case "alpha":    result = [...result].sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "")); break;
      default:         result = [...result].sort((a, b) => b.created_at.localeCompare(a.created_at)); break;
    }

    return result;
  }, [pages, selectedCollection, searchQuery, sort]);

  const currentFolderChildren = selectedCollection !== "all" && selectedCollection !== "uncollected"
    ? getChildren(collections, selectedCollection)
    : [];

  const handleSelect = useCallback((id: string, e: React.MouseEvent) => {
    const selectableOrder = [...currentFolderChildren.map((f) => f.id), ...filteredAndSorted.map((p) => p.id)];
    if (e.shiftKey && selectionAnchor) {
      const from = selectableOrder.indexOf(selectionAnchor);
      const to = selectableOrder.indexOf(id);
      if (from !== -1 && to !== -1) {
        const [start, end] = from < to ? [from, to] : [to, from];
        setSelectedIds(new Set(selectableOrder.slice(start, end + 1)));
        return;
      }
    }
    if (e.metaKey || e.ctrlKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
      setSelectionAnchor(id);
      return;
    }
    setSelectedIds(new Set([id]));
    setSelectionAnchor(id);
  }, [selectionAnchor, currentFolderChildren, filteredAndSorted]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape") {
        setSelectedIds(new Set());
        setSelectionAnchor(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.size > 0) {
        e.preventDefault();
        setBulkDeleteConfirming(true);
      }
      if (e.key === "Enter" && selectedIds.size === 1) {
        const [only] = selectedIds;
        if (collections.some((c) => c.id === only)) setRenamingFolderId(only);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, collections]);

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-fill-2 text-text-muted/40">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <p className="text-base font-semibold text-text-primary">No pages yet</p>
          <p className="mt-1 text-sm text-text-secondary">Publish your first page to see it here.</p>
        </div>
        <div className="flex items-center gap-3 text-sm mt-1">
          <Button variant="primary" size="lg" href={ROUTES.app}>
            Open editor
            <svg width="11" height="11" fill="none" viewBox="0 0 12 12" aria-hidden>
              <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <CollectionTree
        collections={collections}
        pages={pages}
        currentFolderId={selectedCollection}
        onNavigate={setSelectedCollection}
        onCreateFolder={(parentId, name) => void handleCreateCollection(parentId, name)}
        creatingFolder={creatingCollection}
        onDeleteFolder={(id) => void handleDeleteCollection(id)}
        draggingPageIds={draggingPageIds}
        draggingFolderId={draggingFolderId}
        onDragFolderStart={setDraggingFolderId}
        onDragFolderEnd={() => setDraggingFolderId(null)}
        onDropOnFolder={(targetId) => {
          if (draggingFolderId) {
            const dragged = collections.find((c) => c.id === draggingFolderId);
            const target = targetId ? collections.find((c) => c.id === targetId) : null;
            if (dragged && (target ? canNestInto(collections, dragged, target) : dragged.parent_id !== null)) {
              void handleMoveFolder(draggingFolderId, targetId);
            }
            setDraggingFolderId(null);
            return;
          }
          if (draggingPageIds) void assignPagesToCollection(draggingPageIds, targetId);
          setDraggingPageIds(null);
        }}
        renamingFolderId={renamingFolderId}
        onCommitRename={(id, name) => void handleRenameCollection(id, name)}
        onCancelRename={() => setRenamingFolderId(null)}
        onFolderContextMenu={(id, position) => setFolderMenu({ folderId: id, position })}
        onSelectFolder={(id) => { setSelectedIds(new Set([id])); setSelectionAnchor(id); }}
      />

      <div className="flex flex-col gap-3">
        {bulkDeleteConfirming ? (
          <div className="flex items-center gap-3 rounded-xl border border-red-400/30 bg-red-400/8 px-4 py-3">
            <span className="flex-1 text-sm text-text-secondary">
              Delete {selectedIds.size} selected item{selectedIds.size === 1 ? "" : "s"}? Pages are deleted permanently; folders only unlink their pages.
            </span>
            <Button variant="danger" size="sm" onClick={() => void handleBulkDelete()}>Delete</Button>
            <Button variant="secondary" size="sm" onClick={() => setBulkDeleteConfirming(false)}>Cancel</Button>
          </div>
        ) : null}

        <Breadcrumb collections={collections} currentFolderId={selectedCollection} onNavigate={setSelectedCollection} />

        <SearchSortBar
          query={searchQuery}
          sort={sort}
          count={filteredAndSorted.length}
          total={pages.filter((page) =>
            selectedCollection === "all" ||
            (selectedCollection === "uncollected" ? page.collection_id === null : page.collection_id === selectedCollection)
          ).length}
          onQuery={setSearchQuery}
          onSort={setSort}
        />

        {selectedCollection !== "all" && selectedCollection !== "uncollected" ? (
          (() => {
            const childFolders = getChildren(collections, selectedCollection).filter((f) =>
              !searchQuery.trim() || f.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
            );
            return childFolders.length > 0 ? (
              <div className="flex flex-col gap-2 mb-1">
                {childFolders.map((folder) => (
                  <FolderRow
                    key={folder.id}
                    folder={folder}
                    itemCount={pages.filter((p) => p.collection_id === folder.id).length}
                    selected={selectedIds.has(folder.id)}
                    onSelectClick={(e) => handleSelect(folder.id, e)}
                    onOpen={() => setSelectedCollection(folder.id)}
                    onDelete={() => void handleDeleteCollection(folder.id)}
                    renaming={renamingFolderId === folder.id}
                    onCommitRename={(name) => void handleRenameCollection(folder.id, name)}
                    onCancelRename={() => setRenamingFolderId(null)}
                    isDropTarget={
                      draggingPageIds !== null ||
                      (draggingFolderId !== null && draggingFolderId !== folder.id &&
                        canNestInto(collections, collections.find((c) => c.id === draggingFolderId)!, folder))
                    }
                    draggable={folder.parent_id === null}
                    onDragStartFolder={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("application/x-booklet-folder", folder.id);
                      setDraggingFolderId(folder.id);
                    }}
                    onDragEndFolder={() => setDraggingFolderId(null)}
                    onDragOver={(e) => { if (draggingPageIds || draggingFolderId) e.preventDefault(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggingFolderId) {
                        const dragged = collections.find((c) => c.id === draggingFolderId);
                        if (dragged && canNestInto(collections, dragged, folder)) void handleMoveFolder(draggingFolderId, folder.id);
                        setDraggingFolderId(null);
                        return;
                      }
                      if (draggingPageIds) void assignPagesToCollection(draggingPageIds, folder.id);
                      setDraggingPageIds(null);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setFolderMenu({ folderId: folder.id, position: { x: e.clientX, y: e.clientY } });
                    }}
                  />
                ))}
              </div>
            ) : null;
          })()
        ) : null}

        {filteredAndSorted.length > 0 ? (
          <div className="flex flex-col gap-2">
            {filteredAndSorted.map((page, i) => (
              <PageCard
                key={page.id}
                page={page}
                index={i}
                selected={selectedIds.has(page.id)}
                onSelectClick={(e) => handleSelect(page.id, e)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setPageMenu({ pageId: page.id, position: { x: e.clientX, y: e.clientY } });
                }}
                onDeleted={handleDeleted}
                onSlugSaved={handleSlugSaved}
                onVisibilityChanged={handleVisibilityChanged}
                onDragStart={(pageId) => {
                  const ids = selectedIds.has(pageId) && selectedIds.size > 1
                    ? [...selectedIds].filter((id) => pages.some((p) => p.id === id))
                    : [pageId];
                  setDraggingPageIds(ids);
                  return ids;
                }}
                onDragEnd={() => setDraggingPageIds(null)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border-subtle px-4 py-12 text-center text-sm text-text-muted">
            {searchQuery ? `No pages match "${searchQuery}"` : "No pages in this collection."}
          </div>
        )}
      </div>
    </div>

    <ContextMenu position={folderMenu?.position ?? null} onClose={() => setFolderMenu(null)}>
      {folderMenu ? (() => {
        const folder = collections.find((c) => c.id === folderMenu.folderId);
        if (!folder) return null;
        const canHaveSubfolder = folder.parent_id === null;
        return (
          <>
            {canHaveSubfolder ? (
              <ContextMenuItem
                icon="plus"
                label="New folder inside"
                onSelect={() => { setFolderMenu(null); void handleCreateCollection(folder.id, "Untitled folder"); }}
              />
            ) : null}
            <ContextMenuItem
              icon="pencil"
              label="Rename"
              onSelect={() => { setFolderMenu(null); setRenamingFolderId(folder.id); }}
            />
            <ContextMenuSeparator />
            <ContextMenuItem
              icon="trash"
              label="Delete"
              danger
              onSelect={() => { setFolderMenu(null); void handleDeleteCollection(folder.id); }}
            />
          </>
        );
      })() : null}
    </ContextMenu>

    <ContextMenu position={pageMenu?.position ?? null} onClose={() => setPageMenu(null)}>
      {pageMenu ? (() => {
        const page = pages.find((p) => p.id === pageMenu.pageId);
        if (!page) return null;
        return (
          <>
            <ContextMenuItem
              icon="external"
              label="Open page"
              onSelect={() => {
                window.open(pageUrl(page), "_blank", "noopener,noreferrer");
                setPageMenu(null);
              }}
            />
            <ContextMenuSeparator />
            <ContextMenuItem
              icon="trash"
              label="Delete"
              danger
              onSelect={() => {
                const id = pageMenu.pageId;
                setPageMenu(null);
                void fetch(`/api/pages/${id}`, { method: "DELETE" }).then((r) => { if (r.ok) handleDeleted(id); });
              }}
            />
          </>
        );
      })() : null}
    </ContextMenu>
    </>
  );
}
