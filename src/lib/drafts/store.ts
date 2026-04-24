import { DEFAULT_SETTINGS } from "@/lib/blocks";
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

export function createDraft(initial?: DraftCreateInput): DraftDoc {
  const db = readDb();
  const id = createDraftId();
  const ts = nowIso();

  const doc: DraftDoc = {
    id,
    v: DRAFT_DOC.version,
    createdAt: ts,
    updatedAt: ts,
    title: initial?.title ?? DRAFT_DOC.defaultTitle,
    raw: initial?.raw ?? "",
    settings: initial?.settings ?? DEFAULT_SETTINGS,
  };

  upsertAndPersist(db, doc);
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
  return saved;
}

export function deleteDraft(id: string): boolean {
  const db = readDb();
  if (!db.drafts[id]) return false;
  delete db.drafts[id];
  return writeDb(db);
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
  return copy;
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
  return saved;
}
