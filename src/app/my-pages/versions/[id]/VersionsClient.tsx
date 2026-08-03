"use client";

import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { PublishedDoc } from "@/lib/blocks";
import { formatUpdatedAtLong, formatUpdatedAtLongUTC } from "@/lib/ui/time";
import { useEffect, useState } from "react";

type VersionItem = {
  version_number: number;
  created_at: string;
  size_bytes: number;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}

export function VersionsClient({
  pageId,
  versions,
}: {
  pageId: string;
  versions: VersionItem[];
}) {
  const [preview, setPreview] = useState<{ version: number; doc: PublishedDoc } | null>(null);
  const [loadingVersion, setLoadingVersion] = useState<number | null>(null);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // This page is server-rendered then hydrated, and `version.created_at`
  // comes straight from a server-fetched prop — formatting it with the
  // ambient (locale AND timezone) rules on both sides risks the server and
  // the visitor's browser disagreeing, a React hydration mismatch. Render
  // the timezone-pinned, deterministic form until mounted, then upgrade to
  // the visitor's own local time — see formatUpdatedAtLongUTC's doc comment.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function loadVersion(version: number): Promise<PublishedDoc> {
    const res = await fetch(`/api/pages/${pageId}/versions/${version}`);
    if (!res.ok) throw new Error(`Could not load v${version}`);
    const body = (await res.json()) as { doc: PublishedDoc };
    return body.doc;
  }

  async function previewVersion(version: number) {
    setLoadingVersion(version);
    setError(null);
    try {
      const doc = await loadVersion(version);
      setPreview({ version, doc });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load version");
    } finally {
      setLoadingVersion(null);
    }
  }

  async function restoreVersion(version: number) {
    setRestoringVersion(version);
    setError(null);
    try {
      const doc = await loadVersion(version);
      const res = await fetch(`/api/publish/${pageId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          blocks: doc.blocks,
          settings: doc.settings,
          raw: doc.raw,
        }),
      });
      if (!res.ok) throw new Error(`Could not restore v${version}`);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not restore version");
      setRestoringVersion(null);
    }
  }

  return (
    <>
      {error ? (
        <div className="mb-4 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border-default bg-bg-elevated">
        {versions.length > 0 ? (
          versions.map((version, index) => (
            <div
              key={version.version_number}
              className={[
                "flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                index > 0 ? "border-t border-border-default" : "",
              ].join(" ")}
            >
              <div>
                <div className="text-sm font-semibold text-text-primary">v{version.version_number}</div>
                <div className="mt-0.5 text-xs text-text-muted">
                  {mounted ? formatUpdatedAtLong(version.created_at) : formatUpdatedAtLongUTC(version.created_at)} ·{" "}
                  {formatBytes(version.size_bytes)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => void previewVersion(version.version_number)}
                  disabled={loadingVersion === version.version_number || restoringVersion !== null}
                >
                  {loadingVersion === version.version_number ? (
                    <Icon name="spinner" size={12} className="animate-spin" />
                  ) : (
                    <Icon name="eye" size={12} />
                  )}
                  Preview
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => void restoreVersion(version.version_number)}
                  disabled={restoringVersion !== null}
                >
                  {restoringVersion === version.version_number ? (
                    <Icon name="spinner" size={12} className="animate-spin" />
                  ) : (
                    <Icon name="history" size={12} />
                  )}
                  Restore
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="px-4 py-10 text-sm text-text-muted">
            No versions have been captured for this page yet.
          </div>
        )}
      </div>

      {preview ? (
        <div className="fixed inset-0 z-40 bg-black/45 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="mx-auto flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border-default bg-bg shadow-glass">
            <div className="flex items-center justify-between gap-3 border-b border-border-default px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Preview v{preview.version}</div>
                <div className="text-xs text-text-muted">This is a saved snapshot.</div>
              </div>
              <Button variant="ghost" size="md" iconOnly onClick={() => setPreview(null)} aria-label="Close preview">
                <Icon name="close" size={14} />
              </Button>
            </div>
            <div className="overflow-auto px-5 py-5">
              <BlockRenderer blocks={preview.doc.blocks} settings={preview.doc.settings} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
