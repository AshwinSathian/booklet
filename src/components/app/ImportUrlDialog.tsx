"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * "Import from URL": asks for a link to a Markdown file on GitHub and hands
 * its text to the editor as a new draft. The fetch is done by the server
 * (POST /api/import), which only goes to raw.githubusercontent.com.
 */
export function ImportUrlDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (title: string, raw: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);

  // A native modal <dialog>: focus trap, Escape and the backdrop come with it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) {
      // Closed while a fetch was out: its answer must not open a draft later.
      request.current?.abort();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- closing the dialog, by any route, clears the last error with the aborted request
      setError(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    request.current = controller;
    try {
      const res = await fetch("/api/import", {
        signal: controller.signal,
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json().catch(() => ({}))) as { raw?: string; title?: string; detail?: string };
      if (!res.ok || typeof data.raw !== "string") {
        setError(data.detail ?? "Could not import that link.");
        return;
      }
      onImported(data.title ?? "Imported document", data.raw);
      setUrl("");
      onClose();
    } catch {
      if (!controller.signal.aborted) setError("Could not reach Booklet. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="import-url-title"
      className="w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-border-default bg-bg-elevated p-5 text-text-primary shadow-glass backdrop:bg-black/45"
    >
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
        <h2 id="import-url-title" className="text-base font-semibold">Import from URL</h2>
        <p className="text-sm text-text-secondary">
          Paste a link to a public Markdown file on GitHub. It opens as a new draft; nothing is published.
        </p>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          File URL
          <input
            type="url"
            required
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo/blob/main/README.md"
            className="rounded-lg border border-border-default bg-bg px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
          />
        </label>
        {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="md" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="md" type="submit" disabled={busy || !url.trim()}>
            {busy ? "Importing…" : "Import"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
