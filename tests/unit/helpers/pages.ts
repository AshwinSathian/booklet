import { NextRequest } from "next/server";
import { getDb } from "@/lib/mongodb";
import { createApiKey } from "@/lib/db";
import { generateRawKey, hashApiKey } from "@/lib/api-key";
import { createId } from "@/lib/id";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { parseToBlocks } from "@/lib/parse";
import { putDoc } from "@/lib/storage";
import middleware from "@/middleware";
import { GET as goneStatus } from "@/app/api/pages/[id]/gone/route";

/** Shared fixtures for specs that publish, take down, expire or claim pages. */

export function useTestEnv() {
  process.env.MONGODB_URI ??= "mongodb://localhost:27017/readable?retryWrites=true&w=majority";
  process.env.API_KEY_PEPPER ??= "test-only-pepper-do-not-use-in-prod";
}

export async function seedUserWithKey() {
  const userId = `testuser${crypto.randomUUID()}`;
  const keyId = createId(10);
  const rawKey = generateRawKey();
  await createApiKey(keyId, userId, await hashApiKey(rawKey), "test key");
  return { userId, keyId, rawKey };
}

export async function seedDoc(raw = "# Secret title\n\nBody text.", extra?: Parameters<typeof putDoc>[2]) {
  const id = createId(10);
  await putDoc(
    id,
    { v: 1, createdAt: new Date().toISOString(), settings: DEFAULT_SETTINGS, blocks: parseToBlocks(raw), raw },
    extra,
  );
  return id;
}

export async function cleanupPages(ids: string[], userIds: string[] = []) {
  const db = await getDb();
  await db.collection("docs").deleteMany({ _id: { $in: ids } } as never);
  await db.collection("pages").deleteMany({ _id: { $in: ids } } as never);
  await db.collection("reports").deleteMany({ page_id: { $in: ids } });
  await db.collection("page_versions").deleteMany({ page_id: { $in: ids } });
  await db.collection("publish_events").deleteMany({ page_id: { $in: ids } });
  if (userIds.length) {
    await db.collection("api_keys").deleteMany({ user_id: { $in: userIds } });
    await db.collection("sessions").deleteMany({ user_id: { $in: userIds } });
    await db.collection("pages").deleteMany({ user_id: { $in: userIds } });
  }
}

/**
 * Runs the real middleware for `path`. The middleware asks the app's own
 * /api/pages/:id/gone route over loopback HTTP whether the page is gone;
 * here that one fetch is routed straight into the real route handler.
 */
export async function throughMiddleware(path: string): Promise<Response> {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const m = /^\/api\/pages\/([^/]+)\/gone$/.exec(url.pathname);
    if (!m) throw new Error(`unexpected fetch from middleware: ${url}`);
    return goneStatus(new Request(url), { params: Promise.resolve({ id: decodeURIComponent(m[1]) }) });
  }) as typeof fetch;
  try {
    return await middleware(new NextRequest(`http://localhost${path}`));
  } finally {
    globalThis.fetch = realFetch;
  }
}
