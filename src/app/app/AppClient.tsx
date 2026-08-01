"use client";

import { AppShell } from "@/components/app/AppShell";
import { BacklinksPanel } from "@/components/app/BacklinksPanel";
import { CommandPalette } from "@/components/app/CommandPalette";
import { GraphView } from "@/components/app/GraphView";
import { PasteInput } from "@/components/app/PasteInput";
import { PreviewPane } from "@/components/app/PreviewPane";
import { TopBar } from "@/components/app/TopBar";
import { ToastProvider, useToast } from "@/components/ui/ToastProvider";
import { trackEvent } from "@/lib/analytics";
import { ANALYTICS_EVENTS, hashId } from "@/lib/analytics-events";
import { DEFAULT_SETTINGS, type DocSettings } from "@/lib/blocks";
import { API, STORAGE, UI } from "@/lib/constants";
import {
  AUTOSAVE,
  clearLastDraftsPersistError,
  createDraft,
  getActiveDraftId,
  getDraft,
  getLastDraftsPersistError,
  pullCloudDrafts,
  setActiveDraftId,
  setCloudSyncUser,
  setDraftLastPublished,
  subscribeToDraftMutations,
  updateDraft,
} from "@/lib/drafts";
import { parseToBlocks } from "@/lib/parse";
import {
  backlinksForTitle,
  buildWikilinkIndex,
  isTitleResolved,
  resolvedDraftId,
} from "@/lib/wikilinks";
import type { WikilinkRenderCtx } from "@/lib/wikilinks/render-context";
import { SAMPLE_MARKDOWN } from "@/lib/sample";
import { normalizeInput } from "@/lib/sanitize";
import { getTemplateBySlug } from "@/lib/templates";
import { stripFrontmatter } from "@/lib/frontmatter";
import { formatTimeHHMM } from "@/lib/ui/time";
import { AppLoader } from "@/components/ui/AppLoader";
import { useSession } from "@/components/auth/SessionProvider";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SaveState = "saved" | "saving";
type DraftEventOrigin =
  | "hydrate"
  | "topbar_new"
  | "drafts_dialog"
  | "import_markdown"
  | "unknown";

const AUTOSAVE_ANALYTICS_THROTTLE_MS = 60_000;

const SAVE_WARNING_TOAST_KEY = "save_warning";

function AppPageContent() {
  const [activeDraftId, setActiveDraftIdState] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState<string>("");
  const [raw, setRaw] = useState("");
  const [settings, setSettings] = useState<DocSettings>(DEFAULT_SETTINGS);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [lastSavedAtLabel, setLastSavedAtLabel] = useState<string | null>(null);
  const [showSaveWarning, setShowSaveWarning] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const [status, setStatus] = useState<
    "idle" | "typing" | "publishing" | "published" | "error"
  >("idle");
  const [lastPublishedUrl, setLastPublishedUrl] = useState<string | null>(null);
  const [lastPublishedId, setLastPublishedId] = useState<string | null>(null);
  const [lastPublishedOwned, setLastPublishedOwned] = useState(false);
  const [copyLinkPulse, setCopyLinkPulse] = useState(false);

  const [focusMode, setFocusMode] = useState(false);

  const [wikilinkVersion, setWikilinkVersion] = useState(0);
  const [showBacklinks, setShowBacklinks] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const toast = useToast();
  const { isLoaded: isUserLoaded, isSignedIn, userId } = useSession();
  const focusFnRef = useRef<null | (() => void)>(null);
  const openDraftsFnRef = useRef<null | (() => void)>(null);
  const cloudPulledForUserIdRef = useRef<string | null>(null);

  const autosaveTimerRef = useRef<number | null>(null);
  const skipNextAutosaveRef = useRef(true);

  const saveUiTimerRef = useRef<number | null>(null);
  const saveUiLastChangedAtRef = useRef<number>(Date.now());

  const saveWarningWasShownRef = useRef(false);

  const autosaveLastTrackedAtByDraftRef = useRef<Map<string, number>>(
    new Map(),
  );

  const maybeTrackAutosave = useCallback(
    (draftId: string, blocksCount: number) => {
      const now = Date.now();
      const last = autosaveLastTrackedAtByDraftRef.current.get(draftId) ?? 0;
      if (now - last < AUTOSAVE_ANALYTICS_THROTTLE_MS) return;

      autosaveLastTrackedAtByDraftRef.current.set(draftId, now);

      trackEvent(ANALYTICS_EVENTS.draft_autosave, {
        draft_hash: hashId(draftId),
        raw_len: raw.length,
        blocks_count: blocksCount,
      });
    },
    [raw.length],
  );

  const setSaveStateSmoothed = useCallback(
    (next: SaveState) => {
      const now = Date.now();
      const current = saveState;
      if (current === next) return;

      const lastChanged = saveUiLastChangedAtRef.current;
      const elapsed = now - lastChanged;

      const clearTimer = () => {
        if (saveUiTimerRef.current !== null) {
          window.clearTimeout(saveUiTimerRef.current);
          saveUiTimerRef.current = null;
        }
      };

      const commit = (value: SaveState) => {
        clearTimer();
        saveUiLastChangedAtRef.current = Date.now();
        setSaveState(value);
      };

      if (current === "saving" && next === "saved") {
        const remaining = UI.saveStatus.minShowSavingMs - elapsed;
        if (remaining > 0) {
          clearTimer();
          saveUiTimerRef.current = window.setTimeout(
            () => commit("saved"),
            remaining,
          );
          return;
        }
        commit("saved");
        return;
      }

      if (current === "saved" && next === "saving") {
        const remaining = UI.saveStatus.minShowSavedMs - elapsed;
        if (remaining > 0) {
          clearTimer();
          saveUiTimerRef.current = window.setTimeout(
            () => commit("saving"),
            remaining,
          );
          return;
        }
        commit("saving");
        return;
      }

      commit(next);
    },
    [saveState],
  );

  const handlePersistOutcome = useCallback(
    (savedAtIso: string | null) => {
      const err = getLastDraftsPersistError();
      if (err) {
        setShowSaveWarning(true);

        if (!saveWarningWasShownRef.current) {
          saveWarningWasShownRef.current = true;
          toast.showCoalesced(
            SAVE_WARNING_TOAST_KEY,
            "warn",
            "Save issue",
            "Could not save locally. Your browser storage may be full.",
          );
        }
        return;
      }

      clearLastDraftsPersistError();
      setShowSaveWarning(false);
      saveWarningWasShownRef.current = false;

      if (savedAtIso) {
        const d = new Date(savedAtIso);
        if (!Number.isNaN(d.getTime())) {
          setLastSavedAtLabel(formatTimeHHMM(d));
        }
      }
    },
    [toast],
  );

  const persistNow = useCallback(
    (draftId: string) => {
      const saved = updateDraft(draftId, { raw, settings });
      setSaveStateSmoothed("saved");
      handlePersistOutcome(saved?.updatedAt ?? null);
      return saved;
    },
    [handlePersistOutcome, raw, settings, setSaveStateSmoothed],
  );

  const flushPendingAutosave = useCallback(() => {
    if (!isReady) return;
    if (!activeDraftId) return;

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    persistNow(activeDraftId);
  }, [activeDraftId, isReady, persistNow]);

  // Hydrate active draft on mount.
  useEffect(() => {
    // If ?template=<slug> is in the URL, open a fresh draft with that template content.
    const templateSlug =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("template")
        : null;
    const templateContent = templateSlug
      ? (getTemplateBySlug(templateSlug)?.content ?? null)
      : null;

    const storedId = getActiveDraftId();
    const storedDraft = templateContent ? null : (storedId ? getDraft(storedId) : null);

    const draft =
      storedDraft ??
      createDraft({ raw: templateContent ?? "", settings: DEFAULT_SETTINGS });

    setActiveDraftId(draft.id);
    setActiveDraftIdState(draft.id);

    setRaw(draft.raw);
    setDraftTitle(draft.title ?? "");
    setSettings(draft.settings);

    setLastPublishedUrl(draft.lastPublished?.url ?? null);
    setLastPublishedId(draft.lastPublished?.id ?? null);
    setLastPublishedOwned(draft.lastPublished?.owned ?? false);

    setSaveState("saved");
    setLastSavedAtLabel(
      draft.updatedAt ? formatTimeHHMM(new Date(draft.updatedAt)) : null,
    );
    setShowSaveWarning(false);
    setIsReady(true);

    // Avoid an immediate write triggered by hydration.
    skipNextAutosaveRef.current = true;

    trackEvent(ANALYTICS_EVENTS.draft_opened, {
      draft_hash: hashId(draft.id),
      origin: "hydrate",
      has_last_published: Boolean(draft.lastPublished),
    });
  }, []);

  // Tell the cloud-sync observer layer who's signed in (if anyone). Fires
  // before any pull/push so mutations that happen while this resolves still
  // get attributed correctly. Anonymous sessions never call this with a
  // truthy id, so cloud-sync stays fully inert — zero network calls, exactly
  // today's localStorage-only behavior.
  useEffect(() => {
    if (!isUserLoaded) return;
    setCloudSyncUser(isSignedIn ? userId : null);
  }, [isUserLoaded, isSignedIn, userId]);

  // Pull + reconcile cloud drafts once per signed-in session (see
  // src/lib/drafts/cloud-sync.ts for the last-write-wins reconciliation and
  // account-claim rules). Best-effort: local drafts remain fully usable
  // even if this fails or the user is offline.
  useEffect(() => {
    if (!isUserLoaded || !isSignedIn || !userId) return;
    if (cloudPulledForUserIdRef.current === userId) return;
    cloudPulledForUserIdRef.current = userId;

    void pullCloudDrafts(userId).then(() => {
      // The active draft may have been overwritten by a newer cloud copy —
      // refresh in-memory state to match, but only if the user hasn't since
      // switched to a different draft.
      const currentId = getActiveDraftId();
      if (!currentId || currentId !== activeDraftId) return;

      const latest = getDraft(currentId);
      if (!latest) return;

      setRaw(latest.raw);
      setDraftTitle(latest.title ?? "");
      setSettings(latest.settings);
      setLastPublishedUrl(latest.lastPublished?.url ?? null);
      setLastPublishedId(latest.lastPublished?.id ?? null);
      setLastPublishedOwned(latest.lastPublished?.owned ?? false);
      setLastSavedAtLabel(
        latest.updatedAt ? formatTimeHHMM(new Date(latest.updatedAt)) : null,
      );
    });
  }, [isUserLoaded, isSignedIn, userId, activeDraftId]);

  // Rebuild the private wikilink index (backlinks + title resolution) on
  // every local draft mutation (create/rename/delete/autosave) — recomputed
  // from scratch each time (see buildWikilinkIndex's own doc comment for why
  // that's fine at this scale) rather than maintained incrementally.
  useEffect(() => {
    const unsubscribe = subscribeToDraftMutations(() => {
      setWikilinkVersion((v) => v + 1);
    });
    return unsubscribe;
  }, []);

  const wikilinkIndex = useMemo(
    () => buildWikilinkIndex(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wikilinkVersion],
  );

  const backlinks = useMemo(
    () => backlinksForTitle(wikilinkIndex, draftTitle),
    [wikilinkIndex, draftTitle],
  );

  const normalized = useMemo(
    // Strip frontmatter for rendering/parsing — the raw textarea preserves it for editing.
    () => normalizeInput(stripFrontmatter(raw)),
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

  // Debounced autosave on raw/settings changes.
  useEffect(() => {
    if (!isReady) return;
    if (!activeDraftId) return;

    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }

    setSaveStateSmoothed("saving");

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      const saved = updateDraft(activeDraftId, { raw, settings });
      setSaveStateSmoothed("saved");
      autosaveTimerRef.current = null;

      handlePersistOutcome(saved?.updatedAt ?? null);

      // Intentionally uses the last computed blocks for a close-enough metric.
      maybeTrackAutosave(activeDraftId, blocks.length);
    }, AUTOSAVE.debounceMs);

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [
    raw,
    settings,
    activeDraftId,
    isReady,
    maybeTrackAutosave,
    blocks.length,
    handlePersistOutcome,
    setSaveStateSmoothed,
  ]);

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

  const onCreateDraft = useCallback(
    (origin: DraftEventOrigin = "unknown"): string => {
      flushPendingAutosave();

      const draft = createDraft({ raw: "", settings: DEFAULT_SETTINGS });
      setActiveDraftId(draft.id);
      setActiveDraftIdState(draft.id);

      // Avoid an immediate write triggered by switching drafts.
      skipNextAutosaveRef.current = true;

      setRaw("");
      setDraftTitle(draft.title ?? "");
      setLastPublishedUrl(null);
      setLastPublishedId(null);
      setLastPublishedOwned(false);
      setStatus("idle");
      setSettings(DEFAULT_SETTINGS);
      setSaveStateSmoothed("saved");
      setLastSavedAtLabel(formatTimeHHMM(new Date(draft.updatedAt)));

      toast.info("New draft", "Fresh slate.");
      focusFnRef.current?.();

      if (origin !== "drafts_dialog") {
        trackEvent(ANALYTICS_EVENTS.draft_created, {
          draft_hash: hashId(draft.id),
          origin,
        });
      }

      return draft.id;
    },
    [flushPendingAutosave, toast, setSaveStateSmoothed],
  );

  const onSwitchDraft = useCallback(
    (id: string, origin: DraftEventOrigin = "unknown") => {
      if (!id.trim()) return;

      flushPendingAutosave();

      const draft = getDraft(id) ?? createDraft({ raw: "", settings });

      setActiveDraftId(draft.id);
      setActiveDraftIdState(draft.id);

      // Avoid an immediate write triggered by switching drafts.
      skipNextAutosaveRef.current = true;

      setRaw(draft.raw);
      setDraftTitle(draft.title ?? "");
      setSettings(draft.settings);
      setSaveStateSmoothed("saved");
      setLastSavedAtLabel(formatTimeHHMM(new Date(draft.updatedAt)));

      // Publishing state is per-editor session.
      setLastPublishedUrl(draft.lastPublished?.url ?? null);
      setLastPublishedId(draft.lastPublished?.id ?? null);
      setLastPublishedOwned(draft.lastPublished?.owned ?? false);
      setStatus("idle");
      setCopyLinkPulse(false);

      if (origin !== "drafts_dialog") {
        trackEvent(ANALYTICS_EVENTS.draft_opened, {
          draft_hash: hashId(draft.id),
          origin,
          has_last_published: Boolean(draft.lastPublished),
        });
      }
    },
    [flushPendingAutosave, settings, setSaveStateSmoothed],
  );

  const onNavigateWikilink = useCallback(
    (target: string) => {
      const id = resolvedDraftId(wikilinkIndex, target);
      if (id) onSwitchDraft(id, "unknown");
    },
    [wikilinkIndex, onSwitchDraft],
  );

  const wikilinkRenderCtx: WikilinkRenderCtx = useMemo(
    () => ({
      isResolved: (target) => isTitleResolved(wikilinkIndex, target),
      onNavigate: onNavigateWikilink,
    }),
    [wikilinkIndex, onNavigateWikilink],
  );

  const onNew = useCallback(() => {
    onCreateDraft("topbar_new");
  }, [onCreateDraft]);

  const onRenameCurrentDraft = useCallback((next: string) => {
    if (!activeDraftId) return;
    updateDraft(activeDraftId, { title: next });
    setDraftTitle(next);
    trackEvent(ANALYTICS_EVENTS.draft_renamed, { draft_hash: hashId(activeDraftId) });
  }, [activeDraftId]);

  const onInsertSample = useCallback(() => {
    setRaw(SAMPLE_MARKDOWN);
    toast.info("Sample loaded", "Edit and publish when ready.");
    focusFnRef.current?.();
  }, [toast]);

  const onImportMarkdown = useCallback(
    (title: string, nextRaw: string) => {
      flushPendingAutosave();

      const trimmedTitle =
        title.trim().slice(0, 140) || UI.importMarkdown.defaultTitle;
      const safeRaw = nextRaw.slice(0, STORAGE.maxInputChars);

      const draft = createDraft({
        title: trimmedTitle,
        raw: safeRaw,
        settings: DEFAULT_SETTINGS,
      });

      setActiveDraftId(draft.id);
      setActiveDraftIdState(draft.id);

      // Avoid an immediate write triggered by switching drafts.
      skipNextAutosaveRef.current = true;

      setRaw(draft.raw);
      setDraftTitle(draft.title ?? "");
      setSettings(draft.settings);
      setSaveStateSmoothed("saved");
      setLastSavedAtLabel(formatTimeHHMM(new Date(draft.updatedAt)));

      setLastPublishedUrl(null);
      setLastPublishedId(null);
      setLastPublishedOwned(false);
      setStatus("idle");
      setCopyLinkPulse(false);

      trackEvent(ANALYTICS_EVENTS.draft_created, {
        draft_hash: hashId(draft.id),
        origin: "import_markdown",
      });

      focusFnRef.current?.();
    },
    [flushPendingAutosave, setSaveStateSmoothed],
  );

  const onInsertTemplate = useCallback(
    (title: string, content: string) => {
      flushPendingAutosave();
      const safeRaw = content.slice(0, STORAGE.maxInputChars);
      const draft = createDraft({ title, raw: safeRaw, settings: DEFAULT_SETTINGS });
      setActiveDraftId(draft.id);
      setActiveDraftIdState(draft.id);
      skipNextAutosaveRef.current = true;
      setRaw(draft.raw);
      setDraftTitle(draft.title ?? "");
      setSettings(draft.settings);
      setSaveStateSmoothed("saved");
      setLastSavedAtLabel(formatTimeHHMM(new Date(draft.updatedAt)));
      setLastPublishedUrl(null);
      setLastPublishedId(null);
      setLastPublishedOwned(false);
      setStatus("idle");
      setCopyLinkPulse(false);
      focusFnRef.current?.();
    },
    [flushPendingAutosave, setSaveStateSmoothed],
  );

  const onPublish = useCallback(async () => {
    if (!canPublish) {
      toast.info("Nothing to publish", "Write or paste something first.");
      return;
    }

    try {
      setStatus("publishing");

      const res = await fetch(API.publishPath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // `blocks` is no longer sent — the server always derives it from
        // `raw` (see src/lib/block-schema.ts's header for why a
        // client-computed block tree is no longer trusted directly).
        body: JSON.stringify({ settings, raw }),
      });

      if (!res.ok) {
        const msg = await safeReadErrorMessage(res);
        throw new Error(msg || `Publish failed (${res.status})`);
      }

      const data = (await res.json()) as { id: string; url: string; owned?: boolean };

      const createdAt = new Date().toISOString();

      if (activeDraftId) {
        setDraftLastPublished(activeDraftId, {
          id: data.id,
          url: data.url,
          createdAt,
          owned: data.owned ?? false,
        });

        trackEvent(ANALYTICS_EVENTS.publish_from_draft, {
          draft_hash: hashId(activeDraftId),
          published_hash: hashId(data.id),
          blocks_count: blocks.length,
          raw_len: raw.length,
        });
      }

      setLastPublishedUrl(data.url);
      setLastPublishedId(data.id);
      setLastPublishedOwned(data.owned ?? false);
      setStatus("published");

      toast.showCoalesced(
        "publish_ok",
        "success",
        "Published",
        "Your link is ready.",
      );

      // Keep existing Phase 1 event for continuity.
      trackEvent(ANALYTICS_EVENTS.publish_success, {
        blocks_count: blocks.length,
      });

      setCopyLinkPulse(true);
      setTimeout(() => setCopyLinkPulse(false), 1600);
    } catch (e) {
      setStatus("error");
      toast.error("Publish failed", toErrorMessage(e));

      trackEvent(ANALYTICS_EVENTS.publish_error, {
        stage: "api",
      });
    }
  }, [activeDraftId, blocks, settings, toast, canPublish, raw]);

  const onUpdatePage = useCallback(async () => {
    if (!canPublish) {
      toast.info("Nothing to publish", "Write or paste something first.");
      return;
    }
    if (!lastPublishedId || !lastPublishedOwned || !activeDraftId) return;

    try {
      setStatus("publishing");

      const res = await fetch(`/api/publish/${lastPublishedId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ settings, raw }),
      });

      if (!res.ok) {
        const msg = await safeReadErrorMessage(res);
        throw new Error(msg || `Update failed (${res.status})`);
      }

      setStatus("published");

      toast.showCoalesced(
        "publish_ok",
        "success",
        "Updated",
        "Same URL, new content.",
      );

      setCopyLinkPulse(true);
      setTimeout(() => setCopyLinkPulse(false), 1600);

      trackEvent(ANALYTICS_EVENTS.publish_success, { blocks_count: blocks.length });
    } catch (e) {
      setStatus("error");
      toast.error("Update failed", toErrorMessage(e));
      trackEvent(ANALYTICS_EVENTS.publish_error, { stage: "api" });
    }
  }, [activeDraftId, blocks, settings, raw, toast, canPublish, lastPublishedId, lastPublishedOwned]);

  const onCopyLink = useCallback(async () => {
    if (!lastPublishedUrl) {
      toast.info("No link yet", "Publish to get your link.");
      return;
    }

    try {
      await navigator.clipboard.writeText(lastPublishedUrl);
      toast.showCoalesced(
        "copy_link",
        "success",
        "Copied",
        "Link is on your clipboard.",
      );
    } catch (e) {
      toast.error("Copy failed", toErrorMessage(e));
    }
  }, [lastPublishedUrl, toast]);

  const onOpenPublished = useCallback(() => {
    if (!lastPublishedUrl) {
      toast.info("No link yet", "Publish to get your link.");
      return;
    }

    try {
      window.open(lastPublishedUrl, "_blank", "noopener,noreferrer");
    } catch {
      // ignore
    }
  }, [lastPublishedUrl, toast]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const platform =
        (navigator as Navigator & { userAgentData?: { platform?: string } })
          .userAgentData?.platform ?? navigator.userAgent;
      const isMac = /mac/i.test(platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        if (activeDraftId) persistNow(activeDraftId);
        return;
      }

      if (mod && e.key === "Enter") {
        e.preventDefault();
        void onPublish();
        return;
      }

      if (mod && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        focusFnRef.current?.();
        return;
      }

      if (mod && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        onNew();
        return;
      }

      if (mod && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        openDraftsFnRef.current?.();
        return;
      }

      if (mod && e.key === ".") {
        e.preventDefault();
        setFocusMode((f) => !f);
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeDraftId, onNew, onPublish, persistNow]);

  // Cmd/Ctrl+K toggles the command palette.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isBusy = status === "typing" || status === "publishing";
  const isEmpty = !normalized.trim();

  return (
    <div className="h-screen min-h-screen flex flex-col overflow-hidden">
      <TopBar
        status={status}
        canPublish={canPublish}
        raw={raw}
        draftTitle={draftTitle}
        onNew={onNew}
        onRenameCurrentDraft={onRenameCurrentDraft}
        activeDraftId={activeDraftId}
        onCreateDraft={(origin) => onCreateDraft(origin ?? "unknown")}
        onSwitchDraft={(id, origin) => onSwitchDraft(id, origin ?? "unknown")}
        onPublish={onPublish}
        onUpdatePage={onUpdatePage}
        onCopyLink={onCopyLink}
        onOpenPublished={onOpenPublished}
        publishedUrl={lastPublishedUrl}
        publishedOwned={lastPublishedOwned}
        copyLinkPulse={copyLinkPulse}
        settings={settings}
        onSettingsChange={setSettings}
        onInsertSample={onInsertSample}
        saveState={saveState}
        lastSavedAtLabel={lastSavedAtLabel}
        showSaveWarning={showSaveWarning}
        onImportMarkdown={onImportMarkdown}
        onInsertTemplate={onInsertTemplate}
        onOpenDraftsShortcutRegistered={(fn) => { openDraftsFnRef.current = fn; }}
        publishedId={lastPublishedId}
        focusMode={focusMode}
        onToggleFocusMode={() => setFocusMode((f) => !f)}
        onSlugSet={(newSlug) => {
          if (!lastPublishedUrl || !lastPublishedId || !activeDraftId) return;
          const newUrl = lastPublishedUrl.replace(/\/p\/[^/]+$/, `/p/${newSlug}`);
          setLastPublishedUrl(newUrl);
          setDraftLastPublished(activeDraftId, {
            id: lastPublishedId,
            url: newUrl,
            createdAt: new Date().toISOString(),
            owned: true,
          });
        }}
      />

      <div className="flex-1 min-h-0">
        <AppShell
          focusMode={focusMode}
          isEmpty={isEmpty}
          isReady={isReady}
          left={
            <PasteInput
              value={raw}
              onChange={(v) => setRaw(v)}
              onFocusShortcutRequested={(fn) => {
                focusFnRef.current = fn;
              }}
              isEmpty={isEmpty}
              onInsertSample={onInsertSample}
            />
          }
          right={
            <PreviewPane
              blocks={blocks}
              settings={settings}
              isBusy={isBusy}
              isEmpty={isEmpty}
              onInsertSample={onInsertSample}
              wikilinkCtx={wikilinkRenderCtx}
              backlinksCount={backlinks.length}
              onOpenBacklinks={() => setShowBacklinks(true)}
              onOpenGraph={() => setShowGraph(true)}
            />
          }
        />
      </div>

      <BacklinksPanel
        visible={showBacklinks}
        draftTitle={draftTitle}
        backlinks={backlinks}
        onHide={() => setShowBacklinks(false)}
        onOpenDraft={(id) => onSwitchDraft(id, "unknown")}
      />

      <GraphView
        visible={showGraph}
        activeDraftId={activeDraftId}
        onHide={() => setShowGraph(false)}
        onOpenDraft={(id) => onSwitchDraft(id, "unknown")}
      />

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

export function AppClient() {
  return (
    <ToastProvider>
      <AppLoader />
      <AppPageContent />
    </ToastProvider>
  );
}

async function safeReadErrorMessage(res: Response): Promise<string> {
  try {
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const data = (await res.json()) as { error?: string };
      return data.error || `Request failed (${res.status})`;
    }
  } catch {
    // fall through
  }
  return `Request failed (${res.status})`;
}

function toErrorMessage(e: unknown) {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
