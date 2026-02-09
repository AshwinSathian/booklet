import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { DRAFTS_DB, DRAFT_DOC, PUBLISH_LINKAGE } from "./constants";
import type {
  DraftDoc,
  DraftsDb,
  DraftsDbV1,
  DraftsDbV2,
  PublishedSnapshotRef,
} from "./types";

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

function isPublishedSnapshotRef(v: unknown): v is PublishedSnapshotRef {
  if (!isPlainObject(v)) return false;
  return isString(v.id) && isString(v.url) && isString(v.createdAt);
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

function emptyDb(): DraftsDbV2 {
  return { schemaVersion: DRAFTS_DB.schemaVersion, drafts: {} };
}

function isDraftDocV2(v: unknown): v is DraftDoc {
  if (!isPlainObject(v)) return false;
  if (!isString(v.id)) return false;
  if (!isNumber(v.v)) return false;
  if (!isString(v.createdAt) || !isString(v.updatedAt)) return false;
  if (!isString(v.title)) return false;
  if (!isString(v.raw)) return false;
  if (!("settings" in v) || !isPlainObject(v.settings)) return false;
  return true;
}

function coerceDbV2(raw: unknown): DraftsDbV2 {
  if (!isPlainObject(raw)) return emptyDb();
  if (raw.schemaVersion !== 2) return emptyDb();
  const draftsRaw = raw.drafts;
  if (!isPlainObject(draftsRaw)) return emptyDb();

  const drafts: Record<string, DraftDoc> = {};
  for (const [id, doc] of Object.entries(draftsRaw)) {
    if (!isDraftDocV2(doc)) continue;
    if (doc.id !== id) continue;

    drafts[id] = {
      ...doc,
      v: isNumber(doc.v) ? doc.v : DRAFT_DOC.version,
      title: doc.title || DRAFT_DOC.defaultTitle,
      raw: doc.raw ?? "",
      settings: coerceSettings(doc.settings),
      lastPublished: coercePublishedSnapshotRef(
        (doc as DraftDoc).lastPublished,
      ),
      publishHistory: coercePublishHistory((doc as DraftDoc).publishHistory),
    };
  }

  return { schemaVersion: 2, drafts };
}

function coerceDbV1(raw: unknown): DraftsDbV1 | null {
  if (!isPlainObject(raw)) return null;
  if (raw.schemaVersion !== 1) return null;
  if (!isPlainObject(raw.drafts)) return null;
  return raw as DraftsDbV1;
}

function migrateV1ToV2(v1: DraftsDbV1): DraftsDbV2 {
  // Epic 2A stored unknown drafts shape; best-effort coercion.
  // If a draft has title/settings and (optionally) raw, keep them.
  const drafts: Record<string, DraftDoc> = {};
  for (const [id, unknownDoc] of Object.entries(v1.drafts)) {
    if (!isPlainObject(unknownDoc)) continue;

    const createdAt = isString(unknownDoc.createdAt)
      ? unknownDoc.createdAt
      : new Date(0).toISOString();
    const updatedAt = isString(unknownDoc.updatedAt)
      ? unknownDoc.updatedAt
      : createdAt;
    const title = isString(unknownDoc.title)
      ? unknownDoc.title
      : DRAFT_DOC.defaultTitle;
    const raw = isString((unknownDoc as { raw?: unknown }).raw)
      ? ((unknownDoc as { raw?: string }).raw ?? "")
      : "";

    const settings = coerceSettings(unknownDoc.settings);

    drafts[id] = {
      id,
      v: DRAFT_DOC.version,
      createdAt,
      updatedAt,
      title,
      raw,
      settings,
    };
  }

  return { schemaVersion: 2, drafts };
}

/**
 * Migrate any parsed Drafts DB JSON into the latest persisted shape.
 * This never throws; callers should treat it as safe.
 */
export function migrateDraftsDb(parsed: unknown): DraftsDb {
  if (!isPlainObject(parsed)) return emptyDb();

  const schemaVersion = parsed.schemaVersion;
  if (!isNumber(schemaVersion)) return emptyDb();

  if (schemaVersion === 2) return coerceDbV2(parsed);

  if (schemaVersion === 1) {
    const v1 = coerceDbV1(parsed);
    if (!v1) return emptyDb();
    return migrateV1ToV2(v1);
  }

  // Future versions: implement incremental migrations here.
  return emptyDb();
}
