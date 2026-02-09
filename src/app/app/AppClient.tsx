"use client";

import { AppShell } from "@/components/app/AppShell";
import { PasteInput } from "@/components/app/PasteInput";
import { PreviewPane } from "@/components/app/PreviewPane";
import { TopBar } from "@/components/app/TopBar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ToastProvider, useToast } from "@/components/ui/ToastProvider";
import { trackEvent } from "@/lib/analytics";
import { DEFAULT_SETTINGS, type DocSettings } from "@/lib/blocks";
import { API, APP_NAME, UI } from "@/lib/constants";
import {
  AUTOSAVE,
  createDraft,
  getActiveDraftId,
  getDraft,
  setActiveDraftId,
  updateDraft,
} from "@/lib/drafts";
import { parseToBlocks } from "@/lib/parse";
import { SAMPLE_MARKDOWN } from "@/lib/sample";
import { normalizeInput, stripDangerousSequences } from "@/lib/sanitize";

type SaveState = "saved" | "saving";

function AppPageContent() {
  const [activeDraftId, setActiveDraftIdState] = useState<string | null>(null);
  const [raw, setRaw] = useState("");
  const [settings, setSettings] = useState<DocSettings>(DEFAULT_SETTINGS);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [isReady, setIsReady] = useState(false);

  const [status, setStatus] = useState<
    "idle" | "typing" | "publishing" | "published" | "error"
  >("idle");
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [copyLinkPulse, setCopyLinkPulse] = useState(false);

  const toast = useToast();
  const focusFnRef = useRef<null | (() => void)>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const skipNextAutosaveRef = useRef(true);

  // Hydrate active draft on mount.
  useEffect(() => {
    const storedId = getActiveDraftId();
    const storedDraft = storedId ? getDraft(storedId) : null;

    const draft =
      storedDraft ?? createDraft({ raw: "", settings: DEFAULT_SETTINGS });

    setActiveDraftId(draft.id);
    setActiveDraftIdState(draft.id);

    setRaw(draft.raw);
    setSettings(draft.settings);

    setSaveState("saved");
    setIsReady(true);

    // Avoid an immediate write triggered by hydration.
    skipNextAutosaveRef.current = true;
  }, []);

  // Debounced autosave on raw/settings changes.
  useEffect(() => {
    if (!isReady) return;
    if (!activeDraftId) return;

    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }

    setSaveState("saving");

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      updateDraft(activeDraftId, { raw, settings });
      setSaveState("saved");
      autosaveTimerRef.current = null;
    }, AUTOSAVE.debounceMs);

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [raw, settings, activeDraftId, isReady]);

  const normalized = useMemo(
    () => stripDangerousSequences(normalizeInput(raw)),
    [raw],
  );

  // Debounce parsing (perf): smoother typing on slower devices.
  const [debouncedNormalized, setDebouncedNormalized] = useState(normalized);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedNormalized(normalized), 200);
    return () => clearTimeout(t);
  }, [normalized]);

  const blocks = useMemo(() => {
    if (!debouncedNormalized.trim()) return [];
    try {
      return parseToBlocks(debouncedNormalized);
    } catch {
      return [];
    }
  }, [debouncedNormalized]);

  useEffect(() => {
    if (!raw.trim()) {
      setStatus("idle");
      return;
    }
    setStatus("typing");
    const t = setTimeout(() => setStatus("idle"), UI.previewDebounceMs);
    return () => clearTimeout(t);
  }, [raw]);

  const canPublish = debouncedNormalized.trim().length > 0 && blocks.length > 0;

  const onNew = useCallback(() => {
    const draft = createDraft({ raw: "", settings: DEFAULT_SETTINGS });
    setActiveDraftId(draft.id);
    setActiveDraftIdState(draft.id);

    // Avoid an immediate write triggered by switching drafts.
    skipNextAutosaveRef.current = true;

    setRaw("");
    setPublishedUrl(null);
    setStatus("idle");
    setSettings(DEFAULT_SETTINGS);
    setSaveState("saved");

    toast.info("New draft", "Fresh slate.");
    focusFnRef.current?.();
  }, [toast]);

  const onInsertSample = useCallback(() => {
    setRaw(SAMPLE_MARKDOWN);
    setPublishedUrl(null);
    toast.info("Inserted sample", "Edit it and publish when ready.");
    focusFnRef.current?.();
  }, [toast]);

  const onPublish = useCallback(async () => {
    if (!canPublish) {
      toast.info("Nothing to publish", "Paste some content first.");
      return;
    }

    try {
      setStatus("publishing");

      const res = await fetch(API.publishPath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ blocks, settings }),
      });

      if (!res.ok) {
        const msg = await safeReadText(res);
        throw new Error(msg || `Publish failed (${res.status})`);
      }

      const data = (await res.json()) as { id: string; url: string };

      setPublishedUrl(data.url);
      setStatus("published");
      toast.success("Published", "Your share link is ready.");

      trackEvent("publish_success", {
        blocks_count: blocks.length,
      });

      setCopyLinkPulse(true);
      setTimeout(() => setCopyLinkPulse(false), 1600);
    } catch (e) {
      setStatus("error");
      toast.error("Publish failed", toErrorMessage(e));

      trackEvent("publish_error", {
        stage: "api",
      });
    }
  }, [blocks, settings, toast, canPublish]);

  const onCopyLink = useCallback(async () => {
    if (!publishedUrl) {
      toast.info("No link yet", "Publish first to get a share link.");
      return;
    }

    try {
      await navigator.clipboard.writeText(publishedUrl);
      toast.success("Copied", "Link copied to clipboard.");
    } catch (e) {
      toast.error("Copy failed", toErrorMessage(e));
    }
  }, [publishedUrl, toast]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod && e.key === "Enter") {
        e.preventDefault();
        void onPublish();
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

  const isBusy = status === "typing" || status === "publishing";
  const isEmpty = !normalized.trim();

  return (
    <div className="h-screen min-h-screen flex flex-col overflow-hidden">
      <TopBar
        status={status}
        canPublish={canPublish}
        onNew={onNew}
        onPublish={onPublish}
        onCopyLink={onCopyLink}
        hasLink={Boolean(publishedUrl)}
        copyLinkPulse={copyLinkPulse}
        confidenceValue={settings}
        onConfidenceValueChange={setSettings}
        onInsertSample={onInsertSample}
        saveState={saveState}
      />

      <div className="mx-auto w-full max-w-7xl">
        <div className="flex items-center justify-center p-3">
          <div className="text-xs text-[rgb(var(--muted))] uppercase tracking-wide">
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
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
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
              isBusy={isBusy}
              isEmpty={isEmpty}
              onInsertSample={onInsertSample}
            />
          }
        />
      </div>

      <div className="mt-6 pb-6 flex items-center justify-center gap-4 text-[12px] text-[rgb(var(--muted))]">
        © {new Date().getFullYear()} {APP_NAME}. Built for clarity.
      </div>
    </div>
  );
}

export function AppClient() {
  return (
    <ToastProvider>
      <AppPageContent />
    </ToastProvider>
  );
}

async function safeReadText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function toErrorMessage(e: unknown) {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
