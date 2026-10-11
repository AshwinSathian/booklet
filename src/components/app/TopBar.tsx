"use client";

import { ImportUrlDialog } from "./ImportUrlDialog";
import { DocSettings } from "@/lib/blocks";
import { ROUTES, UI } from "@/lib/constants";
import { copyTextToClipboard, markdownToHtml } from "@/lib/export";
import { TEMPLATES, templateMarkdown, type Template } from "@/lib/templates";
import { DEFAULT_THEME_ID, THEMES } from "@/lib/themes";
import { prefersReducedMotion } from "@/lib/ui/motion";
import { useSession } from "@/components/auth/SessionProvider";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetSection } from "../ui/Sheet";
import { Menu, ContextMenuItem } from "../ui/ContextMenu";
import { AppLogo } from "../ui/AppLogo";
import { Button } from "../ui/Button";
import { Icon, type IconName } from "../ui/Icon";
import { SegmentedControl } from "../ui/SegmentedControl";
import ThemeToggle from "../ui/ThemeToggle";
import { useToast } from "../ui/ToastProvider";
import { DraftRow } from "./DraftRow";
import { DraftsDialog } from "./DraftsDialog";
import { useDraftListActions } from "./useDraftListActions";

export type SaveState = "saved" | "saving";
type EditorStatus = "idle" | "typing" | "publishing" | "published" | "error";

// Slug validation — mirrors server-side rule in /api/pages/[id]/route.ts
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$|^[a-z0-9]{3,60}$/;
function isValidSlug(s: string) { return SLUG_RE.test(s) && !s.includes("--"); }

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
  onCreateDraft: () => string;
  onOpenDraft: (id: string) => void;
  onRequestImportMarkdown: () => void;
  onSelectTemplate?: (template: Template) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<MoreDrawerView>("menu");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the drawer reopens on its menu, however it was closed
    if (!open) setView("menu");
  }, [open]);

  const goBack = useCallback(() => setView("menu"), []);

  return (
    <Sheet
      open={open}
      title={view === "menu" ? "More" : view === "drafts" ? "My drafts" : "Templates"}
      description={view === "menu" ? "Draft actions, import/export tools, and navigation." : undefined}
      onClose={onClose}
    >
      {view === "menu" ? (
        sections.map((section) => (
          <SheetSection key={section.title} title={section.title}>
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
          </SheetSection>
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
    </Sheet>
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
            className="flex min-h-24 flex-col items-start gap-1 rounded-lg border border-border-subtle bg-bg-elevated px-4 py-3.5 text-left transition hover:border-border-strong hover:bg-accent/4 active:scale-[0.99]"
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
  onCreateDraft: () => string;
  onOpenDraft: (id: string) => void;
  onRequestImportMarkdown: () => void;
}) {
  const actions = useDraftListActions({
    active: true,
    activeDraftId,
    onOpenDraft,
    onCreateDraft,
    onActiveDraftDeleted: onClose,
  });

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
              onCreateDraft();
              onClose();
            }}
          >
            <Icon name="plus" size={12} />
            New draft
          </Button>
        </div>
      </div>

      {actions.drafts.length === 0 ? (
        <div className="rounded-lg border border-border-subtle bg-bg-elevated p-5">
          <div className="text-sm font-semibold text-text-primary">No drafts yet.</div>
          <div className="mt-1.5 text-sm leading-relaxed text-text-secondary">
            Drafts autosave to your browser. Publishing creates a shareable link; your draft stays here, ready to edit.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {actions.drafts.map((draft) => (
            <DraftRow
              key={draft.id}
              draft={draft}
              isActive={draft.id === activeDraftId}
              isEditing={actions.editingId === draft.id}
              editingTitle={actions.editingTitle}
              onEditingTitleChange={actions.setEditingTitle}
              isConfirmingDelete={actions.confirmDeleteId === draft.id}
              variant="drawer"
              onOpen={() => { actions.onOpen(draft.id); onClose(); }}
              onBeginRename={() => actions.beginRename(draft)}
              onCancelRename={actions.cancelRename}
              onCommitRename={actions.commitRename}
              onDuplicate={() => actions.onDuplicate(draft.id)}
              onDelete={() => actions.onDelete(draft.id)}
              onCancelDeleteConfirm={actions.cancelDelete}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Settings panel
// ---------------------------------------------------------------------------

function SettingsPanel({
  settings,
  onSettingsChange,
  onClose,
  paragraphDimming,
  onParagraphDimmingChange,
}: {
  settings: DocSettings;
  onSettingsChange: (next: DocSettings) => void;
  onClose: () => void;
  paragraphDimming: boolean;
  onParagraphDimmingChange: (v: boolean) => void;
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
      data-settings-panel
      className="absolute right-3 top-full z-(--z-dropdown,20) mt-1.5 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-border-default bg-bg-elevated p-4 shadow-glass animate-dropdown-in sm:right-0"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold">Settings</div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-fill-2/40 hover:text-text-primary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
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

        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Reading typeface
          </div>
          <SegmentedControl
            value={settings.typeface ?? "serif"}
            options={[
              { label: "Serif", value: "serif" },
              { label: "Sans", value: "sans" },
            ]}
            onChange={(v) => onSettingsChange({ ...settings, typeface: v })}
          />
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Page colour
          </div>
          <div className="flex items-center gap-2">
            {THEMES.map((t) => {
              const isSelected = (settings.theme ?? DEFAULT_THEME_ID) === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSettingsChange({ ...settings, theme: t.id })}
                  title={t.name}
                  aria-label={`${t.name} theme${isSelected ? " (selected)" : ""}`}
                  aria-pressed={isSelected}
                  className={[
                    "h-7 w-7 shrink-0 rounded-full transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg-elevated",
                    isSelected
                      ? "ring-2 ring-offset-2 ring-accent ring-offset-bg-elevated"
                      : "ring-1 ring-border-default hover:ring-border-strong",
                  ].join(" ")}
                  style={{ background: t.swatch }}
                />
              );
            })}
          </div>
        </div>

        {/* Local-only editor preference — not part of DocSettings (the
            published-page presentation contract above). Visually separated
            with a top border + its own heading so it doesn't read as
            another published-page field. */}
        <div className="pt-1 border-t border-border-subtle">
          <div className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Focus mode
          </div>
          <div className="mb-1.5 text-xs text-text-secondary">
            Dim inactive paragraphs
          </div>
          <SegmentedControl
            value={paragraphDimming ? "on" : "off"}
            options={[
              { label: "Off", value: "off" },
              { label: "On", value: "on" },
            ]}
            onChange={(v) => onParagraphDimmingChange(v === "on")}
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
      className="group flex items-center gap-1.5 min-w-0 max-w-52 rounded-md px-1.5 py-0.5 transition hover:bg-fill-2/30"
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
// Publish reveal — a brief, terminal-native flash that plays once,
// full-viewport, the moment a draft becomes published: a compact
// "compiling" pulse followed by a success tint, then a fade. The system's
// motion identity is restraint + precision, not a color-mode transformation
// (the "Reveal"-era dark→paper crossfade this replaces) — this keeps the
// same trigger and timing shape, just repainted.
// Timing follows the same FADE_MS = 220 pattern established by AppLoader.
// ---------------------------------------------------------------------------

const REVEAL_COMPILE_MS = 160;
const REVEAL_SUCCESS_MS = 160;
const REVEAL_FADE_MS = 220;

type RevealPhase = "compiling" | "success" | "fading";

function PublishReveal({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<RevealPhase>("compiling");
  // PublishArea re-renders often while this is on screen (toast state,
  // copy-link pulse, the save indicator ticking) and passes a fresh
  // `onDone` closure each time. Reading it via a ref — rather than putting
  // it in the effect's dependency array — keeps this a one-shot timeline
  // that can't be restarted mid-flight by an unrelated parent re-render.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const toSuccess = setTimeout(() => setPhase("success"), REVEAL_COMPILE_MS);
    const toFading = setTimeout(() => setPhase("fading"), REVEAL_COMPILE_MS + REVEAL_SUCCESS_MS);
    const finish = setTimeout(
      () => onDoneRef.current(),
      REVEAL_COMPILE_MS + REVEAL_SUCCESS_MS + REVEAL_FADE_MS,
    );
    return () => {
      clearTimeout(toSuccess);
      clearTimeout(toFading);
      clearTimeout(finish);
    };
    // Run once per mount only — see comment above.
  }, []);

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
      style={{
        backgroundColor: phase === "compiling" ? "var(--color-bg)" : "var(--color-accent-dim)",
        opacity: phase === "fading" ? 0 : 1,
        transition: `opacity ${REVEAL_FADE_MS}ms ease-out, background-color ${REVEAL_SUCCESS_MS}ms ease-out`,
      }}
    >
      {phase !== "fading" && (
        <span className="font-mono text-sm text-text-primary">
          {phase === "compiling" ? "Publishing…" : "Published ✓"}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Publish / post-publish button group
// ---------------------------------------------------------------------------

/** `team:<space id>` publishes into that team space, readable by its members only. */
export type PublishVisibility = "unlisted" | "public" | `team:${string}`;

/**
 * Who can find the page about to be published: a pill showing the current
 * choice, opening the app's own menu with one line of explanation per
 * choice. (It was a native <select>, which could show neither.)
 */
function VisibilityPicker({
  value,
  onChange,
  spaces,
  disabled,
}: {
  value: PublishVisibility;
  onChange: (value: PublishVisibility) => void;
  spaces: { id: string; name: string }[];
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  const options: { value: PublishVisibility; icon: IconName; short: string; label: string; description: string }[] = [
    { value: "unlisted", icon: "link", short: "Unlisted", label: "Unlisted", description: "Anyone with the link. Not on Explore, not in search engines." },
    { value: "public", icon: "eye", short: "Public", label: "Public", description: "Listed on Explore and open to search engines." },
    ...spaces.map((space) => ({
      value: `team:${space.id}` as PublishVisibility,
      icon: "lock" as IconName,
      short: space.name,
      label: `Team only (${space.name})`,
      description: "Members of this space, signed in. Everyone else gets a 404.",
    })),
  ];
  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Who can find this page: ${current.label}`}
        title="Who can find this page"
        data-value={current.value}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 max-w-[7.5rem] sm:max-w-[13rem] items-center gap-1.5 rounded-lg border border-border-default bg-bg px-3 text-xs font-medium text-text-secondary transition hover:border-border-strong hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <span className="shrink-0 text-text-muted">
          <Icon name={current.icon} size={12} />
        </span>
        <span className="truncate">{current.short}</span>
        <span className={`shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}>
          <Icon name="chevron-down" size={10} />
        </span>
      </button>
      <Menu open={open} onClose={close} anchorRef={triggerRef} align="end" widthClass="w-72">
        {options.map((o) => (
          <ContextMenuItem
            key={o.value}
            icon={o.icon}
            label={o.label}
            description={o.description}
            checked={o.value === value}
            onSelect={() => {
              onChange(o.value);
              setOpen(false);
            }}
          />
        ))}
      </Menu>
    </>
  );
}

type Space = { id: string; name: string; slug: string | null; role: "owner" | "editor" | "viewer" };

/** The signed-in user's team spaces, or null until the one request for them returns. */
function useSpaces(enabled: boolean): Space[] | null {
  const [spaces, setSpaces] = useState<Space[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch("/api/teams")
      .then((res) => (res.ok ? res.json() : { teams: [] }))
      .then((data: { teams?: Space[] }) => {
        if (!cancelled) setSpaces(data.teams ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return spaces;
}

function PublishArea({
  status,
  canPublish,
  publishedUrl,
  publishedOwned,
  copyLinkPulse,
  publishVisibility,
  onPublishVisibilityChange,
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
  /** Undefined when signed out: anonymous pages are always unlisted. */
  publishVisibility?: PublishVisibility;
  onPublishVisibilityChange: (v: PublishVisibility) => void;
  onPublish: () => void;
  onUpdatePage: () => void;
  onCopyLink: () => void;
  onOpenPublished: () => void;
}) {
  const isPublishing = status === "publishing";
  const spaces = useSpaces(publishVisibility !== undefined);
  const [showPublishOptions, setShowPublishOptions] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const prevStatusRef = useRef<EditorStatus>(status);
  const publishOptionsTriggerRef = useRef<HTMLButtonElement>(null);

  // Play the reveal only on the transition INTO "published" (not on every
  // render while published, and not on mount if a draft somehow loads
  // already-published) — skip entirely under reduced-motion.
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev !== "published" && status === "published" && !prefersReducedMotion()) {
      setShowReveal(true);
    }
  }, [status]);

  // Post-publish state: show copy + open buttons.
  if (status === "published" && publishedUrl) {
    return (
      <div className="flex items-center gap-1">
        {showReveal && <PublishReveal onDone={() => setShowReveal(false)} />}
        <button
          type="button"
          onClick={onCopyLink}
          title="Copy share link"
          aria-label={publishedOwned ? "Your page · Copy link" : "Copy link"}
          className={[
            "inline-flex items-center gap-1.5 rounded-lg font-semibold transition h-8 px-3.5 text-xs",
            "active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
            publishedOwned
              ? "border border-border-strong text-text-primary bg-fill-2 hover:border-accent hover:bg-fill-2"
              : "border border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary",
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
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary hover:underline underline-offset-3 transition ml-0.5"
          >
            <Icon name="list" size={12} />
            <span className="hidden sm:inline">My pages</span>
          </a>
        )}
        {/* The step after a first publish: somewhere for the team's pages to live. */}
        {publishedOwned && spaces?.length === 0 && (
          <a href={ROUTES.spaces} className="hidden sm:inline text-xs text-text-muted hover:text-text-primary hover:underline underline-offset-3 transition ml-1.5">
            Create a space
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
            aria-label="Update page"
            className="inline-flex items-center gap-1.5 rounded-l-lg h-8 px-3.5 text-xs font-semibold bg-accent text-accent-contrast hover:bg-accent-hover transition active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
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
            ref={publishOptionsTriggerRef}
            type="button"
            title="More publish options"
            disabled={isPublishing}
            onClick={() => setShowPublishOptions((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-r-lg bg-accent text-accent-contrast border-l border-accent-contrast/25 hover:bg-accent-hover transition active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Icon name="chevron-down" size={11} />
          </button>
        </div>
        <Menu
          open={showPublishOptions}
          onClose={() => setShowPublishOptions(false)}
          anchorRef={publishOptionsTriggerRef}
          align="end"
          widthClass="w-64"
        >
          <ContextMenuItem
            icon="plus"
            label="Publish as new page"
            description="Create a separate published URL from this draft"
            onSelect={() => {
              onPublish();
              setShowPublishOptions(false);
            }}
          />
        </Menu>
      </>
    );
  }

  const label = status === "error" ? "Retry" : "Publish";

  return (
    <>
      {publishVisibility ? (
        <VisibilityPicker
          value={publishVisibility}
          onChange={onPublishVisibilityChange}
          spaces={(spaces ?? []).filter((space) => space.role !== "viewer")}
          disabled={isPublishing}
        />
      ) : null}
      <Button variant="primary" size="md" onClick={onPublish} disabled={!canPublish || isPublishing} aria-label={label}>
        {isPublishing ? (
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="animate-spin" aria-hidden>
            <path d="M6.5 1a5.5 5.5 0 1 0 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ) : (
          <Icon name="upload" size={13} />
        )}
        <span className="hidden sm:inline">{label}</span>
      </Button>
    </>
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
      <span className="hidden sm:inline text-xs font-medium text-warning">
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- an empty or invalid slug resets the check at once; the debounced request is for a valid one
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
        const body = await res.json().catch(() => ({})) as { detail?: string };
        throw new Error(body.detail ?? "Failed to save");
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
      : "booklet.page";

  const canSave =
    draft.trim().length > 0 &&
    !saving &&
    availability !== "taken" &&
    availability !== "checking";

  return (
    <div className="absolute top-full left-0 right-0 z-10 border-b border-border-default/50 bg-bg-soft/95 backdrop-blur-xl px-3 py-2.5 animate-dropdown-in">
      <div className="mx-auto w-full max-w-7xl flex flex-col sm:flex-row sm:items-center gap-2">
        <span className="text-xs text-text-secondary shrink-0">
          Set a custom URL before sharing:
        </span>
        <div className="flex items-center gap-0 min-w-0 flex-1">
          <span className="text-xs text-text-muted px-2 py-1 bg-bg border border-r-0 border-border-default rounded-l-md whitespace-nowrap hidden sm:inline">
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
              "min-w-0 flex-1 sm:w-52 sm:flex-none px-2 py-1 text-xs bg-bg border rounded-md sm:rounded-l-none sm:rounded-r-md text-text-primary placeholder:text-text-muted",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft",
              "transition-colors duration-fast",
              availability === "taken" ? "border-danger/60" : "border-border-default",
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
            <span key="available" className="text-xs text-success animate-fade-in">✓ Available</span>
          )}
          {availability === "taken" && !error && (
            <span key="taken" className="text-xs text-danger animate-fade-in">✗ Taken</span>
          )}
          {error && <span key="error" className="text-xs text-danger animate-fade-in">{error}</span>}
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
  publishVisibility,
  onPublishVisibilityChange,
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
  focusMode = false,
  onToggleFocusMode,
  paragraphDimming,
  onParagraphDimmingChange,
}: {
  status: EditorStatus;
  canPublish: boolean;
  raw: string;
  draftTitle: string;
  onNew: () => void;
  onRenameCurrentDraft: (next: string) => void;
  activeDraftId: string | null;
  onSwitchDraft: (id: string) => void;
  onCreateDraft: () => string;
  onPublish: () => void;
  publishVisibility: PublishVisibility;
  onPublishVisibilityChange: (v: PublishVisibility) => void;
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
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
  paragraphDimming: boolean;
  onParagraphDimmingChange: (v: boolean) => void;
}) {
  const router = useRouter();
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
    } catch (e) {
      toast.error("Copy failed", toErrorMessage(e));
    }
  }, [raw, toast]);

  const onCopyHtml = useCallback(async () => {
    try {
      const html = await markdownToHtml(raw ?? "");
      await copyTextToClipboard(html);
      toast.showCoalesced(TOAST_KEYS.copyHtml, "success", "Copied", "HTML copied.");
    } catch (e) {
      toast.error("Copy failed", toErrorMessage(e));
    }
  }, [raw, toast]);

  const openImportPicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const [importUrlOpen, setImportUrlOpen] = useState(false);
  const onUrlImported = useCallback((title: string, text: string) => {
    onImportMarkdown(title, text);
    setVisibleDrafts(false);
    setVisibleMoreActions(false);
    toast.showCoalesced(TOAST_KEYS.importMd, "success", "Imported", "Draft created from the linked file.");
  }, [onImportMarkdown, toast]);

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

  const { isSignedIn } = useSession();

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
        { label: "Import from URL", detail: "Create a draft from a Markdown file on GitHub.", icon: "import", onClick: () => setImportUrlOpen(true) },
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
        { label: "Go to homepage", detail: "Return to Booklet's public page.", icon: "home", onClick: () => router.push("/") },
      ],
    },
  ];

  return (
    <header id="header" className="sticky top-0 z-20 border-b border-border-default bg-bg-glass backdrop-blur-md">
      <div className="flex h-12 w-full items-center gap-2 px-3">

        {/* ── Left zone ── clipped: on a phone the title has almost no room, and its
            rename icon must not spill over the buttons to its right. */}
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <AppLogo onlyIcon={true} />
          <div className="h-4 w-px bg-fill-2 shrink-0" />
          <DraftTitle title={draftTitle} onRename={onRenameCurrentDraft} />
        </div>

        {/* ── Right zone ── */}
        <div className="flex items-center gap-1.5 shrink-0">
          <SaveIndicator
            saveState={saveState}
            lastSavedAtLabel={lastSavedAtLabel}
            showSaveWarning={showSaveWarning}
          />

          {/* Divider only visible when SaveIndicator shows (sm+) */}
          <div className="hidden sm:block mx-1 h-4 w-px bg-fill-2" />

          <IconBtn
            label="More options"
            icon="dots"
            onClick={() => setVisibleMoreActions(true)}
            active={visibleMoreActions}
          />

          {onToggleFocusMode && (
            <IconBtn
              label={focusMode ? "Exit focus mode (⌘.)" : "Focus mode (⌘.)"}
              icon={focusMode ? "eye" : "eye-off"}
              onClick={onToggleFocusMode}
              active={focusMode}
            />
          )}

          {/* Below sm the panel hangs from the header: the gear sits mid-bar, and a
              panel anchored to it runs off the left edge of a phone. */}
          <div className="sm:relative">
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
                paragraphDimming={paragraphDimming}
                onParagraphDimmingChange={onParagraphDimmingChange}
              />
            ) : null}
          </div>

          {/* ── Auth ── */}
          {isSignedIn ? (
            <AccountMenu />
          ) : (
            <Button variant="secondary" size="sm" href={ROUTES.signIn}>
              Sign in
            </Button>
          )}

          <div className="mx-1 h-4 w-px bg-fill-2" />

          <PublishArea
            status={status}
            canPublish={canPublish}
            publishedUrl={publishedUrl ?? null}
            publishedOwned={publishedOwned ?? false}
            copyLinkPulse={copyLinkPulse ?? false}
            publishVisibility={isSignedIn ? publishVisibility : undefined}
            onPublishVisibilityChange={onPublishVisibilityChange}
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

      <ImportUrlDialog open={importUrlOpen} onClose={() => setImportUrlOpen(false)} onImported={onUrlImported} />

      <MoreActionsDrawer
        open={visibleMoreActions}
        sections={actionSections}
        activeDraftId={activeDraftId}
        onCreateDraft={onCreateDraft}
        onOpenDraft={onSwitchDraft}
        onRequestImportMarkdown={openImportPicker}
        onSelectTemplate={(template) => onInsertTemplate?.(template.name, templateMarkdown(template))}
        onClose={() => setVisibleMoreActions(false)}
      />

      {/* Post-publish sign-in nudge — shown for anonymous publishes */}
      {status === "published" && !publishedOwned && !isSignedIn ? (
        <div className="border-t border-border-strong bg-fill-2/60 backdrop-blur-xl px-3 py-2">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
            <p className="text-xs text-text-secondary">
              <span className="font-semibold text-text-primary">This page is kept for 90 days.</span>
              {" "}Sign in (free) and claim it to keep it, edit it in place and track views.
            </p>
            <Button
              variant="primary"
              size="sm"
              href={publishedId ? `${ROUTES.signIn}?redirect_url=${encodeURIComponent(`/p/${publishedId}`)}` : ROUTES.signIn}
              className="shrink-0"
            >
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
            <div className="flex items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/8 px-3 py-2">
              <span className="text-xs text-warning">
                Couldn&apos;t save — browser storage may be full.
              </span>
              <button
                type="button"
                onClick={() => void onCopyMarkdown()}
                className="text-xs font-semibold text-warning underline underline-offset-2 transition hover:text-warning"
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
          onSwitchDraft(id);
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
