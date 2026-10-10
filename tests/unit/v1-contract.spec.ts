import { test, expect } from "@playwright/test";
import { useTestEnv, seedUserWithKey, cleanupPages } from "./helpers/pages";
import { MAX_RAW_CHARS } from "booklet-api-client";
import { getDb } from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/db/index-specs.mjs";
import { createPageRecord, getPageRecord } from "@/lib/db";
import { createId } from "@/lib/id";
import { getDoc } from "@/lib/storage";
import { POST as publish } from "@/app/api/v1/publish/route";
import { GET as listPages } from "@/app/api/v1/pages/route";
import { GET as getPage, PATCH as patchPage, DELETE as deletePage } from "@/app/api/v1/pages/[id]/route";

// The HTTP contract of /api/v1: RFC 9457 problem details, rate-limit
// headers, Idempotency-Key, ETag / If-Match and cursor pagination.

const BASE = "http://localhost/api/v1";
const created: string[] = [];
const userIds: string[] = [];

async function newUser() {
  const u = await seedUserWithKey();
  userIds.push(u.userId);
  return u;
}

function call(key: string | null, path: string, init: RequestInit = {}) {
  return new Request(`${BASE}${path}`, {
    ...init,
    headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}), ...init.headers },
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function publishRaw(key: string, raw: string, headers: Record<string, string> = {}) {
  const res = await publish(call(key, "/publish", { method: "POST", body: JSON.stringify({ raw }), headers }));
  const body = await res.clone().json();
  if (res.status === 201) created.push(body.id);
  return { res, body };
}

async function expectProblem(res: Response, status: number) {
  expect(res.status).toBe(status);
  expect(res.headers.get("content-type")).toContain("application/problem+json");
  const body = await res.json();
  expect(body.type).toBe("about:blank");
  expect(typeof body.title).toBe("string");
  expect(body.status).toBe(status);
  expect(typeof body.detail).toBe("string");
  expect(body.error).toBe(body.detail); // the pre-RFC member every client reads
  return body;
}

test.beforeAll(async () => {
  useTestEnv();
  await ensureIndexes(await getDb());
});

test.afterAll(async () => {
  await cleanupPages(created, userIds);
  await (await getDb()).collection("idempotency_keys").deleteMany({ user_id: { $in: userIds } });
});

test.describe("problem details", () => {
  test("400, 401, 404, 409 and 413 are RFC 9457 bodies", async () => {
    const { rawKey } = await newUser();

    await expectProblem(await publish(call(rawKey, "/publish", { method: "POST", body: "{not json" })), 400);
    const unauth = await publish(call(null, "/publish", { method: "POST", body: "{}" }));
    await expectProblem(unauth, 401);
    await expectProblem(await getPage(call(rawKey, "/pages/nopenope00"), params("nopenope00")), 404);

    const slug = `taken-${createId(10).toLowerCase()}`;
    await publishRaw(rawKey, `---\nslug: ${slug}\n---\n# One`);
    const two = await publishRaw(rawKey, "# Two");
    const conflict = await patchPage(
      call(rawKey, `/pages/${two.body.id}`, { method: "PATCH", body: JSON.stringify({ slug }) }),
      params(two.body.id),
    );
    expect((await expectProblem(conflict, 409)).code).toBe("SLUG_TAKEN");
  });

  test("413 says which of the two size limits was hit", async () => {
    const { rawKey } = await newUser();

    const tooLong = await publishRaw(rawKey, "a".repeat(MAX_RAW_CHARS + 1));
    const chars = await expectProblem(tooLong.res, 413);
    expect(chars).toMatchObject({ limit: "characters", max: MAX_RAW_CHARS, actual: MAX_RAW_CHARS + 1 });

    // Under the character limit, but its parsed form is far over the byte limit.
    const dense = await publishRaw(rawKey, "a\n\n".repeat(40_000));
    const bytes = await expectProblem(dense.res, 413);
    expect(bytes).toMatchObject({ limit: "stored_bytes", max: 600_000 });
    expect(bytes.actual).toBeGreaterThan(600_000);
  });
});

test("rate-limit headers: RateLimit and RateLimit-Policy on 200, plus Retry-After on 429", async () => {
  const { rawKey } = await newUser();

  const ok = await listPages(call(rawKey, "/pages"));
  expect(ok.status).toBe(200);
  expect(ok.headers.get("ratelimit-policy")).toBe('"default";q=60;w=60');
  expect(ok.headers.get("ratelimit")).toMatch(/^"default";r=\d+;t=\d+$/);
  expect(ok.headers.get("retry-after")).toBeNull();

  // The window is a wall-clock minute, so allow for it rolling over mid-loop.
  let limited: Response | null = null;
  for (let i = 0; i < 125 && !limited; i++) {
    const res = await listPages(call(rawKey, "/pages"));
    if (res.status === 429) limited = res;
  }
  expect(limited).not.toBeNull();
  expect(limited!.headers.get("ratelimit-policy")).toBe('"default";q=60;w=60');
  expect(limited!.headers.get("ratelimit")).toMatch(/^"default";r=0;t=\d+$/);
  const retryAfter = Number(limited!.headers.get("retry-after"));
  expect(retryAfter).toBeGreaterThanOrEqual(1);
  expect(retryAfter).toBeLessThanOrEqual(60);
  await expectProblem(limited!, 429);
});

test.describe("Idempotency-Key", () => {
  test("a repeat creates one page and returns the identical body", async () => {
    const { rawKey, userId } = await newUser();
    const key = { "Idempotency-Key": crypto.randomUUID() };

    const first = await publishRaw(rawKey, "# Once", key);
    const second = await publishRaw(rawKey, "# Once", key);
    expect(first.res.status).toBe(201);
    expect(second.res.status).toBe(201);
    expect(second.body).toEqual(first.body);
    expect(second.res.headers.get("idempotent-replayed")).toBe("true");
    expect(await (await getDb()).collection("pages").countDocuments({ user_id: userId })).toBe(1);
  });

  test("concurrent repeats still create one page", async () => {
    const { rawKey, userId } = await newUser();
    const key = { "Idempotency-Key": crypto.randomUUID() };
    const results = await Promise.all([1, 2, 3, 4].map(() => publishRaw(rawKey, "# Race", key)));
    // Losers get the stored response, or 409 while the winner is still running.
    expect(results.every((r) => r.res.status === 201 || r.res.status === 409)).toBe(true);
    expect(await (await getDb()).collection("pages").countDocuments({ user_id: userId })).toBe(1);
  });

  test("the same key with a different body is 422 and creates nothing", async () => {
    const { rawKey, userId } = await newUser();
    const key = { "Idempotency-Key": crypto.randomUUID() };
    await publishRaw(rawKey, "# First body", key);
    const other = await publishRaw(rawKey, "# Second body", key);
    await expectProblem(other.res, 422);
    expect(await (await getDb()).collection("pages").countDocuments({ user_id: userId })).toBe(1);
  });

  test("a failed request does not burn the key, and keys are per user", async () => {
    const a = await newUser();
    const b = await newUser();
    const key = { "Idempotency-Key": crypto.randomUUID() };

    const failed = await publish(call(a.rawKey, "/publish", { method: "POST", body: "{}", headers: key }));
    expect(failed.status).toBe(400);
    const retried = await publishRaw(a.rawKey, "# Retry works", key);
    expect(retried.res.status).toBe(201);

    const otherUser = await publishRaw(b.rawKey, "# Mine", key);
    expect(otherUser.res.status).toBe(201);
    expect(otherUser.body.id).not.toBe(retried.body.id);
  });
});

test.describe("conditional requests", () => {
  test("GET returns an ETag and answers If-None-Match with 304", async () => {
    const { rawKey } = await newUser();
    const { body } = await publishRaw(rawKey, "# Tagged");
    const res = await getPage(call(rawKey, `/pages/${body.id}`), params(body.id));
    const etag = res.headers.get("etag")!;
    expect(etag).toMatch(/^"[0-9a-f]{32}"$/);

    const again = await getPage(call(rawKey, `/pages/${body.id}`, { headers: { "If-None-Match": etag } }), params(body.id));
    expect(again.status).toBe(304);
  });

  test("a stale If-Match is 412 on PATCH and DELETE and changes nothing", async () => {
    const { rawKey } = await newUser();
    const { body } = await publishRaw(rawKey, "# Version one");
    const id = body.id as string;
    const etag1 = (await getPage(call(rawKey, `/pages/${id}`), params(id))).headers.get("etag")!;

    const ok = await patchPage(
      call(rawKey, `/pages/${id}`, { method: "PATCH", body: JSON.stringify({ raw: "# Version two" }), headers: { "If-Match": etag1 } }),
      params(id),
    );
    expect(ok.status).toBe(200);
    const etag2 = ok.headers.get("etag")!;
    expect(etag2).not.toBe(etag1);
    expect((await getPage(call(rawKey, `/pages/${id}`), params(id))).headers.get("etag")).toBe(etag2);

    const stale = await patchPage(
      call(rawKey, `/pages/${id}`, { method: "PATCH", body: JSON.stringify({ raw: "# Version three", visibility: "public" }), headers: { "If-Match": etag1 } }),
      params(id),
    );
    await expectProblem(stale, 412);
    expect((await getDoc(id))?.raw).toBe("# Version two");
    expect((await getPageRecord(id))?.visibility).toBe("unlisted");

    const staleDelete = await deletePage(call(rawKey, `/pages/${id}`, { method: "DELETE", headers: { "If-Match": etag1 } }), params(id));
    await expectProblem(staleDelete, 412);
    expect(await getPageRecord(id)).not.toBeNull();

    const del = await deletePage(call(rawKey, `/pages/${id}`, { method: "DELETE", headers: { "If-Match": etag2 } }), params(id));
    expect(del.status).toBe(200);
    expect(await getPageRecord(id)).toBeNull();
  });
});

test("cursor pagination returns each of 250 pages exactly once while pages are inserted", async () => {
  const { rawKey, userId } = await newUser();
  const seeded = new Set<string>();
  // Seeded in parallel on purpose: many pages share a created_at millisecond,
  // which is what the cursor's id tie-breaker exists for.
  await Promise.all(
    Array.from({ length: 250 }, async (_, i) => {
      const id = createId(10);
      seeded.add(id);
      await createPageRecord(id, userId, `Seed ${i}`);
    }),
  );

  const seen: string[] = [];
  let cursor: string | null = null;
  let requests = 0;
  do {
    const res: Response = await listPages(call(rawKey, `/pages?limit=40${cursor ? `&cursor=${cursor}` : ""}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    seen.push(...body.pages.map((p: { id: string }) => p.id));
    cursor = body.next_cursor;
    // Another client publishes between requests.
    await createPageRecord(createId(10), userId, `Inserted during walk ${requests}`);
    requests++;
  } while (cursor && requests < 20);

  expect(cursor).toBeNull();
  const seenSeeded = seen.filter((id) => seeded.has(id));
  expect(seenSeeded.length).toBe(250);
  expect(new Set(seenSeeded).size).toBe(250);
  expect(new Set(seen).size).toBe(seen.length);

  expect((await listPages(call(rawKey, "/pages?cursor=not-a-cursor"))).status).toBe(400);
});
