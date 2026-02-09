"use client";

import { trackEvent } from "@/lib/analytics";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { DocSettings } from "@/lib/blocks";
import { copyTextToClipboard, markdownToHtml } from "@/lib/export";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { Menubar } from "primereact/menubar";
import { Tag } from "primereact/tag";
import { useState } from "react";
import { AppLogo } from "../ui/AppLogo";
import ThemeToggle from "../ui/ThemeToggle";
import { useToast } from "../ui/ToastProvider";
import { DraftsDialog } from "./DraftsDialog";

type EditorStatus = "idle" | "typing" | "publishing" | "published" | "error";
export type SaveState = "saved" | "saving";

const SAVE_LABEL: Record<SaveState, string> = {
  saved: "Saved",
  saving: "Saving…",
} as const;

const SAVE_SEVERITY: Record<SaveState, "success" | "warning"> = {
  saved: "success",
  saving: "warning",
} as const;

const TOPBAR_LABELS = {
  file: "File",
  newDraft: "New",
  myDrafts: "My drafts",
  copyAs: "Copy as",
  copyAsMarkdown: "Markdown",
  copyAsHtml: "HTML",
  insertSample: "Insert sample",
  quit: "Quit",
  edit: "Edit",
  settings: "Settings",
  appSettings: "App Settings",
  done: "Done",
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
}) {
  const [visibleSettings, setVisibleSettings] = useState(false);
  const [visibleDrafts, setVisibleDrafts] = useState(false);
  const toast = useToast();

  const onCopyMarkdown = async () => {
    try {
      await copyTextToClipboard(raw ?? "");
      toast.success("Copied", "Markdown copied to clipboard.");

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
      toast.success("Copied", "HTML copied to clipboard.");

      trackEvent(ANALYTICS_EVENTS.export_copy_html, {
        raw_len: (raw ?? "").length,
        html_len: html.length,
      });
    } catch (e) {
      toast.error("Copy failed", toErrorMessage(e));
    }
  };

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
          ? "Publishing"
          : status === "published"
            ? "Published"
            : "Something went wrong";

  const severity =
    status === "published" ? "success" : status === "error" ? "danger" : "info";

  const copyBtnClass = [
    "min-w-fit uppercase tracking-wide",
    copyLinkPulse
      ? "animate-pulse ring-2 ring-accent-soft ring-offset-2 ring-offset-bg rounded-full"
      : "",
  ].join(" ");

  const items = [
    {
      label: TOPBAR_LABELS.file,
      items: [
        {
          label: TOPBAR_LABELS.newDraft,
          command: () => onNew(),
          shortcut: "⌘+B",
        },
        {
          label: TOPBAR_LABELS.myDrafts,
          command: () => setVisibleDrafts(true),
        },
        {
          label: TOPBAR_LABELS.copyAs,
          items: [
            {
              label: TOPBAR_LABELS.copyAsMarkdown,
              icon: "pi pi-file",
              command: () => void onCopyMarkdown(),
            },
            {
              label: TOPBAR_LABELS.copyAsHtml,
              icon: "pi pi-code",
              command: () => void onCopyHtml(),
            },
          ],
        },
        { seperator: true },
        { label: TOPBAR_LABELS.quit, url: "/" },
      ],
    },
    {
      label: TOPBAR_LABELS.edit,
      items: [
        {
          label: TOPBAR_LABELS.insertSample,
          command: () => onInsertSample(),
        },
      ],
    },
    { label: TOPBAR_LABELS.settings, command: () => setVisibleSettings(true) },
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

      <Tag
        className="hidden md:block"
        value={SAVE_LABEL[saveState]}
        severity={SAVE_SEVERITY[saveState] as never}
        rounded
      />

      <>
        {publishedUrl ? (
          <>
            <div className="hidden md:inline-flex">
              <Button
                label="Copy link"
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
                aria-label="Copy link"
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
                label="Open"
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
                aria-label="Open"
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
                label="Publish"
                icon="pi pi-upload"
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
                aria-label="Publish"
                icon="pi pi-upload"
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
      label={TOPBAR_LABELS.done}
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

      <DraftsDialog
        visible={visibleDrafts}
        activeDraftId={activeDraftId}
        onCreateDraft={onCreateDraft}
        onOpenDraft={(id) => {
          onSwitchDraft(id, "drafts_dialog");
          setVisibleDrafts(false);
        }}
        onHide={() => setVisibleDrafts(false)}
      />

      <Dialog
        header={TOPBAR_LABELS.appSettings}
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
