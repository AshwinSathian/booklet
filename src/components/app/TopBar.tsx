"use client";

import { trackEvent } from "@/lib/analytics";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { DocSettings } from "@/lib/blocks";
import { UI } from "@/lib/constants";
import { copyTextToClipboard, markdownToHtml } from "@/lib/export";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppLogo } from "../ui/AppLogo";
import ThemeToggle from "../ui/ThemeToggle";
import { useToast } from "../ui/ToastProvider";
import { DraftsDialog } from "./DraftsDialog";

export type SaveState = "saved" | "saving";
type EditorStatus = "idle" | "typing" | "publishing" | "published" | "error";

// ---------------------------------------------------------------------------
// Icon primitives
// ---------------------------------------------------------------------------

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <path d={d} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ICONS = {
  plus: "M8 3v10M3 8h10",
  list: "M3 4h10M3 8h10M3 12h6",
  upload: "M8 11V3M4 7l4-4 4 4M3 13h10",
  copy: "M5 5h6v6H5zM9 5V3h4v4h-2M5 9H3v4h4v-2",
  code: "M10 12 13 9 10 6M6 6 3 9l3 3",
  import: "M8 3v8M5 8l3 3 3-3M3 13h10",
  link: "M7 9 5 7a2 2 0 1 1 3-3l2 2M9 7l2 2a2 2 0 1 1-3 3L6 10M10 6l-4 4",
  external: "M11 5H5a1 1 0 0 0-1 1v6M13 3v4M9 3h4v4M7 9l5-5",
  home: "M2 8 8 3l6 5M4 7v7h3v-4h2v4h3V7",
  gear: "M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M11 11l1 1M3 13l1-1M11 5l1-1",
  dots: "M4 8a1 1 0 1 0 2 0 1 1 0 0 0-2 0zM7 8a1 1 0 1 0 2 0 1 1 0 0 0-2 0zM10 8a1 1 0 1 0 2 0 1 1 0 0 0-2 0",
  check: "M3 8l4 4 6-7",
  pencil: "M11 3 13 5 5 13H3v-2L11 3z",
  spinner: "M8 2a6 6 0 0 1 0 12",
};

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
  icon: string;
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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-1 focus-visible:ring-offset-bg",
        active ? "bg-outline/30 text-text-primary" : "",
      ].join(" ")}
    >
      <Icon d={ICONS[icon as keyof typeof ICONS] ?? ""} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Overflow menu (⋯)
// ---------------------------------------------------------------------------

type MenuItem =
  | { type: "item"; label: string; icon?: string; shortcut?: string; onClick: () => void }
  | { type: "separator" };

function OverflowMenu({
  items,
  trigger,
}: {
  items: MenuItem[];
  trigger: React.ReactNode;
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
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open ? (
        <div className="absolute left-0 top-full mt-1.5 z-50 min-w-50 rounded-xl border border-outline bg-bg-elevated shadow-glass py-1">
          {items.map((item, i) =>
            item.type === "separator" ? (
              <div key={i} className="my-1 h-px bg-outline" />
            ) : (
              <button
                key={i}
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-[13px] text-text-secondary transition hover:bg-outline/30 hover:text-text-primary"
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
              >
                {item.icon ? (
                  <span className="text-text-muted">
                    <Icon d={ICONS[item.icon as keyof typeof ICONS] ?? ""} size={14} />
                  </span>
                ) : null}
                <span className="flex-1 text-left">{item.label}</span>
                {item.shortcut ? (
                  <kbd className="text-[10px] text-text-muted font-mono">{item.shortcut}</kbd>
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
// Settings panel (slide-over)
// ---------------------------------------------------------------------------

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-outline bg-bg p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={[
            "flex-1 rounded-md px-3 py-1.5 text-[12px] font-medium transition",
            value === opt.value
              ? "bg-accent text-white shadow-sm"
              : "text-text-muted hover:text-text-primary",
          ].join(" ")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

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
      className="absolute right-0 top-full mt-1.5 z-50 w-72 rounded-2xl border border-outline bg-bg-elevated shadow-glass p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-[13px] font-semibold">Settings</div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:text-text-primary transition"
          aria-label="Close settings"
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 12 12" aria-hidden>
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Theme
          </div>
          <ThemeToggle />
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
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
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
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
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
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
        className="min-w-0 max-w-50 rounded-md border border-accent-soft bg-bg px-2 py-0.5 text-[13px] font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-soft"
        aria-label="Draft title"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={begin}
      title="Click to rename"
      className="group flex items-center gap-1.5 min-w-0 max-w-50 rounded-md px-1.5 py-0.5 transition hover:bg-outline/30"
    >
      <span className="truncate text-[13px] font-medium text-text-secondary group-hover:text-text-primary transition">
        {title || "Untitled"}
      </span>
      <span className="shrink-0 text-text-muted opacity-0 group-hover:opacity-100 transition">
        <Icon d={ICONS.pencil} size={11} />
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
  copyLinkPulse,
  onPublish,
  onCopyLink,
  onOpenPublished,
}: {
  status: EditorStatus;
  canPublish: boolean;
  publishedUrl: string | null;
  copyLinkPulse: boolean;
  onPublish: () => void;
  onCopyLink: () => void;
  onOpenPublished: () => void;
}) {
  const isPublishing = status === "publishing";

  if (publishedUrl) {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onCopyLink}
          title="Copy share link"
          className={[
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition",
            "border border-outline text-text-secondary hover:border-accent-soft/50 hover:text-text-primary",
            copyLinkPulse ? "ring-2 ring-accent-soft ring-offset-1 ring-offset-bg" : "",
          ].join(" ")}
        >
          <Icon d={ICONS.link} size={13} />
          <span className="hidden sm:inline">Copy link</span>
        </button>
        <button
          type="button"
          onClick={onOpenPublished}
          title="Open published page"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline text-text-muted transition hover:border-accent-soft/50 hover:text-text-primary"
          aria-label="Open published page"
        >
          <Icon d={ICONS.external} size={14} />
        </button>
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
        "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-semibold transition",
        "bg-accent text-white shadow-soft",
        "hover:bg-accent-hover active:scale-[0.96]",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-1 focus-visible:ring-offset-bg",
      ].join(" ")}
    >
      {isPublishing ? (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="animate-spin" aria-hidden>
          <path d="M6.5 1a5.5 5.5 0 1 0 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ) : (
        <Icon d={ICONS.upload} size={13} />
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
      <span className="hidden sm:inline text-[11px] font-medium text-amber-400">
        Save issue
      </span>
    );
  }

  if (saveState === "saving") {
    return (
      <span className="hidden sm:inline text-[11px] text-text-muted animate-pulse">
        Saving…
      </span>
    );
  }

  return (
    <span className="hidden sm:inline text-[11px] text-text-muted">
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
  publishedUrl,
  copyLinkPulse,
  settings,
  onSettingsChange,
  onInsertSample,
  saveState,
  lastSavedAtLabel,
  showSaveWarning,
  onImportMarkdown,
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
  onCopyLink: () => void;
  onOpenPublished: () => void;
  publishedUrl: string | null;
  copyLinkPulse?: boolean;
  settings: DocSettings;
  onSettingsChange: (next: DocSettings) => void;
  onInsertSample: () => void;
  saveState: SaveState;
  lastSavedAtLabel?: string | null;
  showSaveWarning?: boolean;
  onImportMarkdown: (title: string, raw: string) => void;
}) {
  const [visibleSettings, setVisibleSettings] = useState(false);
  const [visibleDrafts, setVisibleDrafts] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const settingsBtnRef = useRef<HTMLDivElement>(null);
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

  const menuItems: MenuItem[] = [
    {
      type: "item",
      label: "New draft",
      icon: "plus",
      shortcut: "⌘B",
      onClick: onNew,
    },
    {
      type: "item",
      label: "My drafts",
      icon: "list",
      onClick: () => setVisibleDrafts(true),
    },
    {
      type: "item",
      label: "Import Markdown",
      icon: "import",
      onClick: openImportPicker,
    },
    { type: "separator" },
    {
      type: "item",
      label: "Copy as Markdown",
      icon: "copy",
      onClick: () => void onCopyMarkdown(),
    },
    {
      type: "item",
      label: "Copy as HTML",
      icon: "code",
      onClick: () => void onCopyHtml(),
    },
    {
      type: "item",
      label: "Insert sample",
      icon: "import",
      onClick: onInsertSample,
    },
    { type: "separator" },
    {
      type: "item",
      label: "Go to homepage",
      icon: "home",
      onClick: () => { window.location.href = "/"; },
    },
  ];

  return (
    <header id="header" className="sticky top-0 z-20 border-b border-outline/70 bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-12 w-full max-w-7xl items-center gap-2 px-3">

        {/* ── Left zone ── */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Link href="/" aria-label="Home">
            <AppLogo onlyIcon={true} />
          </Link>

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
            trigger={<IconBtn label="More options" icon="dots" />}
          />

          <div ref={settingsBtnRef} className="relative">
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

          <div className="mx-1 h-4 w-px bg-outline" />

          <PublishArea
            status={status}
            canPublish={canPublish}
            publishedUrl={publishedUrl ?? null}
            copyLinkPulse={copyLinkPulse ?? false}
            onPublish={onPublish}
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

      {/* Save warning banner */}
      {showSaveWarning ? (
        <div className="mx-auto w-full max-w-7xl px-3 pb-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-400/8 px-3 py-2">
            <span className="text-[12px] text-amber-400">
              Could not save locally — browser storage may be full.
            </span>
            <button
              type="button"
              onClick={() => void onCopyMarkdown()}
              className="text-[11px] font-semibold text-amber-400 underline underline-offset-2 transition hover:text-amber-300"
            >
              Export Markdown
            </button>
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
