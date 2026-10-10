import { getD1 } from "@/lib/d1";
import { NextResponse } from "next/server";

// One statement: SQLite runs it atomically, so concurrent callers cannot
// read the same count. Replaces findOneAndUpdate with $inc and upsert.
async function hit(key: string, expiresAt: number): Promise<number> {
  const row = await getD1()
    .prepare(
      "INSERT INTO rate_limits (id, count, expires_at) VALUES (?, 1, ?) ON CONFLICT (id) DO UPDATE SET count = count + 1 RETURNING count",
    )
    .bind(key, expiresAt)
    .first<{ count: number }>();
  return row?.count ?? 1;
}

/**
 * D1-backed fixed-window rate limiter (60-second buckets).
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
  const count = await hit(`__rl__${discriminator}__${bucket}`, (bucket + 2) * 60_000);

  if (count > limitPerMin) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again." },
      { status: 429 },
    );
  }

  return null;
}

/**
 * Calendar-month quota counter in the same table.
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
  // Expires a few days into the following month.
  const expiresAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 3);
  const count = await hit(`__mq__${discriminator}__${monthBucket}`, expiresAt);

  if (count > limit) {
    return NextResponse.json({ error: message }, { status: 429 });
  }

  return null;
}
