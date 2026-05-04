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
