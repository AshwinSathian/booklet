"use client";

import { trackEvent } from "@/lib/analytics";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { DocSettings } from "@/lib/blocks";
import { ROUTES, UI } from "@/lib/constants";
import { copyTextToClipboard, markdownToHtml } from "@/lib/export";
import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppLogo } from "../ui/AppLogo";
import { Icon, type IconName } from "../ui/Icon";
import { SegmentedControl } from "../ui/SegmentedControl";
import ThemeToggle from "../ui/ThemeToggle";
import { useToast } from "../ui/ToastProvider";
import { DraftsDialog } from "./DraftsDialog";
import { TemplatesDialog } from "./TemplatesDialog";

export type SaveState = "saved" | "saving";
type EditorStatus = "idle" | "typing" | "publishing" | "published" | "error";

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
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={[
        "flex h-8 w-8 items-center justify-center rounded-lg transition",
        "text-text-muted hover:text-text-primary hover:bg-outline/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        active ? "bg-outline/30 text-text-primary" : "",
      ].join(" ")}
    >
      <Icon name={icon} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Overflow menu (⋯)
// ---------------------------------------------------------------------------

type MenuItem =
  | { type: "item"; label: string; icon?: IconName; shortcut?: string; onClick: () => void }
  | { type: "separator" };

function OverflowMenu({
  items,
  trigger,
  align = "left",
  disabled = false,
}: {
  items: MenuItem[];
  trigger: React.ReactNode;
  align?: "left" | "right";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => { if (!disabled) setOpen((v) => !v); }}>{trigger}</div>
      {open ? (
        <div className={["absolute top-full mt-1.5 z-(--z-dropdown,20) min-w-52 rounded-xl border border-outline bg-bg-elevated shadow-glass py-1 animate-dropdown-in", align === "right" ? "right-0" : "left-0"].join(" ")}>
          {items.map((item, i) =>
            item.type === "separator" ? (
              <div key={i} className="my-1 h-px bg-border-subtle" />
            ) : (
              <button
                key={i}
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-sm text-text-secondary transition hover:bg-fill-2 hover:text-text-primary"
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
              >
                {item.icon ? (
                  <span className="text-text-muted shrink-0">
                    <Icon name={item.icon} size={14} />
                  </span>
                ) : null}
                <span className="flex-1 text-left">{item.label}</span>
                {item.shortcut ? (
                  <kbd className="text-2xs text-text-muted font-mono">{item.shortcut}</kbd>
                ) : null}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
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

  // Post-publish state: show copy + open buttons.
  if (status === "published" && publishedUrl) {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onCopyLink}
          title="Copy share link"
          className={[
            "flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-xs font-semibold transition",
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
        <button
          type="button"
          onClick={onOpenPublished}
          title="Open published page"
          className="flex h-8 w-8 items-center justify-center rounded-pill border border-outline text-text-muted transition hover:border-accent-soft/50 hover:text-text-primary"
          aria-label="Open published page"
        >
          <Icon name="external" size={14} />
        </button>
        {publishedOwned && (
          <a
            href="/my-pages"
            className="hidden sm:flex items-center gap-1 text-xs text-text-muted hover:text-accent transition ml-0.5"
          >
            <Icon name="list" size={12} />
            <span>My pages</span>
          </a>
        )}
      </div>
    );
  }

  // Owned draft with an existing page: split "Update page" + "Publish as new".
  if (publishedOwned && publishedUrl && status !== "error") {
    return (
      <div className="flex items-center">
        <button
          type="button"
          onClick={onUpdatePage}
          disabled={!canPublish || isPublishing}
          title="Update published page in place"
          className={[
            "flex items-center gap-1.5 rounded-l-pill px-4 py-1.5 text-xs font-semibold transition",
            "bg-accent text-white shadow-soft",
            "hover:bg-accent-hover active:scale-[0.97]",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          ].join(" ")}
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
        {/* Divider + "Publish as new" trigger */}
        <OverflowMenu
          align="right"
          disabled={isPublishing}
          items={[
            {
              type: "item",
              label: "Publish as new page",
              icon: "plus",
              onClick: onPublish,
            },
          ]}
          trigger={
            <button
              type="button"
              title="More publish options"
              disabled={isPublishing}
              className={[
                "flex h-8 w-8 items-center justify-center rounded-r-pill transition",
                "bg-accent text-white border-l border-white/20",
                "hover:bg-accent-hover active:scale-[0.97]",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
              ].join(" ")}
            >
              <Icon name="chevron-down" size={11} />
            </button>
          }
        />
      </div>
    );
  }

  const label = status === "error" ? "Retry" : "Publish";

  return (
    <button
      type="button"
      onClick={onPublish}
      disabled={!canPublish || isPublishing}
      className={[
        "flex items-center gap-1.5 rounded-pill px-4 py-1.5 text-xs font-semibold transition",
        "bg-accent text-white shadow-soft",
        "hover:bg-accent-hover active:scale-[0.97]",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
      ].join(" ")}
    >
      {isPublishing ? (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="animate-spin" aria-hidden>
          <path d="M6.5 1a5.5 5.5 0 1 0 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ) : (
        <Icon name="upload" size={13} />
      )}
      <span className="hidden sm:inline">{label}</span>
    </button>
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
}) {
  const [visibleSettings, setVisibleSettings] = useState(false);
  const [visibleDrafts, setVisibleDrafts] = useState(false);
  const [visibleTemplates, setVisibleTemplates] = useState(false);

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

  const menuItems: MenuItem[] = [
    ...(isSignedIn ? [
      { type: "item" as const, label: "My pages", icon: "external" as IconName, onClick: () => { window.location.href = ROUTES.myPages; } },
      { type: "separator" as const },
    ] : []),
    { type: "item", label: "New draft",        icon: "plus",     shortcut: "⌘B", onClick: onNew },
    { type: "item", label: "My drafts",        icon: "list",     shortcut: "⌘D", onClick: () => setVisibleDrafts(true) },
    { type: "item", label: "Templates",        icon: "markdown",                 onClick: () => setVisibleTemplates(true) },
    { type: "item", label: "Import Markdown",  icon: "import",                   onClick: openImportPicker },
    { type: "separator" },
    { type: "item", label: "Copy as Markdown", icon: "copy",                     onClick: () => void onCopyMarkdown() },
    { type: "item", label: "Copy as HTML",     icon: "code",                     onClick: () => void onCopyHtml() },
    { type: "item", label: "Insert sample",    icon: "markdown",                 onClick: onInsertSample },
    { type: "separator" },
    { type: "item", label: "Go to homepage",   icon: "home",                     onClick: () => { window.location.href = "/"; } },
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

          <OverflowMenu
            items={menuItems}
            align="right"
            trigger={<IconBtn label="More options" icon="dots" />}
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
            <Link
              href={ROUTES.signIn}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-pill border border-outline px-3 py-1 text-xs font-medium text-text-secondary transition hover:border-accent-soft/50 hover:text-text-primary"
            >
              Sign in
            </Link>
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

      {/* Save warning — absolutely positioned so it doesn't shift header height */}
      {showSaveWarning ? (
        <div className="absolute top-full left-0 right-0 px-3 py-2 bg-bg/95 backdrop-blur-xl">
          <div className="mx-auto w-full max-w-7xl">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-400/8 px-3 py-2">
              <span className="text-xs text-amber-400">
                Couldn't save — browser storage may be full.
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

      <TemplatesDialog
        visible={visibleTemplates}
        onHide={() => setVisibleTemplates(false)}
        onSelect={(t) => {
          onInsertTemplate?.(t.name, t.content);
        }}
      />
    </header>
  );
}

function toErrorMessage(e: unknown) {
  if (e instanceof Error) return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}
