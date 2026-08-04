/**
 * Local-only editor preferences — distinct from `DocSettings`
 * (src/lib/blocks.ts), which describes a *published document's*
 * presentation and is part of the publish contract. These never leave the
 * browser and never touch a published page.
 */
export type EditorPrefs = {
  /** Focus Mode: dim every paragraph except the one the cursor is in.
   * Off by default so existing Focus Mode users aren't surprised by a
   * behavior change. */
  paragraphDimming: boolean;
};

const STORAGE_KEY = "booklet:editorPrefs";

const DEFAULT_PREFS: EditorPrefs = {
  paragraphDimming: false,
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getEditorPrefs(): EditorPrefs {
  if (!isBrowser()) return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<EditorPrefs>;
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function setEditorPrefs(patch: Partial<EditorPrefs>): EditorPrefs {
  const next = { ...getEditorPrefs(), ...patch };
  if (isBrowser()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Best-effort — same non-fatal posture as the drafts store's own
      // localStorage writes (src/lib/drafts/store.ts).
    }
  }
  return next;
}
