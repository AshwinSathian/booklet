import { test, expect } from "@playwright/test";
import { GET } from "@/app/api/health/route";

test.describe("GET /api/health", () => {
  test.afterEach(() => {
    delete (globalThis as { _mongoClientPromise?: unknown })._mongoClientPromise;
  });

  test("is 200 { ok: true } when the database answers a ping", async () => {
    process.env.MONGODB_URI ??= "mongodb://localhost:27017/booklet?retryWrites=true&w=majority";
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
