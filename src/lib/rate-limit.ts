import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { checkAndBumpQuota, QuotaExceededError, quotaErrorResponse } from "./quota";

/**
 * KV-backed sliding-window rate limiter.
 * Counts the counter's own KV read+write against the free-tier quota so the
 * quota system stays consistent with the rest of the app.
 *
 * @param discriminator  Unique string identifying the rate-limit bucket,
 *                       e.g. `publish__ip__1.2.3.4` or `v1__userId__abc`.
 * @param limitPerMin    Maximum allowed calls within the current 60-second window.
 * @returns              A 429 (rate limit) or 503 (quota exhausted) NextResponse
 *                       if the call should be blocked, otherwise null.
 */
export async function checkRateLimit(
  discriminator: string,
  limitPerMin: number,
): Promise<NextResponse | null> {
  // Gate the counter's own KV operations against the free-tier quota.
  try {
    await checkAndBumpQuota("KV_READS");
  } catch (e) {
    if (e instanceof QuotaExceededError) return quotaErrorResponse(e);
    throw e;
  }
  try {
    await checkAndBumpQuota("KV_WRITES");
  } catch (e) {
    if (e instanceof QuotaExceededError) return quotaErrorResponse(e);
    throw e;
  }

  const bucket = Math.floor(Date.now() / 60_000);
  const key = `__rl__${discriminator}__${bucket}`;

  const kv = getCloudflareContext().env.READABLE_DOCS;
  const raw = await kv.get(key);
  const curr = raw ? Number(raw) : 0;
  const next = Number.isFinite(curr) ? curr + 1 : 1;

  await kv.put(key, String(next), { expirationTtl: 90 });

  if (next > limitPerMin) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again." },
      { status: 429 },
    );
  }

  return null;
}
