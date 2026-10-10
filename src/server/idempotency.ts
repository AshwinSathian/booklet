import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { problem } from "./errors";

type IdempotencyDoc = {
  _id: string; // sha256(user id + key): the raw key is never stored
  user_id: string;
  body_hash: string;
  response: { status: number; body: unknown } | null; // null while the first request runs
  expires_at: Date;
};

const RETENTION_MS = 24 * 60 * 60 * 1000;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * `Idempotency-Key` handling (draft-ietf-httpapi-idempotency-key-header).
 * Without the header, `run` just runs. With it, the first request runs and
 * its 2xx response is stored for 24 hours; a repeat with the same body gets
 * the stored response, and a repeat with a different body gets 422. A failed
 * first request stores nothing, so the client can retry with the same key.
 */
export async function idempotent(
  req: Request,
  userId: string,
  bodyText: string,
  run: () => Promise<Response>,
): Promise<Response> {
  const key = req.headers.get("idempotency-key");
  if (key === null) return run();
  if (!key.trim() || key.length > 255) {
    return problem(400, "Idempotency-Key must be 1 to 255 characters.");
  }

  const _id = sha256(`${userId}\n${key}`);
  const body_hash = sha256(bodyText);
  const col = (await getDb()).collection<IdempotencyDoc>("idempotency_keys");

  try {
    await col.insertOne({ _id, user_id: userId, body_hash, response: null, expires_at: new Date(Date.now() + RETENTION_MS) });
  } catch (e) {
    if (!(typeof e === "object" && e !== null && "code" in e && e.code === 11000)) throw e;
    const row = await col.findOne({ _id });
    if (row && row.body_hash !== body_hash) {
      return problem(422, "This Idempotency-Key was already used with a different request body.");
    }
    // ponytail: a process killed mid-request leaves the key "in progress"
    // until it expires (24 h). Add a started_at lease if that ever bites.
    if (!row?.response) {
      return problem(409, "A request with this Idempotency-Key is still in progress.", undefined, { "Retry-After": "1" });
    }
    return NextResponse.json(row.response.body, {
      status: row.response.status,
      headers: { "Idempotent-Replayed": "true" },
    });
  }

  let res: Response;
  try {
    res = await run();
  } catch (e) {
    await col.deleteOne({ _id });
    throw e;
  }
  if (res.ok) {
    await col.updateOne({ _id }, { $set: { response: { status: res.status, body: await res.clone().json() } } });
  } else {
    await col.deleteOne({ _id });
  }
  return res;
}
