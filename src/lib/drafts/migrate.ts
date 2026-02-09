import { DRAFTS_DB, DRAFT_DOC } from "./constants";
import type { DraftDoc, DraftsDb, DraftsDbV1 } from "./types";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isDraftDoc(v: unknown): v is DraftDoc {
  if (!isPlainObject(v)) return false;
  if (!isString(v.id)) return false;
  if (!isNumber(v.v)) return false;
  if (!isString(v.createdAt) || !isString(v.updatedAt)) return false;
  if (!isString(v.title)) return false;

  // settings/blocks validation is intentionally shallow; future migrations
  // can harden this, and UI/editor layers can sanitize further.
  if (!("settings" in v) || !isPlainObject(v.settings)) return false;
  if (!Array.isArray((v as { blocks?: unknown }).blocks)) return false;

  return true;
}

function emptyDb(): DraftsDbV1 {
  return { schemaVersion: DRAFTS_DB.schemaVersion, drafts: {} };
}

function coerceDbV1(raw: unknown): DraftsDbV1 {
  if (!isPlainObject(raw)) return emptyDb();
  const schemaVersion = raw.schemaVersion;
  if (schemaVersion !== 1) return emptyDb();

  const draftsRaw = raw.drafts;
  if (!isPlainObject(draftsRaw)) return emptyDb();

  const drafts: Record<string, DraftDoc> = {};
  for (const [id, doc] of Object.entries(draftsRaw)) {
    if (!isDraftDoc(doc)) continue;
    if (doc.id !== id) continue;

    drafts[id] = {
      ...doc,
      v: isNumber(doc.v) ? doc.v : DRAFT_DOC.version,
      title: doc.title || DRAFT_DOC.defaultTitle,
    };
  }

  return { schemaVersion: 1, drafts };
}

/**
 * Migrate any parsed Drafts DB JSON into the latest persisted shape.
 * This never throws; callers should treat it as safe.
 */
export function migrateDraftsDb(parsed: unknown): DraftsDb {
  if (!isPlainObject(parsed)) return emptyDb();

  const version = parsed.schemaVersion;
  if (!isNumber(version)) return emptyDb();

  // v1: coerce + validate only
  if (version === 1) return coerceDbV1(parsed);

  // Future versions: implement incremental migrations here.
  // Example scaffold:
  // let db: DraftsDb = someCoerceForKnownVersion(parsed)
  // while (db.schemaVersion < DRAFTS_DB.schemaVersion) {
  //   if (db.schemaVersion === 1) db = migrateV1ToV2(db)
  // }
  return emptyDb();
}
