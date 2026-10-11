import { getDb } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { problem } from "@/server/errors";

type RateLimitDoc = {
  _id: string;
  count: number;
  expiresAt: Date;
};

export type RateLimitState = {
  limit: number;
  remaining: number;
  /** Seconds until the current window ends. */
  reset: number;
  limited: boolean;
};

/**
 * MongoDB-backed fixed-window rate limiter (60-second buckets). Counts this
 * call and reports where the caller stands.
 *
 * @param discriminator  Unique string identifying the bucket, e.g. `publish__ip__1.2.3.4`
 * @param limitPerMin    Max allowed calls within the current 60-second window
 */
export async function consumeRateLimit(discriminator: string, limitPerMin: number): Promise<RateLimitState> {
  const now = Date.now();
  const bucket = Math.floor(now / 60_000);
  const key = `__rl__${discriminator}__${bucket}`;
  const expiresAt = new Date((bucket + 2) * 60_000); // expires after two bucket windows

  const db = await getDb();
  const result = await db
    .collection<RateLimitDoc>("rate_limits")
    .findOneAndUpdate(
      { _id: key },
      {
        $inc: { count: 1 },
        $setOnInsert: { _id: key, expiresAt },
      },
      { upsert: true, returnDocument: "after" },
    );

  const count = result?.count ?? 1;
  return {
    limit: limitPerMin,
    remaining: Math.max(0, limitPerMin - count),
    reset: Math.max(1, Math.ceil(((bucket + 1) * 60_000 - now) / 1000)),
    limited: count > limitPerMin,
  };
}

/**
 * `RateLimit` and `RateLimit-Policy` in the syntax of
 * draft-ietf-httpapi-ratelimit-headers-11, plus `Retry-After` (RFC 9110)
 * once the limit is hit. The draft can still change; `Retry-After` is the
 * header clients should act on. This is the only place the syntax lives.
 */
export function rateLimitHeaders(s: RateLimitState): Record<string, string> {
  return {
    "RateLimit-Policy": `"default";q=${s.limit};w=60`,
    RateLimit: `"default";r=${s.remaining};t=${s.reset}`,
    ...(s.limited ? { "Retry-After": String(s.reset) } : {}),
  };
}

/** @returns A 429 response if the call should be blocked, otherwise null */
export async function checkRateLimit(
  discriminator: string,
  limitPerMin: number,
): Promise<NextResponse | null> {
  const state = await consumeRateLimit(discriminator, limitPerMin);
  if (!state.limited) return null;
  return problem(429, "Too many requests. Please slow down and try again.", undefined, rateLimitHeaders(state));
}

/**
 * MongoDB-backed rolling-calendar-month quota counter.
 *
 * Same bucket-key + atomic-`$inc` + TTL-index pattern as `checkRateLimit`
 * above, reusing the same `rate_limits` collection (it already has a TTL
 * index on `expiresAt`; a monthly bucket is just a differently-shaped key
 * with a differently-shaped expiry, not a different subsystem).
 *
 * @param discriminator  Unique string identifying the counter, e.g. `publish__ip__1.2.3.4`
 * @param limit          Max allowed calls within the current calendar month
 * @returns              A 429 NextResponse if the call should be blocked, otherwise null
 */
export async function checkMonthlyQuota(
  discriminator: string,
  limit: number,
  message: string,
): Promise<NextResponse | null> {
  const now = new Date();
  const monthBucket = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const key = `__mq__${discriminator}__${monthBucket}`;
  // Expire a few days into the following month so the TTL index cleans up
  // the bucket automatically without racing the last few hours of the month.
  const expiresAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 3));

  const db = await getDb();
  const result = await db
    .collection<RateLimitDoc>("rate_limits")
    .findOneAndUpdate(
      { _id: key },
      {
        $inc: { count: 1 },
        $setOnInsert: { _id: key, expiresAt },
      },
      { upsert: true, returnDocument: "after" },
    );

  const count = result?.count ?? 1;

  if (count > limit) {
    return problem(429, message);
  }

  return null;
}
