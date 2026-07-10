/**
 * Next.js instrumentation hook — runs once when the server starts.
 *
 * We use it to ensure every MongoDB index the app depends on exists,
 * automatically, rather than relying on someone remembering to run
 * scripts/setup-mongodb.mjs by hand. A fresh environment that skips manual
 * setup would otherwise silently lose every uniqueness guarantee routes
 * depend on (e.g. pages.slug, collections.slug, page_versions'
 * (page_id, version_number)).
 *
 * `ensureIndexes` (shared with scripts/setup-mongodb.mjs via
 * src/lib/db/index-specs.mjs) is idempotent and safe to run concurrently if
 * multiple processes start at once — `createIndex` is a no-op when an
 * equivalent index already exists, and MongoDB does not race unsafely here
 * (we never drop-then-recreate).
 *
 * This is best-effort: a failure here must not prevent the server from
 * starting, so we log and swallow rather than throw.
 */
export async function register() {
  // The mongodb driver is Node-only; skip entirely on the edge runtime.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const [{ getDb }, { ensureIndexes }] = await Promise.all([
      import("@/lib/mongodb"),
      import("@/lib/db/index-specs.mjs"),
    ]);
    const db = await getDb();
    await ensureIndexes(db);
    console.log("[startup] MongoDB indexes ensured.");
  } catch (err) {
    console.error("[startup] Failed to ensure MongoDB indexes (continuing to start anyway):", err);
  }
}
