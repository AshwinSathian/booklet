"use client";

import { ActionDrawer, DrawerSection } from "@/components/ui/ActionDrawer";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ROUTES } from "@/lib/constants";
import type { UserPlan } from "@/lib/db/types";
import { canUseFeature } from "@/lib/quota";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$|^[a-z0-9]{3,60}$/;
function isValidSlug(s: string) { return SLUG_RE.test(s) && !s.includes("--"); }

type PageRow = {
  id: string;
  slug: string | null;
  title: string | null;
  visibility: "public" | "unlisted";
  collection_id: string | null;
  view_count: number;
  has_password: boolean;
  created_at: string;
  updated_at: string;
  baseUrl: string;
};

type CollectionRow = {
  id: string;
  name: string;
  is_team_space: boolean;
  created_at: string;
  updated_at: string;
};

type CollectionFilter = "all" | "uncollected" | string;
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
        <span className="text-xs text-text-muted/60 px-2 py-1 bg-bg-soft border border-r-0 border-outline rounded-l-md whitespace-nowrap hidden sm:inline">
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
            availability === "taken" ? "border-red-400/60" : "border-outline",
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
// DrawerItem — reusable row inside ActionDrawer
// ---------------------------------------------------------------------------

function DrawerItem({
  icon,
  label,
  description,
  onClick,
  href,
  danger,
  disabled,
  active,
  activeLabel,
  locked,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  description?: string;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  active?: boolean;
  activeLabel?: string;
  locked?: boolean;
}) {
  const cls = [
    "flex w-full items-center gap-3 px-3 py-3 text-left transition",
    "border-b border-border-subtle last:border-b-0",
    locked
      ? "text-text-muted opacity-60 hover:bg-fill-1"
      : danger
        ? "text-red-400 hover:bg-red-400/8"
        : active
          ? "text-accent bg-accent-dim hover:bg-accent-dim"
          : "text-text-secondary hover:bg-fill-2 hover:text-text-primary",
    disabled ? "opacity-40 pointer-events-none" : "",
  ].join(" ");

  const inner = (
    <>
      <span className={["shrink-0", locked ? "text-text-muted" : danger ? "text-red-400/70" : active ? "text-accent" : "text-text-muted"].join(" ")}>
        <Icon name={icon} size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-tight">{label}</span>
        {description ? <span className="block text-xs text-text-muted mt-0.5">{description}</span> : null}
      </span>
      {locked ? (
        <span className="shrink-0 rounded-pill border border-accent/40 bg-accent/10 px-2 py-0.5 text-2xs font-semibold text-accent">
          Pro
        </span>
      ) : active && activeLabel ? (
        <span className="text-xs font-medium text-accent shrink-0">{activeLabel}</span>
      ) : null}
    </>
  );

  if (href) {
    // Locked items link internally to /pricing; all others open in a new tab.
    if (locked) {
      return (
        <a href={href} className={cls} onClick={onClick}>
          {inner}
        </a>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} onClick={onClick}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      {inner}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page card
// ---------------------------------------------------------------------------

function PageCard({
  page,
  index,
  userPlan,
  onDeleted,
  onSlugSaved,
  onVisibilityChanged,
  onDragStart,
  onDragEnd,
}: {
  page: PageRow;
  index: number;
  userPlan: UserPlan;
  onDeleted: (id: string) => void;
  onSlugSaved: (id: string, slug: string | null) => void;
  onVisibilityChanged: (id: string, v: "public" | "unlisted") => void;
  onDragStart: (pageId: string) => void;
  onDragEnd: () => void;
}) {
  const [copying, setCopying] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [hasPassword, setHasPassword] = useState(page.has_password);
  const [passwordPrompt, setPasswordPrompt] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

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

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/pages/${page.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDrawerOpen(false);
      onDeleted(page.id);
    } catch {
      setDeleting(false);
      setConfirming(false);
    }
  }, [page.id, onDeleted]);

  return (
    <>
      <div
        className="group flex flex-col gap-0 rounded-xl border border-border-default bg-bg-elevated transition hover:border-accent-soft/30 hover:shadow-card cursor-grab active:cursor-grabbing animate-fade-up"
        style={{ animationDelay: `${Math.min(index * 40, 300)}ms` }}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", page.id);
          onDragStart(page.id);
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
              variant="ghost"
              size="md"
              iconOnly
              onClick={() => { setConfirming(false); setDrawerOpen(true); }}
              title="Page actions"
              aria-label="More actions"
            >
              <Icon name="dots" size={15} />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Action drawer ── */}
      <ActionDrawer
        open={drawerOpen}
        title={page.title ?? "Untitled"}
        description={url.replace(/^https?:\/\//, "")}
        contentWidthClass="max-w-lg"
        onClose={() => { setDrawerOpen(false); setConfirming(false); }}
      >
        <DrawerSection>
          <DrawerItem
            icon="external"
            label="Open page"
            description="View the published page"
            href={url}
            onClick={() => setDrawerOpen(false)}
          />
          <DrawerItem
            icon="chart"
            label="Analytics"
            description="Views, scroll depth, referrers"
            href={`/my-pages/analytics/${page.id}`}
            onClick={() => setDrawerOpen(false)}
          />
          {canUseFeature(userPlan, "versionHistory") ? (
            <DrawerItem
              icon="history"
              label="Version history"
              description="Browse and restore previous versions"
              href={`/my-pages/versions/${page.id}`}
              onClick={() => setDrawerOpen(false)}
            />
          ) : (
            <DrawerItem
              icon="history"
              label="Version history"
              description="Available on Readable Pro — upgrade to access"
              href="/pricing"
              onClick={() => setDrawerOpen(false)}
              locked
            />
          )}
        </DrawerSection>

        <DrawerSection>
          <DrawerItem
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
            onClick={async () => {
              await handleToggleVisibility();
              setDrawerOpen(false);
            }}
          />
          {canUseFeature(userPlan, "passwordProtection") ? (
            hasPassword ? (
              <DrawerItem
                icon="lock"
                label="Remove password"
                description="Page is currently password-protected"
                active
                activeLabel="Protected"
                disabled={savingPassword}
                onClick={() => void handleSetPassword(null)}
              />
            ) : passwordPrompt ? (
              <div className="px-3 py-2 flex flex-col gap-2">
                <input
                  type="password"
                  value={passwordDraft}
                  onChange={(e) => setPasswordDraft(e.target.value)}
                  placeholder="Set a password (min. 4 chars)"
                  autoFocus
                  className="w-full rounded-lg border border-border-default bg-bg px-3 py-2 text-sm outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15 transition"
                />
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={passwordDraft.length < 4 || savingPassword}
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
              <DrawerItem
                icon="lock"
                label="Password protect"
                description="Require a password to view this page"
                onClick={() => setPasswordPrompt(true)}
              />
            )
          ) : (
            <DrawerItem
              icon="lock"
              label="Password protect"
              description="Available on Readable Pro — upgrade to access"
              href="/pricing"
              onClick={() => setDrawerOpen(false)}
              locked
            />
          )}
        </DrawerSection>

        <DrawerSection>
          {confirming ? (
            <div className="flex items-center gap-3 px-3 py-3">
              <span className="flex-1 text-sm text-text-secondary">Delete this page permanently?</span>
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
            <DrawerItem
              icon="trash"
              label="Delete page"
              description="Permanently remove this page and its URL"
              danger
              onClick={() => setConfirming(true)}
            />
          )}
        </DrawerSection>
      </ActionDrawer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Collections sidebar
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
      onDragOver={(e) => { if (draggingPageId) e.preventDefault(); }}
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
            ? "bg-accent-dim text-accent font-medium"
            : "text-text-secondary hover:bg-fill-2 hover:text-text-primary",
        ].join(" ")}
      >
        <span className="truncate">{label}</span>
        <span className="shrink-0 rounded-full bg-fill-2 px-1.5 py-0.5 text-2xs text-text-muted tabular-nums">
          {count}
        </span>
      </button>
      {canDelete ? (
        <Button
          variant="danger"
          size="sm"
          iconOnly
          onClick={() => onDeleteCollection(id)}
          aria-label={`Delete ${label}`}
          title={`Delete ${label}`}
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 shrink-0"
        >
          <Icon name="trash" size={12} />
        </Button>
      ) : null}
    </div>
  );

  return (
    <aside className="rounded-xl border border-border-default bg-bg-elevated p-3 lg:sticky lg:top-16 lg:self-start">
      <div className="mb-2 px-1 text-2xs font-semibold uppercase tracking-wider text-text-muted">
        Collections
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        <DropButton id="all" label="All pages" count={pageCount("all")} />
        <DropButton id="uncollected" label="Uncollected" count={pageCount("uncollected")} />
        {collections.map((collection) => (
          <DropButton
            key={collection.id}
            id={collection.id}
            label={collection.is_team_space ? `${collection.name} · Team` : collection.name}
            count={pageCount(collection.id)}
            canDelete={!collection.is_team_space}
          />
        ))}
      </div>

      <div className="mt-3 flex gap-1.5">
        <input
          value={newCollectionName}
          onChange={(e) => onNewCollectionName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onCreateCollection(); }
          }}
          placeholder="New collection…"
          className="min-w-0 flex-1 rounded-lg border border-outline bg-bg px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft"
        />
        <Button
          variant="primary"
          size="md"
          iconOnly
          onClick={onCreateCollection}
          disabled={creatingCollection || !newCollectionName.trim()}
          aria-label="Create collection"
          title="Create collection"
        >
          <Icon
            name={creatingCollection ? "spinner" : "plus"}
            size={13}
            className={creatingCollection ? "animate-spin" : undefined}
          />
        </Button>
      </div>
    </aside>
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
          className="w-full rounded-lg border border-outline bg-bg pl-8 pr-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft"
        />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value as SortKey)}
          className="rounded-lg border border-outline bg-bg px-2.5 py-1.5 text-sm text-text-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft appearance-none pr-7 bg-no-repeat"
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
  userPlan = "free",
}: {
  initialPages: Array<{
    id: string;
    slug: string | null;
    title: string | null;
    visibility: "public" | "unlisted";
    collection_id: string | null;
    view_count: number;
    has_password: boolean;
    created_at: string;
    updated_at: string;
  }>;
  initialCollections: CollectionRow[];
  baseUrl: string;
  userPlan?: UserPlan;
}) {
  const [pages, setPages] = useState<PageRow[]>(() =>
    initialPages.map((p) => ({ ...p, baseUrl }))
  );
  const [collections, setCollections] = useState<CollectionRow[]>(initialCollections);
  const [selectedCollection, setSelectedCollection] = useState<CollectionFilter>("all");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [draggingPageId, setDraggingPageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");

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

      <div className="flex flex-col gap-3">
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

        {filteredAndSorted.length > 0 ? (
          <div className="flex flex-col gap-2">
            {filteredAndSorted.map((page, i) => (
              <PageCard
                key={page.id}
                page={page}
                index={i}
                userPlan={userPlan}
                onDeleted={handleDeleted}
                onSlugSaved={handleSlugSaved}
                onVisibilityChanged={handleVisibilityChanged}
                onDragStart={setDraggingPageId}
                onDragEnd={() => setDraggingPageId(null)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-outline px-4 py-12 text-center text-sm text-text-muted">
            {searchQuery ? `No pages match "${searchQuery}"` : "No pages in this collection."}
          </div>
        )}
      </div>
    </div>
  );
}
