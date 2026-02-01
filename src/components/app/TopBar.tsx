"use client";

import ThemeToggle from "@/components/ui/ThemeToggle";
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
  copyLinkPulse,
}: {
  status: "idle" | "typing" | "publishing" | "published" | "error";
  canPublish: boolean;
  onNew: () => void;
  onPublish: () => void;
  onCopyLink: () => void;
  hasLink: boolean;
  copyLinkPulse?: boolean;
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

  const copyBtnClass = [
    "min-w-fit uppercase tracking-wide",
    copyLinkPulse
      ? "animate-pulse ring-2 ring-accent-soft ring-offset-2 ring-offset-bg rounded-full"
      : "",
  ].join(" ");

  return (
    <div className="sticky top-0 z-20 border-b border-outline bg-bg-glass/85 backdrop-blur">
      <div className="mx-auto w-full max-w-6xl px-4 py-3 flex items-center justify-between">
        <div className="leading-tight uppercase">
          <Link href={ROUTES.home}>
            <div className="font-semibold tracking-wide">{APP_NAME}</div>
          </Link>
          <div className="hidden sm:inline-flex text-xs text-[rgb(var(--muted))] tracking-widest">
            Paste. Preview. Share.
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Tag
            className="hidden md:block"
            value={statusLabel}
            severity={severity as any}
            rounded
          />
          <div className="hidden md:inline-flex">
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
          </div>
          <div className="md:hidden">
            <Button
              aria-label="New"
              icon="pi pi-plus"
              severity="secondary"
              onClick={onNew}
              className="min-w-fit"
              size="small"
              text
              raised
            />
          </div>
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

          {hasLink ? (
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
          ) : null}

          {hasLink ? (
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
          ) : null}

          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
