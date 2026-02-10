"use client";

import { trackEvent } from "@/lib/analytics";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { DocSettings } from "@/lib/blocks";
import { UI } from "@/lib/constants";
import { copyTextToClipboard, markdownToHtml } from "@/lib/export";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { Menubar } from "primereact/menubar";
import { Tag } from "primereact/tag";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppLogo } from "../ui/AppLogo";
import ThemeToggle from "../ui/ThemeToggle";
import { useToast } from "../ui/ToastProvider";
import { DraftsDialog } from "./DraftsDialog";

type EditorStatus = "idle" | "typing" | "publishing" | "published" | "error";
export type SaveState = "saved" | "saving";

const LABELS = {
  file: "File",
  newDraft: "New",
  myDrafts: "My drafts",
  importMarkdown: "Import Markdown",
  copyAs: "Copy as",
  copyAsMarkdown: "Markdown",
  copyAsHtml: "HTML",
  insertSample: "Insert sample",
  quit: "Quit",
  edit: "Edit",
  settings: "Settings",
  appSettings: "App Settings",
  done: "Done",

  saveSaved: "Saved",
  saveSaving: "Saving…",
  saveSavedAt: "Saved at",

  saveWarning: "Could not save locally. Your browser storage may be full.",
  saveWarningAction: "Export Markdown",

  publish: "Publish",
  retryPublish: "Retry",
  publishing: "Publishing",
  copyLink: "Copy link",
  open: "Open",
} as const;

const SAVE_SEVERITY: Record<SaveState, "success" | "warning"> = {
  saved: "success",
  saving: "warning",
} as const;

const TOAST_KEYS = {
  copyMd: "copy_md",
  copyHtml: "copy_html",
  importMd: "import_md",
} as const;

export function TopBar({
  status,
  canPublish,
  raw,
  onNew,
  activeDraftId,
  onSwitchDraft,
  onCreateDraft,
  onPublish,
  onCopyLink,
  onOpenPublished,
  publishedUrl,
  copyLinkPulse,
  confidenceValue,
  onConfidenceValueChange,
  onInsertSample,
  saveState,
  lastSavedAtLabel,
  showSaveWarning,
  onImportMarkdown,
}: {
  status: EditorStatus;
  canPublish: boolean;
  raw: string;
  onNew: () => void;
  activeDraftId: string | null;
  onSwitchDraft: (id: string, origin?: "drafts_dialog") => void;
  onCreateDraft: (origin?: "drafts_dialog") => string;
  onPublish: () => void;
  onCopyLink: () => void;
  onOpenPublished: () => void;
  publishedUrl: string | null;
  copyLinkPulse?: boolean;
  confidenceValue: DocSettings;
  onConfidenceValueChange: (next: DocSettings) => void;
  onInsertSample: () => void;
  saveState: SaveState;
  lastSavedAtLabel?: string | null;
  showSaveWarning?: boolean;
  onImportMarkdown: (title: string, raw: string) => void;
}) {
  const [visibleSettings, setVisibleSettings] = useState(false);
  const [visibleDrafts, setVisibleDrafts] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toast = useToast();

  const saveLabel = useMemo(() => {
    if (saveState === "saving") return LABELS.saveSaving;
    if (lastSavedAtLabel?.trim())
      return `${LABELS.saveSavedAt} ${lastSavedAtLabel}`;
    return LABELS.saveSaved;
  }, [lastSavedAtLabel, saveState]);

  const onCopyMarkdown = async () => {
    try {
      await copyTextToClipboard(raw ?? "");
      toast.showCoalesced(
        TOAST_KEYS.copyMd,
        "success",
        "Copied",
        "Markdown copied.",
      );

      trackEvent(ANALYTICS_EVENTS.export_copy_markdown, {
        raw_len: (raw ?? "").length,
      });
    } catch (e) {
      toast.error("Copy failed", toErrorMessage(e));
    }
  };

  const onCopyHtml = async () => {
    try {
      const html = markdownToHtml(raw ?? "");
      await copyTextToClipboard(html);
      toast.showCoalesced(
        TOAST_KEYS.copyHtml,
        "success",
        "Copied",
        "HTML copied.",
      );

      trackEvent(ANALYTICS_EVENTS.export_copy_html, {
        raw_len: (raw ?? "").length,
        html_len: html.length,
      });
    } catch (e) {
      toast.error("Copy failed", toErrorMessage(e));
    }
  };

  const openImportPicker = () => {
    fileInputRef.current?.click();
  };

  const onFilePicked = async (file: File | null) => {
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

      toast.showCoalesced(
        TOAST_KEYS.importMd,
        "success",
        "Imported",
        "Draft created from Markdown.",
      );
    } catch (e) {
      toast.error("Import failed", toErrorMessage(e));
    } finally {
      // Allow picking the same file again.
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const shouldClose = visibleDrafts || visibleSettings;
      if (!shouldClose) return;

      e.preventDefault();
      if (visibleDrafts) setVisibleDrafts(false);
      if (visibleSettings) setVisibleSettings(false);

      const el = document.activeElement as HTMLElement | null;
      el?.blur?.();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visibleDrafts, visibleSettings]);

  const SPACING = [
    { label: "Compact spacing", value: "compact" as const },
    { label: "Comfortable spacing", value: "comfortable" as const },
  ];

  const WIDTH = [
    { label: "Normal width", value: "normal" as const },
    { label: "Wide width", value: "wide" as const },
  ];

  const CODE = [
    { label: "Show code", value: "show" as const },
    { label: "Collapse long code", value: "collapse" as const },
  ];

  const statusLabel =
    status === "idle"
      ? "Ready"
      : status === "typing"
        ? "Updating preview"
        : status === "publishing"
          ? LABELS.publishing
          : status === "published"
            ? "Published"
            : "Something went wrong";

  const severity =
    status === "published" ? "success" : status === "error" ? "danger" : "info";

  const copyBtnClass = [
    "min-w-fit uppercase tracking-wide transition",
    copyLinkPulse
      ? "animate-pulse ring-2 ring-accent-soft ring-offset-2 ring-offset-bg rounded-full"
      : "",
  ].join(" ");

  const publishLabel =
    status === "error" ? LABELS.retryPublish : LABELS.publish;
  const publishIcon =
    status === "publishing" ? "pi pi-spinner pi-spin" : "pi pi-upload";

  const items = [
    {
      label: LABELS.file,
      items: [
        {
          label: LABELS.newDraft,
          command: () => onNew(),
          shortcut: "⌘+B",
        },
        {
          label: LABELS.myDrafts,
          command: () => setVisibleDrafts(true),
        },
        {
          label: LABELS.importMarkdown,
          icon: "pi pi-file-import",
          command: () => openImportPicker(),
        },
        {
          label: LABELS.copyAs,
          items: [
            {
              label: LABELS.copyAsMarkdown,
              icon: "pi pi-file",
              command: () => void onCopyMarkdown(),
            },
            {
              label: LABELS.copyAsHtml,
              icon: "pi pi-code",
              command: () => void onCopyHtml(),
            },
          ],
        },
        { separator: true },
        { label: LABELS.quit, url: "/" },
      ],
    },
    {
      label: LABELS.edit,
      items: [
        {
          label: LABELS.insertSample,
          command: () => onInsertSample(),
        },
      ],
    },
    { label: LABELS.settings, command: () => setVisibleSettings(true) },
  ];

  const start = <AppLogo onlyIcon={true} />;

  const end = (
    <div className="flex items-center gap-1">
      <Tag
        className="hidden md:block"
        value={statusLabel}
        severity={severity as never}
        rounded
      />

      <div aria-live="polite" className="hidden md:block">
        <Tag
          value={saveLabel}
          severity={SAVE_SEVERITY[saveState] as never}
          rounded
        />
      </div>

      {showSaveWarning ? (
        <div className="hidden lg:flex items-center gap-2 ml-1">
          <Tag
            value="Save issue"
            severity={"danger" as never}
            className="uppercase"
            rounded
          />
          <Button
            label={LABELS.saveWarningAction}
            icon="pi pi-file"
            severity="secondary"
            size="small"
            onClick={() => void onCopyMarkdown()}
            className="min-w-fit uppercase tracking-wide"
            text
            raised
          />
        </div>
      ) : null}

      <>
        {publishedUrl ? (
          <>
            <div className="hidden md:inline-flex">
              <Button
                label={LABELS.copyLink}
                icon="pi pi-copy"
                severity="secondary"
                onClick={onCopyLink}
                className={copyBtnClass}
                size="small"
                text
                raised
              />
            </div>
            <div className="md:hidden">
              <Button
                aria-label={LABELS.copyLink}
                icon="pi pi-copy"
                severity="secondary"
                onClick={onCopyLink}
                className={copyBtnClass}
                size="small"
                text
                raised
              />
            </div>

            <div className="hidden md:inline-flex">
              <Button
                label={LABELS.open}
                icon="pi pi-external-link"
                severity="secondary"
                onClick={onOpenPublished}
                className="min-w-fit uppercase tracking-wide"
                size="small"
                text
                raised
              />
            </div>
            <div className="md:hidden">
              <Button
                aria-label={LABELS.open}
                icon="pi pi-external-link"
                severity="secondary"
                onClick={onOpenPublished}
                className="min-w-fit"
                size="small"
                text
                raised
              />
            </div>
          </>
        ) : (
          <>
            <div className="hidden md:inline-flex">
              <Button
                label={publishLabel}
                icon={publishIcon}
                onClick={onPublish}
                disabled={!canPublish || status === "publishing"}
                className="min-w-fit uppercase tracking-wide"
                size="small"
                severity="success"
                text
                raised
              />
            </div>
            <div className="md:hidden">
              <Button
                aria-label={publishLabel}
                icon={publishIcon}
                onClick={onPublish}
                disabled={!canPublish || status === "publishing"}
                className="min-w-fit"
                size="small"
                severity="success"
                text
                raised
              />
            </div>
          </>
        )}
      </>
    </div>
  );

  const settingsFooter = (
    <Button
      label={LABELS.done}
      text
      onClick={() => {
        if (!visibleSettings) return;
        setVisibleSettings(false);
      }}
      className="p-button-text uppercase w-full"
    />
  );

  return (
    <header id="header" className="sticky top-0 z-20">
      <Menubar
        model={items}
        start={start}
        end={end}
        className="mx-auto w-full max-w-7xl bg-bg-glass/85! backdrop-blur!"
      />

      {/* Hidden file input to keep imports local and client-only */}
      <input
        ref={fileInputRef}
        type="file"
        accept={UI.importMarkdown.accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          void onFilePicked(file);
        }}
      />

      {showSaveWarning ? (
        <div className="mx-auto w-full max-w-7xl px-3 pt-2 lg:hidden">
          <div className="rounded-xl border border-[rgb(var(--border))] bg-bg-glass/50 p-3 flex flex-col gap-2">
            <div className="text-sm">{LABELS.saveWarning}</div>
            <div className="flex items-center gap-2">
              <Button
                label={LABELS.saveWarningAction}
                icon="pi pi-file"
                severity="secondary"
                size="small"
                onClick={() => void onCopyMarkdown()}
                className="uppercase"
                outlined
              />
            </div>
          </div>
        </div>
      ) : null}

      <DraftsDialog
        visible={visibleDrafts}
        activeDraftId={activeDraftId}
        onCreateDraft={onCreateDraft}
        onRequestImportMarkdown={() => openImportPicker()}
        onOpenDraft={(id) => {
          onSwitchDraft(id, "drafts_dialog");
          setVisibleDrafts(false);
        }}
        onHide={() => setVisibleDrafts(false)}
      />

      <Dialog
        header={LABELS.appSettings}
        visible={visibleSettings}
        className="w-[75vw] md:w-[50vw]"
        footer={settingsFooter}
        onHide={() => {
          if (!visibleSettings) return;
          setVisibleSettings(false);
        }}
      >
        <div className="p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="text-sm uppercase">Theme</div>
            <ThemeToggle />
          </div>

          <div className="flex flex-col gap-1">
            <div className="text-sm uppercase">Letter Spacing</div>
            <Dropdown
              value={confidenceValue.spacing}
              onChange={(e) =>
                onConfidenceValueChange({
                  ...confidenceValue,
                  spacing: e.value,
                })
              }
              options={SPACING}
              placeholder="Select spacing"
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="text-sm uppercase">Width</div>
            <Dropdown
              value={confidenceValue.width}
              onChange={(e) =>
                onConfidenceValueChange({
                  ...confidenceValue,
                  width: e.value,
                })
              }
              options={WIDTH}
              placeholder="Select width"
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="text-sm uppercase">Code blocks</div>
            <Dropdown
              value={confidenceValue.code}
              onChange={(e) =>
                onConfidenceValueChange({
                  ...confidenceValue,
                  code: e.value,
                })
              }
              options={CODE}
              placeholder="Select code mode"
              className="w-full"
            />
          </div>
        </div>
      </Dialog>
    </header>
  );
}

function toErrorMessage(e: unknown) {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
