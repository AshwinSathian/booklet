import { getDb } from "@/lib/mongodb";
import { NextResponse } from "next/server";

type RateLimitDoc = {
  _id: string;
  count: number;
  expiresAt: Date;
};

/**
 * MongoDB-backed sliding-window rate limiter (60-second buckets).
 *
 * @param discriminator  Unique string identifying the bucket, e.g. `publish__ip__1.2.3.4`
 * @param limitPerMin    Max allowed calls within the current 60-second window
 * @returns              A 429 NextResponse if the call should be blocked, otherwise null
 */
export async function checkRateLimit(
  discriminator: string,
  limitPerMin: number,
): Promise<NextResponse | null> {
  const bucket = Math.floor(Date.now() / 60_000);
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

  if (count > limitPerMin) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again." },
      { status: 429 },
    );
  }

  return null;
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
    return NextResponse.json({ error: message }, { status: 429 });
  }

  return null;
}
