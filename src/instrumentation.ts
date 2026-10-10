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

  const { logInfo, logError } = await import("@/lib/logger");

  try {
    const [{ getDb }, { ensureIndexes }] = await Promise.all([
      import("@/lib/mongodb"),
      import("@/lib/db/index-specs.mjs"),
    ]);
    const db = await getDb();
    await ensureIndexes(db);
    logInfo("startup", "MongoDB indexes ensured.");
  } catch (err) {
    logError("startup", "Failed to ensure MongoDB indexes (continuing to start anyway)", err);
  }

  // Daily purge of anonymous pages 30 days past their 90-day expiry. An
  // in-process timer, not launchd/cron: the app already runs as one
  // long-lived process, and the first run a minute after every start means
  // a restart never skips a day. `unref` so the timer never holds the
  // process open.
  const purge = async () => {
    try {
      const { purgeExpiredAnonymousDocs } = await import("@/lib/db/purge");
      const deleted = await purgeExpiredAnonymousDocs();
      if (deleted > 0) logInfo("expiry", "Purged expired anonymous pages", { deleted });
    } catch (err) {
      logError("expiry", "Anonymous page purge failed", err);
    }
  };
  setTimeout(purge, 60_000).unref();
  setInterval(purge, 86_400_000).unref();
}
