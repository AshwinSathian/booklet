/**
 * Next.js instrumentation hook.
 *
 * Spike: empty on Workers. The MongoDB build did two things here, and
 * neither fits a Worker, which has no start-up moment and no long-lived
 * process:
 *   - ensureIndexes at start: the D1 schema and its indexes are applied by
 *     `wrangler d1 migrations apply` at deploy time (migrations/).
 *   - the daily purge timer: replaced by a Cron Trigger; see
 *     custom-worker.ts and the "triggers" block in wrangler.jsonc.
 */
export async function register() {}
