"use client";

import { APP_NAME, ROUTES } from "@/lib/constants";
import Link from "next/link";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";

export function TopBar({
  status,
  canPublish,
  onNew,
  onPublish,
  onCopyLink,
  hasLink,
}: {
  status: "idle" | "typing" | "publishing" | "published" | "error";
  canPublish: boolean;
  onNew: () => void;
  onPublish: () => void;
  onCopyLink: () => void;
  hasLink: boolean;
}) {
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

  return (
    <div className="sticky top-0 z-20 border-b border-outline bg-bg-glass/85 backdrop-blur">
      <div className="w-[90vw] mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 w-[90vw]">
          <div className="leading-tight uppercase">
            <Link href={ROUTES.home}>
              <div className="font-semibold tracking-wide">{APP_NAME}</div>
            </Link>
            <div className="text-xs text-[rgb(var(--muted))] tracking-widest">
              Paste. Preview. Share.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tag
            className="hidden md:block"
            value={statusLabel}
            severity={severity as any}
            rounded
          />
          <Button
            label="New"
            icon="pi pi-plus"
            severity="secondary"
            onClick={onNew}
            className="min-w-fit uppercase tracking-wide"
            size="small"
            text
            raised
          />
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
          {hasLink ? (
            <Button
              label="Copy link"
              icon="pi pi-copy"
              severity="secondary"
              onClick={onCopyLink}
              className="min-w-fit uppercase tracking-wide"
              size="small"
              text
              raised
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
