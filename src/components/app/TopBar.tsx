"use client";

import { DocSettings } from "@/lib/blocks";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { Menubar } from "primereact/menubar";
import { Tag } from "primereact/tag";
import { useState } from "react";
import { AppLogo } from "../ui/AppLogo";
import ThemeToggle from "../ui/ThemeToggle";

export function TopBar({
  status,
  canPublish,
  onNew,
  onPublish,
  onCopyLink,
  hasLink,
  copyLinkPulse,
  confidenceValue,
  onConfidenceValueChange,
  onInsertSample,
}: {
  status: "idle" | "typing" | "publishing" | "published" | "error";
  canPublish: boolean;
  onNew: () => void;
  onPublish: () => void;
  onCopyLink: () => void;
  hasLink: boolean;
  copyLinkPulse?: boolean;
  confidenceValue: DocSettings;
  onConfidenceValueChange: (next: DocSettings) => void;
  onInsertSample: () => void;
}) {
  const [visibleSettings, setVisibleSettings] = useState(false);

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
      label: "File",
      items: [
        {
          label: "New",
          command: () => onNew(),
          shortcut: "⌘+B",
        },
        {
          label: "Insert sample",
          command: () => onInsertSample(),
        },
        { label: "Quit", url: "/" },
      ],
    },
    { label: "Settings", command: () => setVisibleSettings(true) },
  ];

  const start = <AppLogo onlyIcon={true} />;

  const end = (
    <div className="flex items-center gap-1">
      <Tag
        className="hidden md:block"
        value={statusLabel}
        severity={severity as any}
        rounded
      />

      {hasLink ? (
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
              icon="pi pi-copy"
              severity="secondary"
              onClick={onCopyLink}
              className={copyBtnClass}
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
    </div>
  );

  const settingsFooter = (
    <Button
      label="Done"
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
        className="mx-auto w-full max-w-7xl"
      />

      <Dialog
        header="App Settings"
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
              options={SPACING}
              onChange={(e) =>
                onConfidenceValueChange({
                  ...confidenceValue,
                  spacing: e.value,
                })
              }
              className="w-full"
              checkmark={true}
              highlightOnSelect={true}
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="text-sm uppercase">Block Width</div>
            <Dropdown
              value={confidenceValue.width}
              options={WIDTH}
              onChange={(e) =>
                onConfidenceValueChange({ ...confidenceValue, width: e.value })
              }
              className="w-full"
              checkmark={true}
              highlightOnSelect={true}
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="text-sm uppercase">Code Blocks</div>
            <Dropdown
              value={confidenceValue.code}
              options={CODE}
              onChange={(e) =>
                onConfidenceValueChange({ ...confidenceValue, code: e.value })
              }
              className="w-full"
              checkmark={true}
              highlightOnSelect={true}
            />
          </div>
        </div>
      </Dialog>
    </header>
  );
}
