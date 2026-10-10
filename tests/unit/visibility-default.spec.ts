import { test, expect } from "@playwright/test";
import { sessionCookieFor, withRequestScope } from "./helpers/request-scope";
import type { Metadata } from "next";
import { getDb } from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/db/index-specs.mjs";
import { createApiKey, createPageRecord, getPageRecord } from "@/lib/db";
import { generateRawKey, hashApiKey } from "@/lib/api-key";
import { createId } from "@/lib/id";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { parseToBlocks } from "@/lib/parse";
import { putDoc } from "@/lib/storage";
import { POST as v1Publish } from "@/app/api/v1/publish/route";
import { POST as webPublish } from "@/app/api/publish/route";
import { generateMetadata } from "@/app/p/[id]/page";
import { handlePublishPage } from "../../mcp-server/src/tools.js";

// A new page is unlisted and noindex unless its author opts in. Before this,
// every signed-in publish defaulted to "public" (listed on /explore, in the
// sitemap, indexable), and anonymous pages — which have no `pages` record at
// all — were indexable because noindex was only set for a record that said
// "unlisted".

let userId: string;
let keyId: string;
let rawKey: string;
let cookie: string;
const created: string[] = [];

test.beforeAll(async () => {
  process.env.MONGODB_URI ??= "mongodb://localhost:27017/readable?retryWrites=true&w=majority";
  process.env.API_KEY_PEPPER ??= "test-only-pepper-do-not-use-in-prod";
  await ensureIndexes(await getDb());
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

function v1Req(raw: string) {
  return new Request("http://localhost/api/v1/publish", {
    method: "POST",
    headers: { authorization: `Bearer ${rawKey}`, "content-type": "application/json" },
    body: JSON.stringify({ raw }),
  });
}

async function publishFromEditor(body: Record<string, unknown>, signedIn = true) {
  const req = new Request("http://localhost/api/publish", {
    method: "POST",
    headers: {
      ...(signedIn ? { cookie } : {}),
      "content-type": "application/json",
      "cf-connecting-ip": `test-${crypto.randomUUID()}`,
    },
    body: JSON.stringify(body),
  });
  const res = await withRequestScope(req, () => webPublish(req));
  expect(res.status).toBe(200);
  const { id } = (await res.json()) as { id: string };
  created.push(id);
  return id;
}

async function seedDoc(raw = "# Title\n\nBody text.") {
  const id = createId(10);
  created.push(id);
  await putDoc(id, {
    v: 1,
    createdAt: new Date().toISOString(),
    settings: DEFAULT_SETTINGS,
    blocks: parseToBlocks(raw),
    raw,
  });
  return id;
}

function robotsIndex(meta: Metadata): boolean | undefined {
  const robots = meta.robots;
  return robots && typeof robots === "object" ? (robots.index ?? undefined) : undefined;
}

test.describe("new pages are unlisted by default", () => {
  test("createPageRecord writes unlisted unless the caller passes a visibility", async () => {
    const a = createId(10);
    const b = createId(10);
    created.push(a, b);
    await createPageRecord(a, userId, "a");
    await createPageRecord(b, userId, "b", null, null, "public");
    expect((await getPageRecord(a))?.visibility).toBe("unlisted");
    expect((await getPageRecord(b))?.visibility).toBe("public");
  });

  test("the editor's publish route creates an unlisted page", async () => {
    const id = await publishFromEditor({ raw: "# From the editor" });
    expect((await getPageRecord(id))?.visibility).toBe("unlisted");
  });

  test("the editor's publish route honours an explicit public choice", async () => {
    const id = await publishFromEditor({ raw: "# Opted in", visibility: "public" });
    expect((await getPageRecord(id))?.visibility).toBe("public");
  });

  test("the editor's publish route ignores a visibility value it does not know", async () => {
    const id = await publishFromEditor({ raw: "# Junk", visibility: { $ne: null } });
    expect((await getPageRecord(id))?.visibility).toBe("unlisted");
  });

  test("POST /api/v1/publish creates an unlisted page", async () => {
    const res = await v1Publish(v1Req("# From the API"));
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    created.push(id);
    expect((await getPageRecord(id))?.visibility).toBe("unlisted");
  });

  test("POST /api/v1/publish still honours `visibility: public` in frontmatter", async () => {
    const res = await v1Publish(v1Req("---\nvisibility: public\n---\n# Opted in"));
    const { id } = (await res.json()) as { id: string };
    created.push(id);
    expect((await getPageRecord(id))?.visibility).toBe("public");
  });

  test("POST /api/v1/publish honours `visibility` in the JSON body over frontmatter", async () => {
    const req = new Request("http://localhost/api/v1/publish", {
      method: "POST",
      headers: { authorization: `Bearer ${rawKey}`, "content-type": "application/json" },
      body: JSON.stringify({ raw: "---\nvisibility: unlisted\n---\n# Body wins", visibility: "public" }),
    });
    const { id } = (await (await v1Publish(req)).json()) as { id: string };
    created.push(id);
    expect((await getPageRecord(id))?.visibility).toBe("public");
  });

  test("the MCP publish_page tool creates an unlisted page", async () => {
    // The tool talks to /api/v1 over fetch; route that one call straight
    // into the real handler instead of standing up an HTTP server.
    const realFetch = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      v1Publish(new Request(input, init))) as typeof fetch;
    try {
      const result = await handlePublishPage({ raw: "# From an agent" }, rawKey, "http://localhost");
      expect(result.isError).toBeFalsy();
      const { id } = result.structuredContent as { id: string };
      created.push(id);
      expect((await getPageRecord(id))?.visibility).toBe("unlisted");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

test.describe("share-page indexing", () => {
  const metaFor = (id: string) => generateMetadata({ params: Promise.resolve({ id }) });

  test("an anonymous page (no pages record) is noindex", async () => {
    const id = await seedDoc();
    expect(robotsIndex(await metaFor(id))).toBe(false);
  });

  test("an unlisted page is noindex", async () => {
    const id = await seedDoc();
    await createPageRecord(id, userId, "t");
    expect(robotsIndex(await metaFor(id))).toBe(false);
  });

  test("an existing public page stays indexable", async () => {
    const id = await seedDoc();
    await createPageRecord(id, userId, "t", null, null, "public");
    expect((await getPageRecord(id))?.visibility).toBe("public");
    expect(robotsIndex(await metaFor(id))).toBe(true);
  });
});
