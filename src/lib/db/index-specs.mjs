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
  // Sparse: only enforced once email is populated for every doc (post-Clerk-
  // migration, see PLAN-backend-auth-migration.md) — sparse avoids a
  // duplicate-null collision across legacy docs missing the field.
  { collection: "users", spec: { email: 1 }, options: { unique: true, sparse: true } },

  // --- sessions ---
  // In-house auth (src/lib/auth/session.ts). token_hash is the authoritative
  // lookup for a session cookie; user_id backs "log out everywhere"; the TTL
  // index expires sessions server-side in lockstep with their sliding window.
  { collection: "sessions", spec: { token_hash: 1 }, options: { unique: true } },
  { collection: "sessions", spec: { user_id: 1 } },
  { collection: "sessions", spec: { expires_at: 1 }, options: { expireAfterSeconds: 0 } },

  // --- password_reset_tokens ---
  // Forgot-password flow (src/lib/auth/password-reset-token.ts). token_hash
  // is the authoritative lookup for a reset link; the TTL index expires
  // unused tokens 30 minutes after issuance, matching the email's stated
  // expiry window.
  { collection: "password_reset_tokens", spec: { token_hash: 1 }, options: { unique: true } },
  { collection: "password_reset_tokens", spec: { user_id: 1 } },
  { collection: "password_reset_tokens", spec: { expires_at: 1 }, options: { expireAfterSeconds: 0 } },

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
  // TTL indexes only expire documents where the indexed field holds an
  // actual BSON Date — `created_at` everywhere in this codebase is written
  // as `new Date().toISOString()` (a string) for display/range-query
  // consistency, so it can't back a TTL index. `expires_at` is a dedicated
  // BSON Date field written alongside `created_at` for this sole purpose.
  { collection: "analytics_events", spec: { expires_at: 1 }, options: { expireAfterSeconds: 7_776_000 } },

  // --- page_versions ---
  { collection: "page_versions", spec: { page_id: 1, created_at: -1 } },
  // Authoritative uniqueness guard for snapshotPageVersion's
  // compare-and-swap-via-retry loop (src/lib/db/versions.ts) — without this,
  // two concurrent snapshots can both insert the same version_number.
  { collection: "page_versions", spec: { page_id: 1, version_number: 1 }, options: { unique: true } },

  // --- collections ---
  // Uniqueness is scoped to the containing folder, not global per-user —
  // "Drafts" can exist both at top-level and inside another folder. This
  // replaced a plain {user_id, name} unique index; see the explicit
  // dropIndex in ensureIndexes below for the migration off the old spec.
  { collection: "collections", spec: { user_id: 1, parent_id: 1, name: 1 }, options: { unique: true } },
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
  // getPageReactions queries `{ page_id: pageId }` (an equality match, not
  // the old `{ _id: { $regex: `^${pageId}:` } }` prefix scan it used to do
  // — that was a $regex-injection issue: an unvalidated pageId route param
  // built directly into a regex could over-match other pages' reaction
  // docs, or cause ReDoS via a pathological pattern). This index serves
  // that equality match.
  { collection: "reactions", spec: { page_id: 1 } },

  // --- reaction_state ---
  // Per-session toggle state for reactions (addReactionForSession /
  // removeReactionForSession in src/lib/db/reactions.ts) — "has this
  // session already reacted with this emoji on this page." Authoritative
  // guard so a session can only contribute +1 to a given (page, emoji)
  // count at a time, no matter how many times it clicks/replays.
  {
    collection: "reaction_state",
    spec: { session_hash: 1, page_id: 1, emoji: 1 },
    options: { unique: true },
  },

  // --- view_dedupe ---
  // View-count dedupe (incrementViewCount in src/lib/db/index.ts) — one
  // counted view per session_hash per page, mirroring analytics_events'
  // session-scoped dedupe so a single visitor's reloads/bot re-fetches
  // don't keep inflating the page's view_count.
  {
    collection: "view_dedupe",
    spec: { session_hash: 1, page_id: 1 },
    options: { unique: true },
  },
  // Same retention window as analytics_events (90 days) for consistency;
  // same `expires_at` BSON-Date-for-TTL rationale as analytics_events above.
  { collection: "view_dedupe", spec: { expires_at: 1 }, options: { expireAfterSeconds: 7_776_000 } },

  // --- drafts ---
  // Cloud draft sync for signed-in users (P4-2, src/lib/db/drafts.ts). Backs
  // getDraftsByUser's per-user listing, sorted by recency. Note this
  // collection stores DraftDoc's own camelCase `updatedAt` field (mirroring
  // the client document as-is), unlike `pages`' snake_case `created_at`.
  { collection: "drafts", spec: { user_id: 1, updatedAt: -1 } },
];

/**
 * Creates every index in INDEX_SPECS. Safe to call repeatedly and safe to
 * call concurrently from multiple processes — `createIndex` is a no-op if
 * an equivalent index already exists.
 */
export async function ensureIndexes(db) {
  // One-time migration off the old {user_id, name} unique index, superseded
  // by {user_id, parent_id, name} above — createIndex never removes a
  // stale index on its own, so this has to be explicit. Safe to call
  // repeatedly: dropIndex throws IndexNotFound (code 27) once the old index
  // is gone (the expected steady state on a long-lived database), or
  // NamespaceNotFound (code 26) if the `collections` collection doesn't
  // exist at all yet (a genuinely fresh database, e.g. a CI service
  // container — found live: this exact case, uncaught, was crashing
  // ensureIndexes and failing every unit test in the same run).
  try {
    await db.collection("collections").dropIndex("user_id_1_name_1");
  } catch (err) {
    if (err?.code !== 27 && err?.code !== 26) throw err;
  }

  await Promise.all(
    INDEX_SPECS.map(({ collection, spec, options }) => db.collection(collection).createIndex(spec, options)),
  );
}
