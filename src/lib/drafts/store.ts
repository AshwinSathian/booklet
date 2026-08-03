import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { extractDocTitle } from "@/lib/doc-title";
import { stripFrontmatter } from "@/lib/frontmatter";
import { parseToBlocks } from "@/lib/parse";
import { normalizeInput } from "@/lib/sanitize";
import {
  DRAFT_DOC,
  DRAFTS_DB,
  DRAFTS_PERSIST,
  DRAFTS_STORAGE_KEYS,
  PUBLISH_LINKAGE,
} from "./constants";
import { migrateDraftsDb } from "./migrate";
import type {
  DraftCreateInput,
  DraftDoc,
  DraftMeta,
  DraftsDbV2,
  DraftUpdatePatch,
  PublishedSnapshotRef,
} from "./types";

type DraftsPersistErrorCode =
  (typeof DRAFTS_PERSIST)["errorCode"][keyof (typeof DRAFTS_PERSIST)["errorCode"]];

/**
 * Emitted after every successful local mutation. Consumed exclusively by
 * the cloud-sync observer layer (./cloud-sync.ts), which debounce-pushes
 * changes to the server for signed-in users. store.ts intentionally knows
 * nothing about auth or networking — it just announces "this changed."
 */
export type DraftMutationEvent =
  | { type: "upsert"; draft: DraftDoc }
  | { type: "delete"; id: string };

type DraftMutationListener = (event: DraftMutationEvent) => void;

const mutationListeners = new Set<DraftMutationListener>();

/**
 * Subscribe to local draft mutations. Returns an unsubscribe function.
 * Safe to call from non-browser environments (no-op listeners just never
 * fire, since mutations themselves are localStorage-gated).
 */
export function subscribeToDraftMutations(
  listener: DraftMutationListener,
): () => void {
  mutationListeners.add(listener);
  return () => {
    mutationListeners.delete(listener);
  };
}

function notifyMutation(event: DraftMutationEvent): void {
  for (const listener of mutationListeners) {
    try {
      listener(event);
    } catch {
      // Observers must never break local persistence.
    }
  }
}

let lastPersistError: DraftsPersistErrorCode | null = null;

export function getLastDraftsPersistError(): DraftsPersistErrorCode | null {
  return lastPersistError;
}

export function clearLastDraftsPersistError(): void {
  lastPersistError = null;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function hasLocalStorage(): boolean {
  if (!isBrowser()) return false;
  try {
    return typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function getCrypto(): Crypto | null {
  const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
  return c ?? null;
}

function uuidv4FromRandomBytes(bytes: Uint8Array): string {
  // Per RFC 4122 section 4.4
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

function createDraftId(): string {
  const c = getCrypto();
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }

  if (c && typeof c.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    return uuidv4FromRandomBytes(bytes);
  }

  // Last-resort fallback (still collision-resistant for small volumes).
  const ts = Date.now().toString(16);
  const rnd = Math.random().toString(16).slice(2);
  return `${ts}-${rnd}`;
}

function emptyDb(): DraftsDbV2 {
  return { schemaVersion: DRAFTS_DB.schemaVersion, drafts: {} };
}

function readDb(): DraftsDbV2 {
  if (!hasLocalStorage()) return emptyDb();

  const raw = window.localStorage.getItem(DRAFTS_STORAGE_KEYS.db);
  if (!raw) return emptyDb();

  const parsed = safeJsonParse(raw);
  const migrated = migrateDraftsDb(parsed);

  const db = migrated as DraftsDbV2;
  if (db.schemaVersion !== DRAFTS_DB.schemaVersion) return emptyDb();
  return db;
}

function isQuotaExceededError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;

  const rec = e as Record<string, unknown>;
  const name = rec["name"];
  const code = rec["code"];

  const nameStr = typeof name === "string" ? name : "";
  const codeNum = typeof code === "number" ? code : -1;

  // Browsers vary:
  // - QuotaExceededError (most)
  // - NS_ERROR_DOM_QUOTA_REACHED (Firefox legacy)
  // - code 22 / 1014 (some legacy implementations)
  if (nameStr === "QuotaExceededError") return true;
  if (nameStr === "NS_ERROR_DOM_QUOTA_REACHED") return true;
  if (codeNum === 22) return true;
  if (codeNum === 1014) return true;

  return false;
}

function classifyPersistError(e: unknown): DraftsPersistErrorCode {
  if (isQuotaExceededError(e)) return DRAFTS_PERSIST.errorCode.quota;
  return DRAFTS_PERSIST.errorCode.unknown;
}

function writeDb(db: DraftsDbV2): boolean {
  if (!hasLocalStorage()) return true;

  try {
    window.localStorage.setItem(DRAFTS_STORAGE_KEYS.db, JSON.stringify(db));
    lastPersistError = null;
    return true;
  } catch (e) {
    // Quota or serialization errors should not crash the app.
    lastPersistError = classifyPersistError(e);
    return false;
  }
}

function upsertAndPersist(db: DraftsDbV2, doc: DraftDoc): boolean {
  db.drafts[doc.id] = doc;
  return writeDb(db);
}

/**
 * Derive a title from a draft's first H1/H2 heading, same as the publish
 * routes and the app's live-preview pipeline (see src/lib/doc-title.ts).
 * Wrapped defensively — this runs on every debounced autosave, and a
 * malformed in-progress edit must never break saving.
 */
function deriveTitleFromRaw(raw: string): string | null {
  try {
    const blocks = parseToBlocks(normalizeInput(stripFrontmatter(raw)));
    return extractDocTitle(blocks);
  } catch {
    return null;
  }
}

function applyPatch(doc: DraftDoc, patch: DraftUpdatePatch): DraftDoc {
  const next: DraftDoc = { ...doc };

  if (patch.title !== undefined) next.title = patch.title;
  if (patch.raw !== undefined) next.raw = patch.raw;
  if (patch.settings !== undefined) next.settings = patch.settings;
  if (patch.lastPublished !== undefined) {
    next.lastPublished = patch.lastPublished;
  }
  if (patch.publishHistory !== undefined)
    next.publishHistory = patch.publishHistory;

  // Auto-populate the title from typed content until the user manually
  // renames the draft. A patch.title in the same call is an explicit
  // rename and always wins outright; once a draft's title is anything
  // other than the untouched default, content changes never touch it
  // again — this is the fix for titles being permanently "Untitled" (see
  // src/lib/doc-title.ts's header), which is also why wikilink resolution
  // and the graph view couldn't draw edges between drafts.
  if (
    patch.title === undefined &&
    patch.raw !== undefined &&
    next.title === DRAFT_DOC.defaultTitle
  ) {
    const derived = deriveTitleFromRaw(next.raw);
    if (derived) next.title = derived;
  }

  return next;
}

function normalizePublishHistory(
  next: PublishedSnapshotRef[],
): PublishedSnapshotRef[] {
  // Enforce ordering and cap (most recent first).
  const capped = next.slice(0, PUBLISH_LINKAGE.historyLimit);
  return capped;
}

export function listDrafts(): DraftMeta[] {
  const db = readDb();
  const out: DraftMeta[] = Object.values(db.drafts).map((d) => ({
    id: d.id,
    title: d.title,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));

  // Most-recent first; ISO strings compare lexicographically.
  out.sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0,
  );

  return out;
}

export function getDraft(id: string): DraftDoc | null {
  const db = readDb();
  return db.drafts[id] ?? null;
}

/**
 * Every local draft in full (not just the `DraftMeta` projection
 * `listDrafts()` returns) — one `readDb()` call regardless of draft count.
 * Used by the wikilink backlink index (src/lib/wikilinks/index.ts), which
 * needs each draft's `raw` content to find its outbound `[[links]]`; calling
 * `getDraft()` in a loop would re-parse the whole localStorage blob once per
 * draft instead of once total.
 */
export function listDraftDocs(): DraftDoc[] {
  const db = readDb();
  const out = Object.values(db.drafts);

  out.sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0,
  );

  return out;
}

export function createDraft(initial?: DraftCreateInput): DraftDoc {
  const db = readDb();
  const id = createDraftId();
  const ts = nowIso();

  const raw = initial?.raw ?? "";
  // Same auto-title rule as applyPatch: an explicit initial.title always
  // wins; otherwise derive from content so a draft created from a
  // template/import doesn't start life "Untitled" and stay that way until
  // the user's first edit happens to trigger an autosave.
  const title =
    initial?.title ?? deriveTitleFromRaw(raw) ?? DRAFT_DOC.defaultTitle;

  const doc: DraftDoc = {
    id,
    v: DRAFT_DOC.version,
    createdAt: ts,
    updatedAt: ts,
    title,
    raw,
    settings: initial?.settings ?? DEFAULT_SETTINGS,
  };

  upsertAndPersist(db, doc);
  notifyMutation({ type: "upsert", draft: doc });
  return doc;
}

export function updateDraft(
  id: string,
  patch: DraftUpdatePatch,
): DraftDoc | null {
  const db = readDb();
  const existing = db.drafts[id];
  if (!existing) return null;

  const next = applyPatch(existing, patch);
  const saved: DraftDoc = {
    ...next,
    id: existing.id,
    v: existing.v,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  };

  upsertAndPersist(db, saved);
  notifyMutation({ type: "upsert", draft: saved });
  return saved;
}

export function deleteDraft(id: string): boolean {
  const db = readDb();
  if (!db.drafts[id]) return false;
  delete db.drafts[id];
  const ok = writeDb(db);
  if (ok) notifyMutation({ type: "delete", id });
  return ok;
}

export function duplicateDraft(id: string): DraftDoc | null {
  const original = getDraft(id);
  if (!original) return null;

  const db = readDb();
  const newId = createDraftId();
  const ts = nowIso();

  const copy: DraftDoc = {
    ...original,
    id: newId,
    createdAt: ts,
    updatedAt: ts,
    title: `${original.title}${DRAFT_DOC.duplicateSuffix}`,
    lastPublished: undefined,
    publishHistory: undefined,
  };

  upsertAndPersist(db, copy);
  notifyMutation({ type: "upsert", draft: copy });
  return copy;
}

/**
 * Write a full draft document into the local store exactly as given — no
 * id/timestamp regeneration, no mutation-listener notification. Used
 * exclusively by the cloud-sync pull path (./cloud-sync.ts) to reconcile a
 * newer cloud copy into localStorage. Deliberately silent: writing a
 * cloud-sourced draft back into local storage is not a new local edit, so
 * echoing it straight back to the server would be a pointless round-trip.
 */
export function restoreDraft(doc: DraftDoc): DraftDoc {
  const db = readDb();
  upsertAndPersist(db, doc);
  return doc;
}

/**
 * Persist linkage between a draft and a newly created published snapshot.
 * Stores only id/url/timestamp (no document content).
 */
export function setDraftLastPublished(
  draftId: string,
  published: PublishedSnapshotRef,
): DraftDoc | null {
  const db = readDb();
  const existing = db.drafts[draftId];
  if (!existing) return null;

  const prevHistory = Array.isArray(existing.publishHistory)
    ? existing.publishHistory
    : [];

  const nextHistory = normalizePublishHistory([
    published,
    ...prevHistory.filter((h) => h.id !== published.id),
  ]);

  const saved: DraftDoc = {
    ...existing,
    updatedAt: nowIso(),
    lastPublished: published,
    publishHistory: nextHistory.length ? nextHistory : undefined,
  };

  upsertAndPersist(db, saved);
  notifyMutation({ type: "upsert", draft: saved });
  return saved;
}
