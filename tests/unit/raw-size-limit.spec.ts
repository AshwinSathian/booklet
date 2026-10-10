import { test, expect } from "@playwright/test";
import { sessionCookieFor, withRequestScope } from "./helpers/request-scope";
import { MAX_RAW_CHARS } from "booklet-api-client";
import { getDb } from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/db/index-specs.mjs";
import { createApiKey, createPageRecord } from "@/lib/db";
import { generateRawKey, hashApiKey } from "@/lib/api-key";
import { createId } from "@/lib/id";
import { STORAGE } from "@/lib/constants";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { getDoc, putDoc } from "@/lib/storage";
import { POST as v1Publish } from "@/app/api/v1/publish/route";
import { PATCH as v1Patch } from "@/app/api/v1/pages/[id]/route";
import { POST as webPublish } from "@/app/api/publish/route";
import { PATCH as webPatch } from "@/app/api/publish/[id]/route";
import { PublishPageInputSchema, UpdatePageInputSchema } from "../../mcp-server/src/schemas.js";

// One document size limit on every publish path. Before this, each route
// silently stored `raw.slice(0, 200_000)` next to blocks parsed from the
// *whole* input, so a 200,001+ character document published "successfully"
// with a truncated source — the editor and `GET /api/v1/pages/:id` then
// showed less than the page rendered.

// Unique prefix so "nothing stored" can be asserted without counting the
// whole collection (other spec files insert docs in parallel workers).
const MARK = `oversize${crypto.randomUUID().replace(/-/g, "")}`;
const OVER = MARK + "a".repeat(MAX_RAW_CHARS + 1 - MARK.length);
const AT = "a".repeat(MAX_RAW_CHARS);

let userId: string;
let keyId: string;
let rawKey: string;
let cookie: string;
const created: string[] = [];

test.beforeAll(async () => {
  process.env.MONGODB_URI ??= "mongodb://localhost:27017/booklet?retryWrites=true&w=majority";
  process.env.API_KEY_PEPPER ??= "test-only-pepper-do-not-use-in-prod";
  const db = await getDb();
  await ensureIndexes(db);
  userId = `testuser${crypto.randomUUID()}`;
  keyId = createId(10);
  rawKey = generateRawKey();
  await createApiKey(keyId, userId, await hashApiKey(rawKey), "test key");
  cookie = await sessionCookieFor(userId);
});

test.afterAll(async () => {
  const db = await getDb();
  await db.collection("api_keys").deleteOne({ _id: keyId } as never);
  await db.collection("sessions").deleteMany({ user_id: userId });
  await db.collection("pages").deleteMany({ user_id: userId });
  await db.collection("docs").deleteMany({ _id: { $in: created } } as never);
  await db.collection("page_versions").deleteMany({ page_id: { $in: created } });
  await db.collection("publish_events").deleteMany({ page_id: { $in: created } });
});

async function oversizeDocsStored() {
  return (await getDb()).collection("docs").countDocuments({ "doc.raw": { $regex: `^${MARK}` } });
}

async function seedPage() {
  const id = createId(10);
  created.push(id);
  await putDoc(id, { v: 1, createdAt: new Date().toISOString(), settings: DEFAULT_SETTINGS, blocks: [], raw: "seed" });
  await createPageRecord(id, userId, "seed");
  return id;
}

function v1Req(method: string, path: string, raw: string) {
  return new Request(`http://localhost/api/v1/${path}`, {
    method,
    headers: { authorization: `Bearer ${rawKey}`, "content-type": "application/json" },
    body: JSON.stringify({ raw }),
  });
}

function webReq(method: string, path: string, raw: string) {
  return new Request(`http://localhost/api/${path}`, {
    method,
    headers: { cookie, "content-type": "application/json", "cf-connecting-ip": `test-${crypto.randomUUID()}` },
    body: JSON.stringify({ raw }),
  });
}

test.describe("document size limit", () => {
  test("the app and the shared client agree on the limit", () => {
    expect(STORAGE.maxInputChars).toBe(MAX_RAW_CHARS);
    expect(OVER).toHaveLength(MAX_RAW_CHARS + 1);
  });

  test("POST /api/v1/publish: 200,001 chars is 413 and stores nothing", async () => {
    const res = await v1Publish(v1Req("POST", "publish", OVER));
    expect(res.status).toBe(413);
    expect(await oversizeDocsStored()).toBe(0);
  });

  test("POST /api/v1/publish: 200,000 chars succeeds with the full raw stored", async () => {
    const res = await v1Publish(v1Req("POST", "publish", AT));
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    created.push(id);
    expect((await getDoc(id))?.raw).toHaveLength(MAX_RAW_CHARS);
  });

  test("PATCH /api/v1/pages/:id: 200,001 chars is 413 and leaves the doc unchanged", async () => {
    const id = await seedPage();
    const res = await v1Patch(v1Req("PATCH", `pages/${id}`, OVER), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(413);
    expect((await getDoc(id))?.raw).toBe("seed");
  });

  test("PATCH /api/v1/pages/:id: 200,000 chars succeeds with the full raw stored", async () => {
    const id = await seedPage();
    const res = await v1Patch(v1Req("PATCH", `pages/${id}`, AT), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    expect((await getDoc(id))?.raw).toHaveLength(MAX_RAW_CHARS);
  });

  test("POST /api/publish: 200,001 chars is 413 and stores nothing", async () => {
    const req = webReq("POST", "publish", OVER);
    const res = await withRequestScope(req, () => webPublish(req));
    expect(res.status).toBe(413);
    expect(await oversizeDocsStored()).toBe(0);
  });

  test("POST /api/publish: 200,000 chars succeeds with the full raw stored", async () => {
    const req = webReq("POST", "publish", AT);
    const res = await withRequestScope(req, () => webPublish(req));
    expect(res.status).toBe(200);
    const { id } = (await res.json()) as { id: string };
    created.push(id);
    expect((await getDoc(id))?.raw).toHaveLength(MAX_RAW_CHARS);
  });

  test("PATCH /api/publish/:id: 200,001 chars is 413 and leaves the doc unchanged", async () => {
    const id = await seedPage();
    const req = webReq("PATCH", `publish/${id}`, OVER);
    const res = await withRequestScope(req, () => webPatch(req, { params: Promise.resolve({ id }) }));
    expect(res.status).toBe(413);
    expect((await getDoc(id))?.raw).toBe("seed");
  });

  test("PATCH /api/publish/:id: 200,000 chars succeeds with the full raw stored", async () => {
    const id = await seedPage();
    const req = webReq("PATCH", `publish/${id}`, AT);
    const res = await withRequestScope(req, () => webPatch(req, { params: Promise.resolve({ id }) }));
    expect(res.status).toBe(200);
    expect((await getDoc(id))?.raw).toHaveLength(MAX_RAW_CHARS);
  });

  test("MCP publish_page and update_page schemas reject 200,001 chars and accept 200,000", () => {
    expect(PublishPageInputSchema.safeParse({ raw: OVER }).success).toBe(false);
    expect(PublishPageInputSchema.safeParse({ raw: AT }).success).toBe(true);
    expect(UpdatePageInputSchema.safeParse({ id: "x", raw: OVER }).success).toBe(false);
    expect(UpdatePageInputSchema.safeParse({ id: "x", raw: AT }).success).toBe(true);
  });
});
