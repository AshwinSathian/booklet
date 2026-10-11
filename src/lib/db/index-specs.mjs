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
  { collection: "users", spec: { email: 1 }, options: { unique: true } },

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

  // --- email_verification_tokens ---
  // Same shape as password_reset_tokens: looked up by hash, one live token
  // per user, removed by TTL 24 hours after issue.
  { collection: "email_verification_tokens", spec: { token_hash: 1 }, options: { unique: true } },
  { collection: "email_verification_tokens", spec: { user_id: 1 } },
  { collection: "email_verification_tokens", spec: { expires_at: 1 }, options: { expireAfterSeconds: 0 } },

  // --- user_identities ---
  // A GitHub or Google account signs in exactly one Booklet user, and a
  // user has at most one identity per provider.
  { collection: "user_identities", spec: { provider: 1, provider_user_id: 1 }, options: { unique: true } },
  { collection: "user_identities", spec: { user_id: 1, provider: 1 }, options: { unique: true } },

  // --- passkeys, webauthn_challenges ---
  { collection: "passkeys", spec: { user_id: 1, created_at: 1 } },
  { collection: "webauthn_challenges", spec: { expires_at: 1 }, options: { expireAfterSeconds: 0 } },

  // --- pages ---
  // _id is the tie-breaker of the listing sort (getPagesByUser) and of its
  // keyset cursor, so it is part of the index.
  { collection: "pages", spec: { user_id: 1, created_at: -1, _id: -1 } },
  { collection: "pages", spec: { collection_id: 1, user_id: 1 } },
  {
    collection: "pages",
    spec: { slug: 1 },
    options: { unique: true, sparse: true }, // slug is optional; unique when present
  },
  // Explore / recent-public-pages queries (getRecentPublicPages, getPublicPagesByUser)
  { collection: "pages", spec: { visibility: 1, password_hash: 1, created_at: -1 } },
  // Tag-filtered explore query (getPagesByTag)
  {
    collection: "pages",
    spec: { "frontmatter_meta.tags": 1, visibility: 1, password_hash: 1, created_at: -1 },
  },
  // Team-space page listing (getPagesByCollection)
  { collection: "pages", spec: { collection_id: 1, visibility: 1, created_at: -1 } },
  // `?type=` on the page list, for one account and for one team space.
  { collection: "pages", spec: { user_id: 1, doc_type: 1, created_at: -1 } },
  { collection: "pages", spec: { collection_id: 1, doc_type: 1, created_at: -1 } },

  // --- page_links ---
  // `[[Title]]` links resolved at publish. One row per (source, target);
  // target_id backs the "Referenced by" list on a share page.
  { collection: "page_links", spec: { source_id: 1, target_id: 1 }, options: { unique: true } },
  { collection: "page_links", spec: { target_id: 1 } },

  // --- api_keys ---
  { collection: "api_keys", spec: { user_id: 1, created_at: -1 } },
  { collection: "api_keys", spec: { key_hash: 1 }, options: { unique: true } },

  // --- docs ---
  // Anonymous pages carry `expires_at` (publish date + 90 days) and are
  // deleted 30 days after it by purgeExpiredAnonymousDocs
  // (src/lib/db/purge.ts). Deliberately NOT a TTL index: the purge also
  // checks that no `pages` record exists, so a page that was claimed can
  // never be deleted by a stale expires_at. Sparse because owned pages
  // never have the field.
  { collection: "docs", spec: { expires_at: 1 }, options: { sparse: true } },

  // --- reports ---
  // Abuse reports (src/lib/db/reports.ts). The admin queue lists open
  // reports newest first; takedown closes every open report for a page.
  { collection: "reports", spec: { status: 1, created_at: -1 } },
  { collection: "reports", spec: { page_id: 1, status: 1 } },

  // --- rate_limits ---
  // Shared by both the per-minute rate limiter and the anonymous monthly
  // publish quota (src/lib/rate-limit.ts) — bucket keys expire on their own
  // schedule via `expiresAt`, so one TTL index covers both bucket shapes.
  { collection: "rate_limits", spec: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } },

  // --- OAuth authorization server (src/lib/oauth/server.ts) ---
  // Codes and tokens are keyed by their hash (_id). TTL indexes remove them
  // once expired; grant_id backs "revoke everything from this consent".
  { collection: "oauth_codes", spec: { purge_at: 1 }, options: { expireAfterSeconds: 0 } },
  { collection: "oauth_codes", spec: { grant_id: 1 } },
  { collection: "oauth_tokens", spec: { expires_at: 1 }, options: { expireAfterSeconds: 0 } },
  { collection: "oauth_tokens", spec: { grant_id: 1 } },
  { collection: "oauth_tokens", spec: { user_id: 1 } },

  // --- idempotency_keys ---
  // Stored responses for `Idempotency-Key` on POST /api/v1/publish
  // (src/server/idempotency.ts). Kept for 24 hours.
  { collection: "idempotency_keys", spec: { expires_at: 1 }, options: { expireAfterSeconds: 0 } },

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
  // "Drafts" can exist both at top-level and inside another folder.
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

  // --- publish_events ---
  // deletePageAssociatedRecords.
  { collection: "publish_events", spec: { page_id: 1 } },

  // --- webhook_deliveries ---
  // The delivery log per webhook, newest first (getWebhookDeliveries, and
  // the trim to 50 in recordWebhookDelivery).
  { collection: "webhook_deliveries", spec: { webhook_id: 1, created_at: -1 } },
  // deletePageAssociatedRecords and deleteAccount.
  { collection: "webhook_deliveries", spec: { page_id: 1 } },
  { collection: "webhook_deliveries", spec: { user_id: 1 } },

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

  // --- error_events ---
  // One row per distinct logged error (src/lib/db/error-events.ts), gone 30
  // days after it was last seen. The admin page sorts on the same field.
  { collection: "error_events", spec: { last_seen: 1 }, options: { expireAfterSeconds: 2_592_000 } },

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
 *
 * When a spec's options have changed since a database's index was built
 * (IndexOptionsConflict 85, IndexKeySpecsConflict 86), the index on those
 * keys is dropped and built again with the options here. That is how an
 * existing database picks up, say, `users.email` losing `sparse`, with the
 * collection unguarded for the milliseconds between the two commands and
 * not for a whole deploy.
 */
export async function ensureIndexes(db) {
  await Promise.all(
    INDEX_SPECS.map(async ({ collection, spec, options }) => {
      const col = db.collection(collection);
      try {
        await col.createIndex(spec, options);
      } catch (err) {
        if (err?.code !== 85 && err?.code !== 86) throw err;
        await col.dropIndex(spec);
        await col.createIndex(spec, options);
      }
    }),
  );
}
