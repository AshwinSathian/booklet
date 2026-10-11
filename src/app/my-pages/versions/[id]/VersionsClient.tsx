"use client";

import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { PublishedDoc } from "@/lib/blocks";
import { diffLines, type DiffLine } from "@/lib/line-diff";
import { formatUpdatedAtLong, formatUpdatedAtLongUTC } from "@/lib/ui/time";
import { useState } from "react";
import { useHydrated } from "@/lib/ui/hydration";

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
  const [confirmingVersion, setConfirmingVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // `versions` is newest first: compare the one before the latest with the latest.
  const [fromVersion, setFromVersion] = useState(versions[1]?.version_number ?? 0);
  const [toVersion, setToVersion] = useState(versions[0]?.version_number ?? 0);
  const [comparing, setComparing] = useState(false);
  const [diff, setDiff] = useState<{ from: number; to: number; lines: DiffLine[] } | null>(null);
  const latestVersion = versions[0]?.version_number ?? 0;
  // This page is server-rendered then hydrated, and `version.created_at`
  // comes straight from a server-fetched prop — formatting it with the
  // ambient (locale AND timezone) rules on both sides risks the server and
  // the visitor's browser disagreeing, a React hydration mismatch. Render
  // the timezone-pinned, deterministic form until mounted, then upgrade to
  // the visitor's own local time — see formatUpdatedAtLongUTC's doc comment.
  const mounted = useHydrated();

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

  /** Line diff of the stored Markdown, frontmatter included. */
  async function compareVersions() {
    setComparing(true);
    setError(null);
    try {
      const [from, to] = await Promise.all([loadVersion(fromVersion), loadVersion(toVersion)]);
      if (typeof from.raw !== "string" || typeof to.raw !== "string") {
        throw new Error("One of these versions was saved before Booklet kept the Markdown source, so it cannot be compared.");
      }
      setDiff({ from: fromVersion, to: toVersion, lines: diffLines(from.raw, to.raw) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not compare versions");
    } finally {
      setComparing(false);
    }
  }

  async function restoreVersion(version: number) {
    setRestoringVersion(version);
    setConfirmingVersion(null);
    setError(null);
    try {
      const doc = await loadVersion(version);
      if (!doc.raw) throw new Error(`v${version} was saved before Booklet kept the Markdown source, so it cannot be restored.`);
      // The same route as an edit: the server rebuilds the blocks, title,
      // document type, frontmatter fields and links from the Markdown.
      const res = await fetch(`/api/publish/${pageId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ settings: doc.settings, raw: doc.raw }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? `Could not restore v${version}`);
      }
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not restore version");
      setRestoringVersion(null);
    }
  }

  return (
    <>
      {error ? (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {versions.length > 1 ? (
        <section aria-label="Compare versions" className="mb-6 rounded-xl border border-border-default bg-bg-elevated px-5 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1 text-xs text-text-secondary">
              <label htmlFor="diff-from">From</label>
              <select
                id="diff-from"
                value={fromVersion}
                onChange={(e) => setFromVersion(Number(e.target.value))}
                className="field"
              >
                {versions.map((v) => (
                  <option key={v.version_number} value={v.version_number}>v{v.version_number}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 text-xs text-text-secondary">
              <label htmlFor="diff-to">To</label>
              <select
                id="diff-to"
                value={toVersion}
                onChange={(e) => setToVersion(Number(e.target.value))}
                className="field"
              >
                {versions.map((v) => (
                  <option key={v.version_number} value={v.version_number}>v{v.version_number}</option>
                ))}
              </select>
            </div>
            <Button variant="primary" size="lg" onClick={() => void compareVersions()} disabled={comparing || fromVersion === toVersion}>
              {comparing ? "Comparing…" : "Compare"}
            </Button>
          </div>

          {diff ? <DiffView from={diff.from} to={diff.to} lines={diff.lines} /> : null}
        </section>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border-default bg-bg-elevated">
        {versions.length > 0 ? (
          versions.map((version, index) => (
            <div
              key={version.version_number}
              data-testid={`version-${version.version_number}`}
              className={[
                "flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
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

              {confirmingVersion === version.version_number ? (
                <div role="alertdialog" aria-label={`Restore v${version.version_number}`} className="flex flex-col gap-2 sm:max-w-sm">
                  <p className="text-xs text-text-secondary">
                    Restoring adds a new version, v{latestVersion + 1}, with the content of v{version.version_number}. Nothing
                    is overwritten: today&apos;s content stays in the history as v{latestVersion}.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="primary" size="md" onClick={() => void restoreVersion(version.version_number)}>
                      Restore as v{latestVersion + 1}
                    </Button>
                    <Button variant="secondary" size="md" onClick={() => setConfirmingVersion(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
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
                  variant="secondary"
                  size="md"
                  onClick={() => setConfirmingVersion(version.version_number)}
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
              )}
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

const DIFF_STYLE: Record<DiffLine["op"], { sign: string; cls: string }> = {
  same: { sign: " ", cls: "text-text-secondary" },
  add: { sign: "+", cls: "bg-success/15 text-text-primary" },
  del: { sign: "-", cls: "bg-danger/15 text-text-primary" },
};

function DiffView({ from, to, lines }: { from: number; to: number; lines: DiffLine[] }) {
  const added = lines.filter((l) => l.op === "add").length;
  const removed = lines.filter((l) => l.op === "del").length;
  return (
    <div className="mt-3">
      <p className="text-xs text-text-secondary" data-testid="diff-summary">
        {added === 0 && removed === 0
          ? `v${from} and v${to} have the same Markdown.`
          : `v${from} to v${to}: ${added} line${added === 1 ? "" : "s"} added, ${removed} removed.`}
      </p>
      {/* tabIndex: a scrollable region has to be reachable by keyboard. */}
      <pre
        tabIndex={0}
        aria-label={`Markdown changes from v${from} to v${to}`}
        data-testid="version-diff"
        className="mt-2 max-h-[60vh] overflow-auto rounded-lg border border-border-default bg-bg py-2 font-mono text-xs leading-5"
      >
        {lines.map((line, i) => (
          <div key={i} data-op={line.op} className={`whitespace-pre-wrap break-words px-3 ${DIFF_STYLE[line.op].cls}`}>
            <span aria-hidden className="mr-2 select-none">{DIFF_STYLE[line.op].sign}</span>
            <span className="sr-only">{line.op === "add" ? "Added: " : line.op === "del" ? "Removed: " : ""}</span>
            {line.text}
          </div>
        ))}
      </pre>
    </div>
  );
}
