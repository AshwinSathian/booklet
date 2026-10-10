import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { DRAFTS_DB, DRAFT_DOC, PUBLISH_LINKAGE } from "./constants";
import type { DraftDoc, DraftsDb, PublishedSnapshotRef } from "./types";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

function coercePublishedSnapshotRef(
  v: unknown,
): PublishedSnapshotRef | undefined {
  if (!isPlainObject(v)) return undefined;

  const id = isString(v.id) ? v.id : "";
  const url = isString(v.url) ? v.url : "";
  const createdAt = isString(v.createdAt) ? v.createdAt : "";

  if (!id.trim() || !url.trim() || !createdAt.trim()) return undefined;
  return { id, url, createdAt };
}

function coercePublishHistory(v: unknown): PublishedSnapshotRef[] | undefined {
  if (!isArray(v)) return undefined;

  const refs: PublishedSnapshotRef[] = [];
  for (const item of v) {
    const ref = coercePublishedSnapshotRef(item);
    if (!ref) continue;
    refs.push(ref);
    if (refs.length >= PUBLISH_LINKAGE.historyLimit) break;
  }

  return refs.length ? refs : undefined;
}

function coerceSettings(v: unknown): DraftDoc["settings"] {
  if (!isPlainObject(v)) return { ...DEFAULT_SETTINGS };

  return {
    spacing:
      v.spacing === "compact" || v.spacing === "comfortable"
        ? v.spacing
        : DEFAULT_SETTINGS.spacing,
    width:
      v.width === "normal" || v.width === "wide"
        ? v.width
        : DEFAULT_SETTINGS.width,
    code:
      v.code === "show" || v.code === "collapse"
        ? v.code
        : DEFAULT_SETTINGS.code,
  };
}

function emptyDb(): DraftsDb {
  return { schemaVersion: DRAFTS_DB.schemaVersion, drafts: {} };
}

function isDraftDoc(v: unknown): v is DraftDoc {
  if (!isPlainObject(v)) return false;
  if (!isString(v.id)) return false;
  if (!isNumber(v.v)) return false;
  if (!isString(v.createdAt) || !isString(v.updatedAt)) return false;
  if (!isString(v.title)) return false;
  if (!isString(v.raw)) return false;
  if (!("settings" in v) || !isPlainObject(v.settings)) return false;
  return true;
}

/**
 * Coerce an arbitrary unknown value (e.g. server JSON response, or a
 * localStorage-persisted draft) into a well-formed DraftDoc, or null if it
 * doesn't look like one at all. Shared by the localStorage read below and
 * by cloud-sync.ts, which must not trust a server response's
 * shape any more than localStorage's.
 */
export function coerceDraftDoc(v: unknown): DraftDoc | null {
  if (!isDraftDoc(v)) return null;

  return {
    ...v,
    v: isNumber(v.v) ? v.v : DRAFT_DOC.version,
    title: v.title || DRAFT_DOC.defaultTitle,
    raw: v.raw ?? "",
    settings: coerceSettings(v.settings),
    lastPublished: coercePublishedSnapshotRef((v as DraftDoc).lastPublished),
    publishHistory: coercePublishHistory((v as DraftDoc).publishHistory),
  };
}

/**
 * Reads parsed localStorage JSON as the drafts DB. Anything that is not the
 * current schema, including a DB written by an earlier schema version, is an
 * empty DB. Never throws.
 */
export function coerceDraftsDb(raw: unknown): DraftsDb {
  if (!isPlainObject(raw)) return emptyDb();
  if (raw.schemaVersion !== DRAFTS_DB.schemaVersion) return emptyDb();
  const draftsRaw = raw.drafts;
  if (!isPlainObject(draftsRaw)) return emptyDb();

  const drafts: Record<string, DraftDoc> = {};
  for (const [id, doc] of Object.entries(draftsRaw)) {
    if (!isPlainObject(doc) || doc.id !== id) continue;
    const coerced = coerceDraftDoc(doc);
    if (!coerced) continue;
    drafts[id] = coerced;
  }

  return { schemaVersion: DRAFTS_DB.schemaVersion, drafts };
}
