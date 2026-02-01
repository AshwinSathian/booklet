"use client";

import { AppShell } from "@/components/app/AppShell";
import { ConfidenceControls } from "@/components/app/ConfidenceControls";
import { PasteInput } from "@/components/app/PasteInput";
import { PreviewPane } from "@/components/app/PreviewPane";
import { TopBar } from "@/components/app/TopBar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DEFAULT_SETTINGS, type DocSettings } from "@/lib/blocks";
import { API, APP_NAME, UI } from "@/lib/constants";
import { parseToBlocks } from "@/lib/parse";
import { normalizeInput, stripDangerousSequences } from "@/lib/sanitize";

export default function AppPage() {
  const [raw, setRaw] = useState("");
  const [settings, setSettings] = useState<DocSettings>(DEFAULT_SETTINGS);

  const [status, setStatus] = useState<
    "idle" | "typing" | "publishing" | "published" | "error"
  >("idle");

  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  const focusFnRef = useRef<null | (() => void)>(null);
  const normalized = useMemo(
    () => stripDangerousSequences(normalizeInput(raw)),
    [raw],
  );

  const blocks = useMemo(() => {
    if (!normalized.trim()) return [];
    try {
      return parseToBlocks(normalized);
    } catch {
      return [];
    }
  }, [normalized]);

  // Typing status: small debounce for calmer UX
  useEffect(() => {
    if (!raw.trim()) {
      setStatus("idle");
      return;
    }
    setStatus("typing");
    const t = setTimeout(() => setStatus("idle"), UI.previewDebounceMs);
    return () => clearTimeout(t);
  }, [raw]);

  const canPublish = normalized.trim().length > 0 && blocks.length > 0;

  const onNew = useCallback(() => {
    setRaw("");
    setPublishedUrl(null);
    setStatus("idle");
    setSettings(DEFAULT_SETTINGS);
    focusFnRef.current?.();
  }, []);

  const onPublish = useCallback(async () => {
    if (!canPublish) return;
    setStatus("publishing");

    try {
      const res = await fetch(API.publishPath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ blocks, settings }),
      });

      if (!res.ok) throw new Error("Publish failed");
      const data = (await res.json()) as { id: string; url: string };

      setPublishedUrl(data.url);
      setStatus("published");
    } catch {
      setStatus("error");
    }
  }, [canPublish, blocks, settings]);

  const onCopyLink = useCallback(async () => {
    if (!publishedUrl) return;
    try {
      await navigator.clipboard.writeText(publishedUrl);
    } catch {
      // ignore
    }
  }, [publishedUrl]);

  // Keyboard shortcuts:
  // Cmd/Ctrl+Enter => publish
  // Cmd/Ctrl+K => focus paste input
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod && e.key === "Enter") {
        e.preventDefault();
        onPublish();
        return;
      }

      if (mod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        focusFnRef.current?.();
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onPublish]);

  return (
    <div className="h-screen">
      <TopBar
        status={status}
        canPublish={canPublish}
        onNew={onNew}
        onPublish={onPublish}
        onCopyLink={onCopyLink}
        hasLink={Boolean(publishedUrl)}
      />

      <div className="w-[90vw] mx-auto p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <ConfidenceControls value={settings} onChange={setSettings} />
          <div className="text-sm text-[rgb(var(--muted))] uppercase tracking-wide">
            {publishedUrl ? (
              <span>
                Share link:{" "}
                <a
                  className="underline underline-offset-4"
                  href={publishedUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {publishedUrl.replace(window.location.origin, "")}
                </a>
              </span>
            ) : (
              <span>Publish to generate a shareable link</span>
            )}
          </div>
        </div>
      </div>

      <AppShell
        left={
          <PasteInput
            value={raw}
            onChange={(v) => setRaw(v)}
            onFocusShortcutRequested={(fn) => {
              focusFnRef.current = fn;
            }}
          />
        }
        right={
          <PreviewPane
            blocks={blocks}
            settings={settings}
            isEmpty={!normalized.trim()}
          />
        }
      />

      <div className="mt-8 flex items-center justify-center gap-4 text-[12px] text-[rgb(var(--rl-muted))]">
        © {new Date().getFullYear()} {APP_NAME}. Built for clarity.
      </div>
    </div>
  );
}
