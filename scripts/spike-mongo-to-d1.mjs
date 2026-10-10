// Spike S8: migration rehearsal, MongoDB -> D1. Never merged.
//
// Reads every collection through the MongoDB driver and writes rows through
// the D1 binding with bound parameters. Bound parameters matter: D1 limits a
// SQL statement to 100 KB, and one stored document can be 600 KB, so a
// `mongoexport` file turned into literal INSERT statements could not be
// applied with `wrangler d1 execute --file`.
//
// Prints counts and field names only, never document contents.
//
//   npx wrangler d1 migrations apply booklet-spike --local --persist-to .wrangler/s8-state
//   MONGODB_URI=mongodb://127.0.0.1:27018/?directConnection=true MONGO_DB=booklet_s8 \
//     node scripts/spike-mongo-to-d1.mjs .wrangler/s8-state/v3
import { MongoClient } from "mongodb";
import { getPlatformProxy } from "wrangler";

const persistPath = process.argv[2];
if (!persistPath || !process.env.MONGODB_URI || !process.env.MONGO_DB) {
  console.error("usage: MONGODB_URI=... MONGO_DB=... node scripts/spike-mongo-to-d1.mjs <d1 persist path>");
  process.exit(2);
}

const iso = (v) => (v instanceof Date ? v.toISOString() : (v ?? null));
const ms = (v) => (v instanceof Date ? v.getTime() : typeof v === "string" ? Date.parse(v) : (v ?? null));
const json = (v) => (v === undefined || v === null ? null : JSON.stringify(v));
const id = (d) => String(d._id);

// table -> [columns, row builder]. `fields` are the MongoDB fields each
// builder reads; anything else found in a document is reported by name.
const MAP = {
  users: {
    fields: ["_id", "email", "password_hash", "display_name", "plan", "created_at"],
    cols: ["id", "email", "password_hash", "display_name", "plan", "created_at"],
    row: (d) => [id(d), d.email ?? null, d.password_hash ?? null, d.display_name ?? null, d.plan ?? "free", iso(d.created_at)],
  },
  sessions: {
    fields: ["_id", "user_id", "token_hash", "created_at", "expires_at"],
    cols: ["id", "user_id", "token_hash", "created_at", "expires_at"],
    row: (d) => [id(d), d.user_id, d.token_hash, iso(d.created_at), ms(d.expires_at)],
  },
  password_reset_tokens: {
    fields: ["_id", "user_id", "token_hash", "created_at", "expires_at"],
    cols: ["id", "user_id", "token_hash", "created_at", "expires_at"],
    row: (d) => [id(d), d.user_id, d.token_hash, iso(d.created_at), ms(d.expires_at)],
  },
  pages: {
    fields: ["_id", "user_id", "slug", "title", "visibility", "collection_id", "team_id", "view_count", "password_hash", "frontmatter_meta", "taken_down_at", "created_at", "updated_at"],
    cols: ["id", "user_id", "slug", "title", "visibility", "collection_id", "team_id", "view_count", "password_hash", "frontmatter_meta", "taken_down_at", "created_at", "updated_at"],
    row: (d) => [id(d), d.user_id, d.slug ?? null, d.title ?? null, d.visibility ?? "unlisted", d.collection_id ?? null, d.team_id ?? null, d.view_count ?? 0, d.password_hash ?? null, json(d.frontmatter_meta), d.taken_down_at ?? null, iso(d.created_at), iso(d.updated_at ?? d.created_at)],
  },
  api_keys: {
    fields: ["_id", "user_id", "key_hash", "label", "created_at", "last_used_at"],
    cols: ["id", "user_id", "key_hash", "label", "created_at", "last_used_at"],
    row: (d) => [id(d), d.user_id, d.key_hash, d.label ?? null, iso(d.created_at), iso(d.last_used_at)],
  },
  docs: {
    fields: ["_id", "doc", "expires_at", "claim_token_hash", "taken_down_at"],
    cols: ["id", "doc", "expires_at", "claim_token_hash", "taken_down_at"],
    row: (d) => [id(d), JSON.stringify(d.doc), ms(d.expires_at), d.claim_token_hash ?? null, d.taken_down_at ?? null],
  },
  reports: {
    fields: ["_id", "page_id", "reason", "detail", "reporter_email", "created_at", "status", "resolved_at"],
    cols: ["id", "page_id", "reason", "detail", "reporter_email", "created_at", "status", "resolved_at"],
    row: (d) => [id(d), d.page_id, d.reason, d.detail ?? null, d.reporter_email ?? null, iso(d.created_at), d.status, d.resolved_at ?? null],
  },
  rate_limits: {
    fields: ["_id", "count", "expiresAt"],
    cols: ["id", "count", "expires_at"],
    row: (d) => [id(d), d.count ?? 0, ms(d.expiresAt)],
  },
  analytics_events: {
    fields: ["_id", "id", "page_id", "event", "referrer_bucket", "country", "session_hash", "created_at", "expires_at"],
    cols: ["id", "page_id", "event", "referrer_bucket", "country", "session_hash", "created_at", "expires_at"],
    row: (d) => [d.id ?? id(d), d.page_id, d.event, d.referrer_bucket ?? null, d.country ?? null, d.session_hash, iso(d.created_at), ms(d.expires_at)],
  },
  page_versions: {
    fields: ["_id", "id", "page_id", "version_number", "doc_snapshot", "created_at", "size_bytes"],
    cols: ["id", "page_id", "version_number", "doc_snapshot", "created_at", "size_bytes"],
    row: (d) => [d.id ?? id(d), d.page_id, d.version_number, d.doc_snapshot, iso(d.created_at), d.size_bytes],
  },
  collections: {
    fields: ["_id", "user_id", "name", "slug", "is_team_space", "parent_id", "created_at", "updated_at"],
    cols: ["id", "user_id", "name", "slug", "is_team_space", "parent_id", "created_at", "updated_at"],
    row: (d) => [id(d), d.user_id, d.name, d.slug ?? null, d.is_team_space ? 1 : 0, d.parent_id ?? null, iso(d.created_at), iso(d.updated_at ?? d.created_at)],
  },
  collection_members: {
    fields: ["_id", "collection_id", "user_id", "email", "role", "invited_by", "created_at"],
    cols: ["id", "collection_id", "user_id", "email", "role", "invited_by", "created_at"],
    row: (d) => [id(d), d.collection_id, d.user_id, d.email ?? null, d.role, d.invited_by, iso(d.created_at)],
  },
  webhooks: {
    fields: ["_id", "user_id", "url", "secret", "events", "created_at", "last_triggered_at"],
    cols: ["id", "user_id", "url", "secret", "events", "created_at", "last_triggered_at"],
    row: (d) => [id(d), d.user_id, d.url, d.secret, JSON.stringify(d.events ?? []), iso(d.created_at), iso(d.last_triggered_at)],
  },
  view_dedupe: {
    fields: ["_id", "session_hash", "page_id", "created_at", "expires_at"],
    cols: ["session_hash", "page_id", "created_at", "expires_at"],
    row: (d) => [d.session_hash, d.page_id, iso(d.created_at), ms(d.expires_at)],
  },
  publish_events: {
    fields: ["_id", "id", "user_id", "page_id", "is_update", "content_length_bucket", "source", "created_at", "rich_block_kinds"],
    cols: ["id", "user_id", "page_id", "is_update", "content_length_bucket", "source", "created_at", "rich_block_kinds"],
    row: (d) => [d.id ?? id(d), d.user_id ?? null, d.page_id, d.is_update ? 1 : 0, d.content_length_bucket, d.source ?? "browser", iso(d.created_at), json(d.rich_block_kinds)],
  },
  drafts: {
    // The whole DraftDoc goes into `data`, so no draft field can be unknown.
    fields: null,
    cols: ["id", "user_id", "title", "created_at", "updated_at", "data"],
    row: (d) => {
      const { _id, user_id, ...rest } = d;
      return [String(_id), user_id, rest.title ?? null, iso(rest.createdAt), iso(rest.updatedAt), JSON.stringify(rest)];
    },
  },
};

const mongo = await new MongoClient(process.env.MONGODB_URI).connect();
const src = mongo.db(process.env.MONGO_DB);
const proxy = await getPlatformProxy({ persist: { path: persistPath } });
const d1 = proxy.env.DB;

const names = (await src.listCollections().toArray()).map((c) => c.name).sort();
const unmapped = names.filter((n) => !MAP[n]);
const report = [];
let allMatch = unmapped.length === 0;

for (const name of names.filter((n) => MAP[n])) {
  const { fields, cols, row } = MAP[name];
  const insert = d1.prepare(`INSERT INTO ${name} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`);
  const unknown = {};
  const errors = {};
  let read = 0;
  let maxRowBytes = 0;
  for await (const doc of src.collection(name).find()) {
    read++;
    if (fields) for (const k of Object.keys(doc)) if (!fields.includes(k)) unknown[k] = (unknown[k] ?? 0) + 1;
    const values = row(doc);
    maxRowBytes = Math.max(maxRowBytes, values.reduce((n, v) => n + (typeof v === "string" ? Buffer.byteLength(v) : 8), 0));
    const statements = [insert.bind(...values)];
    if (name === "pages") {
      const tags = Array.isArray(doc.frontmatter_meta?.tags) ? [...new Set(doc.frontmatter_meta.tags.filter((t) => typeof t === "string"))] : [];
      for (const tag of tags) statements.push(d1.prepare("INSERT INTO page_tags (page_id, tag) VALUES (?, ?)").bind(String(doc._id), tag));
    }
    try {
      await d1.batch(statements);
    } catch (e) {
      const msg = String(e?.cause?.message ?? e?.message ?? e).replace(/: SQLITE_\w+$/, "").slice(0, 80);
      errors[msg] = (errors[msg] ?? 0) + 1;
    }
  }
  const written = (await d1.prepare(`SELECT COUNT(*) AS n FROM ${name}`).first()).n;
  const match = read === written;
  if (!match) allMatch = false;
  report.push({ collection: name, mongo: read, d1: written, match, maxRowBytes, unknownFields: unknown, errors });
}

// Hashes must arrive byte for byte: API key hashes (4 of 7 keys still use the
// legacy rdbl_ prefix check, which works on the raw key, not the hash) and
// argon2id PHC strings.
const keyHashes = (await src.collection("api_keys").find({}, { projection: { key_hash: 1 } }).toArray()).map((d) => d.key_hash).sort();
const d1KeyHashes = (await d1.prepare("SELECT key_hash FROM api_keys ORDER BY key_hash").all()).results.map((r) => r.key_hash);
const pwHashes = (await src.collection("users").find({ password_hash: { $type: "string" } }, { projection: { password_hash: 1 } }).toArray()).map((d) => d.password_hash).sort();
const d1PwHashes = (await d1.prepare("SELECT password_hash FROM users WHERE password_hash IS NOT NULL ORDER BY password_hash").all()).results.map((r) => r.password_hash);
const pagePwFormats = {};
for (const r of (await d1.prepare("SELECT password_hash FROM pages WHERE password_hash IS NOT NULL").all()).results) {
  const parts = r.password_hash.split(":");
  const k = parts.length === 3 ? `pbkdf2 ${parts[0]} iterations` : parts.length === 2 ? "pbkdf2 legacy (100000, no count stored)" : "other";
  pagePwFormats[k] = (pagePwFormats[k] ?? 0) + 1;
}
const argonParams = {};
for (const h of d1PwHashes) {
  const k = h.split("$").slice(1, 4).join("$");
  argonParams[k] = (argonParams[k] ?? 0) + 1;
}

console.log(JSON.stringify({
  collections: names.length,
  unmapped,
  report,
  pageTags: (await d1.prepare("SELECT COUNT(*) AS n FROM page_tags").first()).n,
  apiKeyHashesIdentical: JSON.stringify(keyHashes) === JSON.stringify(d1KeyHashes),
  apiKeys: keyHashes.length,
  userPasswordHashesIdentical: JSON.stringify(pwHashes) === JSON.stringify(d1PwHashes),
  userPasswordHashFormats: argonParams,
  pagePasswordHashFormats: pagePwFormats,
  allCountsMatch: allMatch,
}, null, 1));

await mongo.close();
await proxy.dispose();
process.exit(allMatch ? 0 : 1);
