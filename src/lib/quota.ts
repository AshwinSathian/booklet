import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

// Thresholds at 80% of Cloudflare free-tier daily limits.
// Free tier: KV writes/deletes = 1,000/day | KV reads = 100,000/day
export const QUOTA = {
  KV_WRITES: { threshold: 800, freeLimit: 1_000, label: "KV write" },
  KV_READS: { threshold: 80_000, freeLimit: 100_000, label: "KV read" },
  KV_DELETES: { threshold: 800, freeLimit: 1_000, label: "KV delete" },
} as const;

export type QuotaResource = keyof typeof QUOTA;

function tomorrowMidnightUtc(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 19) + "Z";
}

export class QuotaExceededError extends Error {
  readonly resource: QuotaResource;
  readonly resetAt: string;
  readonly retryAfterSeconds: number;

  constructor(resource: QuotaResource) {
    const resetAt = tomorrowMidnightUtc();
    const cfg = QUOTA[resource];
    super(
      `Readable has hit its free-tier ${cfg.label} quota ` +
        `(${cfg.threshold.toLocaleString()} of ${cfg.freeLimit.toLocaleString()}/day). ` +
        `Service resumes at ${resetAt} UTC.`,
    );
    this.name = "QuotaExceededError";
    this.resource = resource;
    this.resetAt = resetAt;
    this.retryAfterSeconds = Math.ceil(
      (new Date(resetAt).getTime() - Date.now()) / 1000,
    );
  }
}

/**
 * Atomically increments the daily counter for `resource` in D1.
 * Throws QuotaExceededError if the threshold is already reached.
 * Fails open on D1 errors so quota checks never block legitimate traffic.
 */
export async function checkAndBumpQuota(resource: QuotaResource): Promise<void> {
  let db: D1Database;
  try {
    db = getCloudflareContext().env.READABLE_DB;
  } catch {
    return; // Not in a CF context (local dev) — skip
  }

  const today = new Date().toISOString().slice(0, 10);
  const { threshold } = QUOTA[resource];

  let row: { count: number } | null = null;
  try {
    row = await db
      .prepare(
        `INSERT INTO quota_counters (resource, count, period)
         VALUES (?, 1, ?)
         ON CONFLICT(resource) DO UPDATE SET
           count  = CASE WHEN period = excluded.period THEN count + 1 ELSE 1 END,
           period = excluded.period
         RETURNING count`,
      )
      .bind(resource, today)
      .first<{ count: number }>();
  } catch {
    return; // D1 failure → fail open, don't block the operation
  }

  if (row && row.count > threshold) {
    throw new QuotaExceededError(resource);
  }
}

/** Converts a QuotaExceededError into a 503 NextResponse with proper headers. */
export function quotaErrorResponse(e: QuotaExceededError): NextResponse {
  return NextResponse.json(
    { error: e.message, retryAfter: e.resetAt },
    {
      status: 503,
      headers: {
        "Retry-After": String(e.retryAfterSeconds),
        "X-Quota-Resource": e.resource,
        "X-Quota-Resets-At": e.resetAt,
      },
    },
  );
}
