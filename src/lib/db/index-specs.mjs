/**
 * Single source of truth for every MongoDB index this app depends on.
 *
 * Plain JS (not .ts) on purpose: this file is imported by two different
 * runtimes that can't share a build step —
 *   1. scripts/setup-mongodb.mjs, a standalone `node` script with no
 *      TypeScript loader, for environments that want to run index setup
 *      explicitly (e.g. before first traffic on a fresh Atlas cluster, to
 *      avoid the first requests paying index-creation cost).
 *   2. src/instrumentation.ts, which runs `ensureIndexes` once automatically
 *      at server startup so a fresh environment can never silently run
 *      without the uniqueness guarantees routes depend on.
 *
 * `createIndex` is idempotent (a no-op if the index already exists with the
 * same spec) and safe to call concurrently from multiple processes, so
 * calling this on every process start — alongside the standalone script
 * still being run explicitly in some environments — is safe.
 */

export const INDEX_SPECS = [
  // --- users ---
  { collection: "users", spec: { _id: 1 } }, // already primary; explicit for clarity

  // --- pages ---
  { collection: "pages", spec: { user_id: 1, created_at: -1 } },
  { collection: "pages", spec: { collection_id: 1, user_id: 1 } },
  {
    collection: "pages",
    spec: { slug: 1 },
    options: { unique: true, sparse: true }, // slug is optional; unique when present
  },
  // Explore / recent-public-pages queries (getRecentPublicPages, getPublicPagesByUser)
  { collection: "pages", spec: { visibility: 1, password_hash: 1, created_at: -1 } },
  // Featured-pages query (getFeaturedPages)
  { collection: "pages", spec: { featured: 1, visibility: 1, password_hash: 1, created_at: -1 } },
  // Tag-filtered explore query (getPagesByTag)
  {
    collection: "pages",
    spec: { "frontmatter_meta.tags": 1, visibility: 1, password_hash: 1, created_at: -1 },
  },
  // Team-space page listing (getPagesByCollection)
  { collection: "pages", spec: { collection_id: 1, visibility: 1, created_at: -1 } },

  // --- api_keys ---
  { collection: "api_keys", spec: { user_id: 1, created_at: -1 } },
  { collection: "api_keys", spec: { key_hash: 1 }, options: { unique: true } },

  // --- docs ---
  // No TTL index — all published pages (including anonymous ones) are
  // stored indefinitely; this is a deliberate product decision, not an
  // oversight. See terms/page.tsx and privacy/page.tsx.

  // --- rate_limits ---
  // Shared by both the per-minute rate limiter and the anonymous monthly
  // publish quota (src/lib/rate-limit.ts) — bucket keys expire on their own
  // schedule via `expiresAt`, so one TTL index covers both bucket shapes.
  { collection: "rate_limits", spec: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } },

  // --- analytics_events ---
  { collection: "analytics_events", spec: { page_id: 1, created_at: -1 } },
  {
    collection: "analytics_events",
    spec: { session_hash: 1, page_id: 1, event: 1 },
    options: { unique: true },
  },
  { collection: "analytics_events", spec: { created_at: 1 }, options: { expireAfterSeconds: 7_776_000 } },

  // --- page_versions ---
  { collection: "page_versions", spec: { page_id: 1, created_at: -1 } },
  // Authoritative uniqueness guard for snapshotPageVersion's
  // compare-and-swap-via-retry loop (src/lib/db/versions.ts) — without this,
  // two concurrent snapshots can both insert the same version_number.
  { collection: "page_versions", spec: { page_id: 1, version_number: 1 }, options: { unique: true } },

  // --- collections ---
  { collection: "collections", spec: { user_id: 1, name: 1 }, options: { unique: true } },
  // Team-space slugs must be unique (routes depend on /t/[slug] resolving to
  // exactly one team) — sparse because personal collections never set a
  // slug. This is the actual source of truth; src/app/api/teams/route.ts's
  // pre-check is just for a fast, friendly error message.
  { collection: "collections", spec: { slug: 1 }, options: { unique: true, sparse: true } },

  // --- collection_members ---
  // Membership listing (getCollectionMembers) + the authoritative guard
  // against duplicate (collection_id, user_id) rows from a racing
  // addCollectionMember upsert.
  { collection: "collection_members", spec: { collection_id: 1, user_id: 1 }, options: { unique: true } },
  // Reverse lookup (getCollectionMemberships / getTeamSpacesByMembership)
  { collection: "collection_members", spec: { user_id: 1 } },

  // --- webhooks ---
  // getWebhooksByUser lists a user's webhooks sorted by recency.
  { collection: "webhooks", spec: { user_id: 1, created_at: -1 } },

  // --- reactions ---
  // No additional index today: getPageReactions currently does a
  // `{ _id: { $regex: `^${pageId}:` } }` prefix match, which is served by
  // the collection's default _id index (anchored-prefix regex on an
  // indexed field can use the index). NOTE: a parallel workstream is fixing
  // a $regex-injection issue in src/lib/db/reactions.ts and may change this
  // to an equality match on a new indexed field (likely `page_id`) instead
  // of an `_id` prefix — re-check this list once that lands and add
  // `{ collection: "reactions", spec: { page_id: 1 } }` (or similar) then.
];

/**
 * Creates every index in INDEX_SPECS. Safe to call repeatedly and safe to
 * call concurrently from multiple processes — `createIndex` is a no-op if
 * an equivalent index already exists.
 */
export async function ensureIndexes(db) {
  await Promise.all(
    INDEX_SPECS.map(({ collection, spec, options }) => db.collection(collection).createIndex(spec, options)),
  );
}
