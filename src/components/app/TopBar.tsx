"use client";

import { trackEvent } from "@/lib/analytics";
import { ANALYTICS_EVENTS, hashId } from "@/lib/analytics-events";
import { DocSettings } from "@/lib/blocks";
import { ROUTES, UI } from "@/lib/constants";
import {
  DRAFTS_STORAGE_KEYS,
  deleteDraft,
  duplicateDraft,
  listDrafts,
  updateDraft,
  type DraftMeta,
} from "@/lib/drafts";
import { copyTextToClipboard, markdownToHtml } from "@/lib/export";
import { TEMPLATES, type Template } from "@/lib/templates";
import { formatRelativeTimeFromIso, formatUpdatedAtLong } from "@/lib/ui/time";
import { UserButton, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActionDrawer, DrawerSection } from "../ui/ActionDrawer";
import { AppLogo } from "../ui/AppLogo";
import { Button } from "../ui/Button";
import { Icon, type IconName } from "../ui/Icon";
import { SegmentedControl } from "../ui/SegmentedControl";
import ThemeToggle from "../ui/ThemeToggle";
import { useToast } from "../ui/ToastProvider";
import { DraftsDialog } from "./DraftsDialog";

export type SaveState = "saved" | "saving";
type EditorStatus = "idle" | "typing" | "publishing" | "published" | "error";

// Slug validation — mirrors server-side rule in /api/pages/[id]/route.ts
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$|^[a-z0-9]{3,60}$/;
function isValidSlug(s: string) { return SLUG_RE.test(s) && !s.includes("--"); }
function isValidTitle(title: string): boolean { return title.trim().length > 0; }

// ---------------------------------------------------------------------------
// Icon button
// ---------------------------------------------------------------------------

function IconBtn({
  label,
  icon,
  onClick,
  active,
}: {
  label: string;
  icon: IconName;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="md"
      iconOnly
      aria-label={label}
      title={label}
      onClick={onClick}
      className={active ? "bg-fill-2 text-text-primary" : ""}
    >
      <Icon name={icon} />
    </Button>
  );
}

type MoreDrawerView = "menu" | "drafts" | "templates";

type ActionItem = {
  label: string;
  detail?: string;
  icon?: IconName;
  shortcut?: string;
  view?: Exclude<MoreDrawerView, "menu">;
  onClick?: () => void;
};

type ActionSection = {
  title: string;
  items: ActionItem[];
};

function MoreActionsDrawer({
  open,
  sections,
  activeDraftId,
  onCreateDraft,
  onOpenDraft,
  onRequestImportMarkdown,
  onSelectTemplate,
  onClose,
}: {
  open: boolean;
  sections: ActionSection[];
  activeDraftId: string | null;
  onCreateDraft: (origin?: "drafts_dialog") => string;
  onOpenDraft: (id: string, origin?: "drafts_dialog") => void;
  onRequestImportMarkdown: () => void;
  onSelectTemplate?: (template: Template) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<MoreDrawerView>("menu");

  useEffect(() => {
    if (!open) setView("menu");
  }, [open]);

  const goBack = useCallback(() => setView("menu"), []);

  return (
    <ActionDrawer
      open={open}
      title={view === "menu" ? "More" : view === "drafts" ? "My drafts" : "Templates"}
      description={view === "menu" ? "Draft actions, import/export tools, and navigation." : undefined}
      onClose={onClose}
    >
      {view === "menu" ? (
        sections.map((section) => (
          <DrawerSection key={section.title} title={section.title}>
            {section.items.map((item) => (
              <button
                key={item.label}
                type="button"
                className="flex w-full items-center gap-3 border-b border-border-subtle px-3 py-3 text-left text-sm text-text-secondary transition last:border-b-0 hover:bg-fill-2 hover:text-text-primary"
                onClick={() => {
                  if (item.view) {
                    setView(item.view);
                    return;
                  }
                  item.onClick?.();
                  onClose();
                }}
              >
                {item.icon ? (
                  <span className="shrink-0 text-text-muted">
                    <Icon name={item.icon} size={16} />
                  </span>
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block text-text-primary">{item.label}</span>
                  {item.detail ? (
                    <span className="mt-0.5 block text-xs text-text-muted">{item.detail}</span>
                  ) : null}
                </span>
                {item.shortcut ? (
                  <kbd className="rounded border border-border-subtle bg-fill-1 px-1.5 py-0.5 text-2xs font-mono text-text-muted">
                    {item.shortcut}
                  </kbd>
                ) : null}
              </button>
            ))}
          </DrawerSection>
        ))
      ) : null}

      {view === "drafts" ? (
        <DrawerDraftsView
          activeDraftId={activeDraftId}
          onBack={goBack}
          onClose={onClose}
          onCreateDraft={onCreateDraft}
          onOpenDraft={onOpenDraft}
          onRequestImportMarkdown={onRequestImportMarkdown}
        />
      ) : null}

      {view === "templates" ? (
        <DrawerTemplatesView
          onBack={goBack}
          onSelect={(template) => {
            onSelectTemplate?.(template);
            onClose();
          }}
        />
      ) : null}
    </ActionDrawer>
  );
}

function DrawerBackButton({ onBack }: { onBack: () => void }) {
  return (
    <Button variant="secondary" size="sm" onClick={onBack} className="mb-3">
      <Icon name="chevron-right" size={13} className="rotate-180" />
      Back
    </Button>
  );
}

function DrawerTemplatesView({
  onBack,
  onSelect,
}: {
  onBack: () => void;
  onSelect: (template: Template) => void;
}) {
  return (
    <>
      <DrawerBackButton onBack={onBack} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {TEMPLATES.map((template) => (
          <button
            key={template.name}
            type="button"
            onClick={() => onSelect(template)}
            className="flex min-h-24 flex-col items-start gap-1 rounded-lg border border-border-subtle bg-bg-elevated px-4 py-3.5 text-left transition hover:border-accent-soft/40 hover:bg-accent/4 active:scale-[0.99]"
          >
            <span className="text-sm font-medium text-text-primary">{template.name}</span>
            <span className="text-xs leading-relaxed text-text-muted">{template.description}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function DrawerDraftsView({
  activeDraftId,
  onBack,
  onClose,
  onCreateDraft,
  onOpenDraft,
  onRequestImportMarkdown,
}: {
  activeDraftId: string | null;
  onBack: () => void;
  onClose: () => void;
  onCreateDraft: (origin?: "drafts_dialog") => string;
  onOpenDraft: (id: string, origin?: "drafts_dialog") => void;
  onRequestImportMarkdown: () => void;
}) {
  const [drafts, setDrafts] = useState<DraftMeta[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const refresh = useCallback(() => setDrafts(listDrafts()), []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === DRAFTS_STORAGE_KEYS.db) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const cancelRename = useCallback(() => {
    setEditingId(null);
    setEditingTitle("");
  }, []);

  const beginRename = useCallback((draft: DraftMeta) => {
    setEditingId(draft.id);
    setEditingTitle(draft.title);
    setConfirmDeleteId(null);
  }, []);

  const commitRename = useCallback(() => {
    if (!editingId) return;
    const next = editingTitle.trim();
    if (!isValidTitle(next)) return;
    updateDraft(editingId, { title: next });
    trackEvent(ANALYTICS_EVENTS.draft_renamed, { draft_hash: hashId(editingId) });
    cancelRename();
    refresh();
  }, [cancelRename, editingId, editingTitle, refresh]);

  const onDuplicate = useCallback((id: string) => {
    const copy = duplicateDraft(id);
    trackEvent(ANALYTICS_EVENTS.draft_duplicated, {
      draft_hash: hashId(id),
      new_draft_hash: copy ? hashId(copy.id) : "",
    });
    refresh();
  }, [refresh]);

  const onDelete = useCallback((id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }

    const deletingActive = id === activeDraftId;
    deleteDraft(id);
    trackEvent(ANALYTICS_EVENTS.draft_deleted, {
      draft_hash: hashId(id),
      deleting_active: deletingActive,
    });
    cancelRename();
    setConfirmDeleteId(null);

    const nextDrafts = listDrafts();
    setDrafts(nextDrafts);

    if (!deletingActive) return;

    const nextId = nextDrafts[0]?.id;
    if (nextId) {
      onOpenDraft(nextId, "drafts_dialog");
      onClose();
      return;
    }
    onCreateDraft("drafts_dialog");
    onClose();
  }, [activeDraftId, cancelRename, confirmDeleteId, onClose, onCreateDraft, onOpenDraft]);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <DrawerBackButton onBack={onBack} />
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onRequestImportMarkdown}>
            <Icon name="download" size={12} />
            Import
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              const id = onCreateDraft("drafts_dialog");
              trackEvent(ANALYTICS_EVENTS.draft_created, { draft_hash: hashId(id), origin: "drafts_dialog" });
              onClose();
            }}
          >
            <Icon name="plus" size={12} />
            New draft
          </Button>
        </div>
      </div>

      {drafts.length === 0 ? (
        <div className="rounded-lg border border-border-subtle bg-bg-elevated p-5">
          <div className="text-sm font-semibold text-text-primary">No drafts yet.</div>
          <div className="mt-1.5 text-sm leading-relaxed text-text-secondary">
            Drafts autosave to your browser. Publishing creates a shareable link; your draft stays here, ready to edit.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {drafts.map((draft) => {
            const isActive = draft.id === activeDraftId;
            const isEditing = editingId === draft.id;
            const isConfirmingDelete = confirmDeleteId === draft.id;
            const updatedLong = formatUpdatedAtLong(draft.updatedAt);
            const updatedRel = formatRelativeTimeFromIso(draft.updatedAt);
            const updated = updatedRel && updatedRel !== updatedLong
              ? `${updatedRel} · ${updatedLong}`
              : updatedLong;

            return (
              <div
                key={draft.id}
                className={[
                  "rounded-lg border p-3 transition",
                  isActive ? "border-accent-soft/40 bg-accent/5" : "border-border-subtle bg-bg-elevated",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                          if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
                        }}
                        onBlur={commitRename}
                        autoFocus
                        className="w-full rounded-md border border-accent-soft bg-bg px-2 py-0.5 text-sm font-medium text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
                        aria-label="Draft title"
                      />
                    ) : (
                      <div className="truncate text-sm font-medium text-text-primary">
                        {draft.title?.trim() ? draft.title : "Untitled"}
                      </div>
                    )}
                    {updated ? (
                      <div className="mt-0.5 text-xs text-text-muted">{updated}</div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                    <DrawerDraftIconButton label={isEditing ? "Save rename" : "Open draft"} onClick={() => {
                      if (isEditing) {
                        commitRename();
                        return;
                      }
                      trackEvent(ANALYTICS_EVENTS.draft_opened, { draft_hash: hashId(draft.id), origin: "drafts_dialog", is_active: isActive });
                      onOpenDraft(draft.id, "drafts_dialog");
                      onClose();
                    }}>
                      <Icon name={isEditing ? "check" : "external"} size={13} />
                    </DrawerDraftIconButton>
                    <DrawerDraftIconButton label="Rename" onClick={() => isEditing ? cancelRename() : beginRename(draft)}>
                      <Icon name="pencil" size={13} />
                    </DrawerDraftIconButton>
                    <DrawerDraftIconButton label="Duplicate" onClick={() => onDuplicate(draft.id)}>
                      <Icon name="duplicate" size={13} />
                    </DrawerDraftIconButton>
                    <DrawerDraftIconButton label="Delete" danger onClick={() => onDelete(draft.id)}>
                      <Icon name="trash" size={13} />
                    </DrawerDraftIconButton>
                  </div>
                </div>

                {isEditing && !isValidTitle(editingTitle) ? (
                  <div className="mt-2 text-xs text-red-400">A title is required.</div>
                ) : null}

                {isConfirmingDelete ? (
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2">
                    <span className="text-xs text-red-400">Delete this draft? You can&apos;t undo this.</span>
                    <div className="flex gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteId(null)}>
                        Cancel
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => onDelete(draft.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function DrawerDraftIconButton({
  label,
  onClick,
  children,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Button
      variant={danger ? "danger" : "ghost"}
      size="sm"
      iconOnly
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Settings panel
// ---------------------------------------------------------------------------

function SettingsPanel({
  settings,
  onSettingsChange,
  onClose,
}: {
  settings: DocSettings;
  onSettingsChange: (next: DocSettings) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1.5 z-(--z-dropdown,20) w-72 rounded-card border border-outline bg-bg-elevated shadow-glass p-4 animate-dropdown-in"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold">Settings</div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-outline/40 hover:text-text-primary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          aria-label="Close settings"
        >
          <Icon name="close" size={13} />
        </button>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Theme
          </div>
          <ThemeToggle />
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Spacing
          </div>
          <SegmentedControl
            value={settings.spacing}
            options={[
              { label: "Compact", value: "compact" },
              { label: "Comfortable", value: "comfortable" },
            ]}
            onChange={(v) => onSettingsChange({ ...settings, spacing: v })}
          />
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Width
          </div>
          <SegmentedControl
            value={settings.width}
            options={[
              { label: "Normal", value: "normal" },
              { label: "Wide", value: "wide" },
            ]}
            onChange={(v) => onSettingsChange({ ...settings, width: v })}
          />
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Code blocks
          </div>
          <SegmentedControl
            value={settings.code}
            options={[
              { label: "Show", value: "show" },
              { label: "Collapse", value: "collapse" },
            ]}
            onChange={(v) => onSettingsChange({ ...settings, code: v })}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline title editor
// ---------------------------------------------------------------------------

function DraftTitle({
  title,
  onRename,
}: {
  title: string;
  onRename: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const begin = () => {
    setDraft(title);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = () => {
    const next = draft.trim();
    if (next) onRename(next);
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); cancel(); }
        }}
        autoFocus
        className="min-w-0 max-w-52 rounded-md border border-accent-soft bg-bg px-2 py-0.5 text-sm font-medium text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
        aria-label="Draft title"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={begin}
      title="Click to rename"
      className="group flex items-center gap-1.5 min-w-0 max-w-52 rounded-md px-1.5 py-0.5 transition hover:bg-outline/30"
    >
      <span className="truncate text-sm font-medium text-text-secondary group-hover:text-text-primary transition">
        {title || "Untitled"}
      </span>
      <span className="shrink-0 text-text-muted opacity-0 group-hover:opacity-100 transition">
        <Icon name="pencil" size={11} />
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Publish / post-publish button group
// ---------------------------------------------------------------------------

function PublishArea({
  status,
  canPublish,
  publishedUrl,
  publishedOwned,
  copyLinkPulse,
  onPublish,
  onUpdatePage,
  onCopyLink,
  onOpenPublished,
}: {
  status: EditorStatus;
  canPublish: boolean;
  publishedUrl: string | null;
  publishedOwned: boolean;
  copyLinkPulse: boolean;
  onPublish: () => void;
  onUpdatePage: () => void;
  onCopyLink: () => void;
  onOpenPublished: () => void;
}) {
  const isPublishing = status === "publishing";
  const [showPublishOptions, setShowPublishOptions] = useState(false);

  // Post-publish state: show copy + open buttons.
  if (status === "published" && publishedUrl) {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onCopyLink}
          title="Copy share link"
          className={[
            "inline-flex items-center gap-1.5 rounded-pill font-semibold transition h-8 px-3.5 text-xs",
            "active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
            publishedOwned
              ? "border border-accent/40 text-accent bg-accent-dim hover:border-accent hover:bg-accent/10"
              : "border border-outline text-text-secondary hover:border-accent-soft/50 hover:text-text-primary",
            copyLinkPulse ? "ring-2 ring-accent-soft ring-offset-1 ring-offset-bg" : "",
          ].join(" ")}
        >
          <span className="relative">
            <Icon name="link" size={13} />
            {publishedOwned && (
              <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-accent sm:hidden" aria-hidden />
            )}
          </span>
          <span className="hidden sm:inline">
            {publishedOwned ? "Your page · Copy link" : "Copy link"}
          </span>
        </button>
        <Button variant="secondary" size="md" iconOnly onClick={onOpenPublished} title="Open published page" aria-label="Open published page">
          <Icon name="external" size={14} />
        </Button>
        {publishedOwned && (
          <a
            href="/my-pages"
            className="flex items-center gap-1 text-xs text-text-muted hover:text-accent transition ml-0.5"
          >
            <Icon name="list" size={12} />
            <span className="hidden sm:inline">My pages</span>
          </a>
        )}
      </div>
    );
  }

  // Owned draft with an existing page: split "Update page" + "Publish as new".
  if (publishedOwned && publishedUrl && status !== "error") {
    return (
      <>
        <div className="flex items-center">
          <button
            type="button"
            onClick={onUpdatePage}
            disabled={!canPublish || isPublishing}
            title="Update published page in place"
            className="inline-flex items-center gap-1.5 rounded-l-pill h-8 px-3.5 text-xs font-semibold bg-accent text-white shadow-soft hover:bg-accent-hover transition active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            {isPublishing ? (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="animate-spin" aria-hidden>
                <path d="M6.5 1a5.5 5.5 0 1 0 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <Icon name="upload" size={13} />
            )}
            <span className="hidden sm:inline">Update page</span>
          </button>
          <button
            type="button"
            title="More publish options"
            disabled={isPublishing}
            onClick={() => setShowPublishOptions(true)}
            className="flex h-8 w-8 items-center justify-center rounded-r-pill bg-accent text-white border-l border-white/20 hover:bg-accent-hover transition active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Icon name="chevron-down" size={11} />
          </button>
        </div>
        <ActionDrawer
          open={showPublishOptions}
          title="Publish options"
          description="Choose whether this draft updates the current page or becomes a new page."
          onClose={() => setShowPublishOptions(false)}
        >
          <DrawerSection title="Page">
            <button
              type="button"
              className="flex w-full items-center gap-3 border-b border-border-subtle px-3 py-3 text-left text-sm text-text-secondary transition last:border-b-0 hover:bg-fill-2 hover:text-text-primary"
              onClick={() => {
                onPublish();
                setShowPublishOptions(false);
              }}
            >
              <span className="shrink-0 text-text-muted">
                <Icon name="plus" size={16} />
              </span>
              <span>
                <span className="block text-text-primary">Publish as new page</span>
                <span className="mt-0.5 block text-xs text-text-muted">Create a separate published URL from this draft.</span>
              </span>
            </button>
          </DrawerSection>
        </ActionDrawer>
      </>
    );
  }

  const label = status === "error" ? "Retry" : "Publish";

  return (
    <Button variant="primary" size="md" onClick={onPublish} disabled={!canPublish || isPublishing}>
      {isPublishing ? (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="animate-spin" aria-hidden>
          <path d="M6.5 1a5.5 5.5 0 1 0 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ) : (
        <Icon name="upload" size={13} />
      )}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Save state indicator
// ---------------------------------------------------------------------------

function SaveIndicator({
  saveState,
  lastSavedAtLabel,
  showSaveWarning,
}: {
  saveState: SaveState;
  lastSavedAtLabel?: string | null;
  showSaveWarning?: boolean;
}) {
  if (showSaveWarning) {
    return (
      <span className="hidden sm:inline text-xs font-medium text-amber-400">
        Not saved
      </span>
    );
  }

  if (saveState === "saving") {
    return (
      <span className="hidden sm:inline text-xs text-text-muted animate-pulse">
        Saving…
      </span>
    );
  }

  return (
    <span className="hidden sm:inline text-xs text-text-muted">
      {lastSavedAtLabel ? `Saved ${lastSavedAtLabel}` : "Saved"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main TopBar
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Post-publish slug bar
// ---------------------------------------------------------------------------

type SlugBarAvailability = "idle" | "checking" | "available" | "taken";

function PostPublishSlugBar({
  pageId,
  onSlugSet,
  onDismiss,
}: {
  pageId: string;
  onSlugSet: (newSlug: string) => void;
  onDismiss: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<SlugBarAvailability>("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  // Debounced availability check
  useEffect(() => {
    const value = draft.trim().toLowerCase();
    if (!value || !isValidSlug(value)) {
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
  }, [draft, pageId]);

  const save = async () => {
    const value = draft.trim().toLowerCase();
    if (!value) { onDismiss(); return; }
    if (!isValidSlug(value)) {
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
        throw new Error(body.error ?? "Failed to save");
      }
      onSlugSet(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
    }
  };

  const hostLabel =
    typeof window !== "undefined"
      ? window.location.host
      : "readable.page";

  const canSave =
    draft.trim().length > 0 &&
    !saving &&
    availability !== "taken" &&
    availability !== "checking";

  return (
    <div className="absolute top-full left-0 right-0 z-10 border-b border-outline/50 bg-bg-soft/95 backdrop-blur-xl px-3 py-2.5 animate-dropdown-in">
      <div className="mx-auto w-full max-w-7xl flex flex-col sm:flex-row sm:items-center gap-2">
        <span className="text-xs text-text-secondary shrink-0">
          Set a custom URL before sharing:
        </span>
        <div className="flex items-center gap-0 min-w-0 flex-1">
          <span className="text-xs text-text-muted/60 px-2 py-1 bg-bg border border-r-0 border-outline rounded-l-md whitespace-nowrap hidden sm:inline">
            {hostLabel}/p/
          </span>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => { setDraft(e.target.value.toLowerCase()); setError(null); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); void save(); }
              if (e.key === "Escape") { e.preventDefault(); onDismiss(); }
            }}
            placeholder="my-incident-2026"
            className={[
              "min-w-0 flex-1 sm:w-52 sm:flex-none px-2 py-1 text-xs bg-bg border rounded-md sm:rounded-l-none sm:rounded-r-md text-text-primary placeholder:text-text-muted/40",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft",
              "transition-colors duration-fast",
              availability === "taken" ? "border-red-400/60" : "border-outline",
            ].join(" ")}
            aria-label="Custom URL slug"
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Availability indicator */}
          {availability === "checking" && (
            <span key="checking" className="text-xs text-text-muted animate-fade-in">Checking…</span>
          )}
          {availability === "available" && !error && (
            <span key="available" className="text-xs text-green-400 animate-fade-in">✓ Available</span>
          )}
          {availability === "taken" && !error && (
            <span key="taken" className="text-xs text-red-400 animate-fade-in">✗ Taken</span>
          )}
          {error && <span key="error" className="text-xs text-red-400 animate-fade-in">{error}</span>}
          <Button variant="primary" size="sm" onClick={() => void save()} disabled={!canSave}>
            {saving ? (
              <svg width="11" height="11" viewBox="0 0 13 13" fill="none" className="animate-spin" aria-hidden>
                <path d="M6.5 1a5.5 5.5 0 1 0 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : null}
            Save URL
          </Button>
          <Button variant="ghost" size="sm" iconOnly onClick={onDismiss} aria-label="Skip" title="Skip">
            <Icon name="close" size={13} />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const TOAST_KEYS = {
  copyMd: "copy_md",
  copyHtml: "copy_html",
  importMd: "import_md",
} as const;

export function TopBar({
  status,
  canPublish,
  raw,
  draftTitle,
  onNew,
  onRenameCurrentDraft,
  activeDraftId,
  onSwitchDraft,
  onCreateDraft,
  onPublish,
  onCopyLink,
  onOpenPublished,
  onUpdatePage,
  publishedUrl,
  publishedOwned,
  copyLinkPulse,
  settings,
  onSettingsChange,
  onInsertSample,
  saveState,
  lastSavedAtLabel,
  showSaveWarning,
  onImportMarkdown,
  onInsertTemplate,
  onOpenDraftsShortcutRegistered,
  publishedId,
  onSlugSet,
}: {
  status: EditorStatus;
  canPublish: boolean;
  raw: string;
  draftTitle: string;
  onNew: () => void;
  onRenameCurrentDraft: (next: string) => void;
  activeDraftId: string | null;
  onSwitchDraft: (id: string, origin?: "drafts_dialog") => void;
  onCreateDraft: (origin?: "drafts_dialog") => string;
  onPublish: () => void;
  onUpdatePage: () => void;
  onCopyLink: () => void;
  onOpenPublished: () => void;
  publishedUrl: string | null;
  publishedOwned?: boolean;
  copyLinkPulse?: boolean;
  settings: DocSettings;
  onSettingsChange: (next: DocSettings) => void;
  onInsertSample: () => void;
  saveState: SaveState;
  lastSavedAtLabel?: string | null;
  showSaveWarning?: boolean;
  onImportMarkdown: (title: string, raw: string) => void;
  onInsertTemplate?: (title: string, content: string) => void;
  onOpenDraftsShortcutRegistered?: (fn: () => void) => void;
  publishedId?: string | null;
  onSlugSet?: (newSlug: string) => void;
}) {
  const [visibleSettings, setVisibleSettings] = useState(false);
  const [visibleMoreActions, setVisibleMoreActions] = useState(false);
  const [visibleDrafts, setVisibleDrafts] = useState(false);
  const [slugBarDismissed, setSlugBarDismissed] = useState(false);
  const prevPublishedIdRef = useRef<string | null | undefined>(undefined);

  // Reset slug bar when a new page is published
  useEffect(() => {
    if (publishedId !== prevPublishedIdRef.current) {
      prevPublishedIdRef.current = publishedId;
      setSlugBarDismissed(false);
    }
  }, [publishedId]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toast = useToast();

  const onCopyMarkdown = useCallback(async () => {
    try {
      await copyTextToClipboard(raw ?? "");
      toast.showCoalesced(TOAST_KEYS.copyMd, "success", "Copied", "Markdown copied.");
      trackEvent(ANALYTICS_EVENTS.export_copy_markdown, { raw_len: (raw ?? "").length });
    } catch (e) {
      toast.error("Copy failed", toErrorMessage(e));
    }
  }, [raw, toast]);

  const onCopyHtml = useCallback(async () => {
    try {
      const html = markdownToHtml(raw ?? "");
      await copyTextToClipboard(html);
      toast.showCoalesced(TOAST_KEYS.copyHtml, "success", "Copied", "HTML copied.");
      trackEvent(ANALYTICS_EVENTS.export_copy_html, { raw_len: (raw ?? "").length, html_len: html.length });
    } catch (e) {
      toast.error("Copy failed", toErrorMessage(e));
    }
  }, [raw, toast]);

  const openImportPicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFilePicked = useCallback(async (file: File | null) => {
    if (!file) return;
    try {
      if (file.size > UI.importMarkdown.maxFileBytes) {
        toast.warn("File too large", "Please import a smaller Markdown file.");
        return;
      }
      const text = await file.text();
      const baseName = file.name.replace(/\.md$/i, "").trim();
      const title = baseName || UI.importMarkdown.defaultTitle;
      onImportMarkdown(title, text);
      setVisibleDrafts(false);
      setVisibleMoreActions(false);
      toast.showCoalesced(TOAST_KEYS.importMd, "success", "Imported", "Draft created from Markdown.");
    } catch (e) {
      toast.error("Import failed", toErrorMessage(e));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [onImportMarkdown, toast]);

  const { isSignedIn } = useUser();

  useEffect(() => {
    if (onOpenDraftsShortcutRegistered) {
      onOpenDraftsShortcutRegistered(() => setVisibleDrafts(true));
    }
  }, [onOpenDraftsShortcutRegistered]);

  const actionSections: ActionSection[] = [
    ...(isSignedIn ? [{
      title: "Account",
      items: [
        {
          label: "My pages",
          detail: "Manage published pages, slugs, analytics, and history.",
          icon: "external" as IconName,
          onClick: () => { window.location.href = ROUTES.myPages; },
        },
      ],
    }] : []),
    {
      title: "Drafts",
      items: [
        { label: "New draft", detail: "Start with a blank local draft.", icon: "plus", shortcut: "⌘B", onClick: onNew },
        { label: "My drafts", detail: "Open saved local drafts.", icon: "list", shortcut: "⌘D", view: "drafts" },
        { label: "Templates", detail: "Insert a structured starting point.", icon: "markdown", view: "templates" },
        { label: "Import Markdown", detail: "Create a draft from a .md file.", icon: "import", onClick: openImportPicker },
      ],
    },
    {
      title: "Clipboard",
      items: [
        { label: "Copy as Markdown", detail: "Copy the current source text.", icon: "copy", onClick: () => void onCopyMarkdown() },
        { label: "Copy as HTML", detail: "Copy rendered HTML for the draft.", icon: "code", onClick: () => void onCopyHtml() },
        { label: "Insert sample", detail: "Replace the draft with sample Markdown.", icon: "markdown", onClick: onInsertSample },
      ],
    },
    {
      title: "Navigation",
      items: [
        { label: "Go to homepage", detail: "Return to Readable's public page.", icon: "home", onClick: () => { window.location.href = "/"; } },
      ],
    },
  ];

  return (
    <header id="header" className="sticky top-0 z-20 border-b border-outline/70 bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-12 w-full max-w-7xl items-center gap-2 px-3">

        {/* ── Left zone ── */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <AppLogo onlyIcon={true} />
          <div className="h-4 w-px bg-outline shrink-0" />
          <DraftTitle title={draftTitle} onRename={onRenameCurrentDraft} />
        </div>

        {/* ── Right zone ── */}
        <div className="flex items-center gap-1.5 shrink-0">
          <SaveIndicator
            saveState={saveState}
            lastSavedAtLabel={lastSavedAtLabel}
            showSaveWarning={showSaveWarning}
          />

          <div className="mx-1 h-4 w-px bg-outline" />

          <IconBtn
            label="More options"
            icon="dots"
            onClick={() => setVisibleMoreActions(true)}
            active={visibleMoreActions}
          />

          <div className="relative">
            <IconBtn
              label="Settings"
              icon="gear"
              onClick={() => setVisibleSettings((v) => !v)}
              active={visibleSettings}
            />
            {visibleSettings ? (
              <SettingsPanel
                settings={settings}
                onSettingsChange={onSettingsChange}
                onClose={() => setVisibleSettings(false)}
              />
            ) : null}
          </div>

          {/* ── Auth ── */}
          {isSignedIn ? (
            <UserButton>
              <UserButton.MenuItems>
                <UserButton.Link
                  label="My pages"
                  labelIcon={<Icon name="external" size={14} />}
                  href={ROUTES.myPages}
                />
              </UserButton.MenuItems>
            </UserButton>
          ) : (
            <Button variant="secondary" size="sm" href={ROUTES.signIn}>
              Sign in
            </Button>
          )}

          <div className="mx-1 h-4 w-px bg-outline" />

          <PublishArea
            status={status}
            canPublish={canPublish}
            publishedUrl={publishedUrl ?? null}
            publishedOwned={publishedOwned ?? false}
            copyLinkPulse={copyLinkPulse ?? false}
            onPublish={onPublish}
            onUpdatePage={onUpdatePage}
            onCopyLink={onCopyLink}
            onOpenPublished={onOpenPublished}
          />
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={UI.importMarkdown.accept}
        className="hidden"
        onChange={(e) => { void onFilePicked(e.target.files?.[0] ?? null); }}
      />

      <MoreActionsDrawer
        open={visibleMoreActions}
        sections={actionSections}
        activeDraftId={activeDraftId}
        onCreateDraft={onCreateDraft}
        onOpenDraft={onSwitchDraft}
        onRequestImportMarkdown={openImportPicker}
        onSelectTemplate={(template) => onInsertTemplate?.(template.name, template.content)}
        onClose={() => setVisibleMoreActions(false)}
      />

      {/* Post-publish sign-in nudge — shown for anonymous publishes */}
      {status === "published" && !publishedOwned && !isSignedIn ? (
        <div className="border-t border-accent/20 bg-accent-dim/60 backdrop-blur-xl px-3 py-2">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
            <p className="text-xs text-text-secondary">
              <span className="font-semibold text-text-primary">This page expires in 30 days.</span>
              {" "}Sign in (free) to make it permanent, edit it in place, and track views.
            </p>
            <Button variant="primary" size="sm" href={ROUTES.signIn} className="shrink-0">
              Sign in free
            </Button>
          </div>
        </div>
      ) : null}

      {/* Post-publish slug bar — shown once for owned pages until dismissed or slug saved */}
      {status === "published" && publishedOwned && publishedId && !slugBarDismissed ? (
        <PostPublishSlugBar
          pageId={publishedId}
          onSlugSet={(newSlug) => {
            setSlugBarDismissed(true);
            onSlugSet?.(newSlug);
          }}
          onDismiss={() => setSlugBarDismissed(true)}
        />
      ) : null}

      {/* Save warning — absolutely positioned so it doesn't shift header height */}
      {showSaveWarning ? (
        <div className="absolute top-full left-0 right-0 px-3 py-2 bg-bg/95 backdrop-blur-xl">
          <div className="mx-auto w-full max-w-7xl">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-400/8 px-3 py-2">
              <span className="text-xs text-amber-400">
                Couldn&apos;t save — browser storage may be full.
              </span>
              <button
                type="button"
                onClick={() => void onCopyMarkdown()}
                className="text-xs font-semibold text-amber-400 underline underline-offset-2 transition hover:text-amber-300"
              >
                Copy as Markdown
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <DraftsDialog
        visible={visibleDrafts}
        activeDraftId={activeDraftId}
        onCreateDraft={onCreateDraft}
        onRequestImportMarkdown={openImportPicker}
        onOpenDraft={(id) => {
          onSwitchDraft(id, "drafts_dialog");
          setVisibleDrafts(false);
        }}
        onHide={() => setVisibleDrafts(false)}
      />

    </header>
  );
}

function toErrorMessage(e: unknown) {
  if (e instanceof Error) return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}
