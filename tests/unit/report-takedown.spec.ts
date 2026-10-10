import { test, expect } from "@playwright/test";
import { sessionCookieFor, withRequestScope } from "./helpers/request-scope";
import { cleanupPages, seedDoc, seedUserWithKey, throughMiddleware, useTestEnv } from "./helpers/pages";
import { getDb } from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/db/index-specs.mjs";
import { createPageRecord, getPageRecord, getRecentPublicPages } from "@/lib/db";
import { listOpenReports } from "@/lib/db/reports";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { getDoc, putDoc } from "@/lib/storage";
import { dismissReport, takeDownPage } from "@/server/moderation";
import { getGoneReason } from "@/server/page-gone";
import { POST as postReport } from "@/app/api/reports/route";
import { GET as v1Get, PATCH as v1Patch, DELETE as v1Delete } from "@/app/api/v1/pages/[id]/route";
import { PATCH as sessionPatch, DELETE as sessionDelete } from "@/app/api/pages/[id]/route";
import { PATCH as publishPatch } from "@/app/api/publish/[id]/route";
import { generateMetadata } from "@/app/p/[id]/page";
import { generateMetadata as generateEmbedMetadata } from "@/app/p/[id]/embed/page";

// Report → takedown. Before this there was no way to report a page and no
// way to take one down short of deleting rows by hand.

const ids: string[] = [];
const userIds: string[] = [];

test.beforeAll(async () => {
  useTestEnv();
  await ensureIndexes(await getDb());
});

test.afterAll(async () => {
  await cleanupPages(ids, userIds);
});

async function newDoc(raw?: string) {
  const id = await seedDoc(raw);
  ids.push(id);
  return id;
}

function reportReq(body: unknown, ip = `test-${crypto.randomUUID()}`) {
  return new Request("http://localhost/api/reports", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": ip },
    body: JSON.stringify(body),
  });
}

test.describe("POST /api/reports", () => {
  test("stores an open report for an existing page", async () => {
    const id = await newDoc();
    const res = await postReport(
      reportReq({ page_id: id, reason: "phishing", detail: "Fake login form.", reporter_email: "a@example.com" }),
    );
    expect(res.status).toBe(201);
    const open = (await listOpenReports()).filter((r) => r.page_id === id);
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({
      page_id: id,
      reason: "phishing",
      detail: "Fake login form.",
      reporter_email: "a@example.com",
      status: "open",
    });
  });

  test("resolves a custom slug to the page id", async () => {
    const { userId } = await seedUserWithKey();
    userIds.push(userId);
    const id = await newDoc();
    const slug = `report-slug-${crypto.randomUUID().slice(0, 8)}`;
    await createPageRecord(id, userId, "t");
    await (await getDb()).collection("pages").updateOne({ _id: id } as never, { $set: { slug } });
    const res = await postReport(reportReq({ page_id: slug, reason: "spam" }));
    expect(res.status).toBe(201);
    expect((await listOpenReports()).filter((r) => r.page_id === id)).toHaveLength(1);
  });

  for (const [name, body] of [
    ["an unknown reason", { reason: "because" }],
    ["a missing reason", {}],
    ["an over-long detail", { reason: "spam", detail: "x".repeat(2001) }],
    ["an invalid reporter email", { reason: "spam", reporter_email: "not-an-email" }],
    ["an operator object instead of a string", { reason: { $ne: null } }],
  ] as const) {
    test(`rejects ${name} with 400 and stores nothing`, async () => {
      const id = await newDoc();
      const res = await postReport(reportReq({ page_id: id, ...body }));
      expect(res.status).toBe(400);
      expect((await listOpenReports()).filter((r) => r.page_id === id)).toHaveLength(0);
    });
  }

  test("returns 404 for a page that does not exist", async () => {
    const res = await postReport(reportReq({ page_id: "nopage0000", reason: "spam" }));
    expect(res.status).toBe(404);
  });

  test("rejects a cross-origin browser request", async () => {
    const id = await newDoc();
    const req = reportReq({ page_id: id, reason: "spam" });
    req.headers.set("origin", "https://evil.example");
    req.headers.set("host", "localhost");
    expect((await postReport(req)).status).toBe(403);
  });

  test("allows 5 reports a minute from one IP and rejects the 6th", async () => {
    const id = await newDoc();
    const ip = `test-${crypto.randomUUID()}`;
    for (let i = 0; i < 5; i++) {
      expect((await postReport(reportReq({ page_id: id, reason: "spam" }, ip))).status).toBe(201);
    }
    expect((await postReport(reportReq({ page_id: id, reason: "spam" }, ip))).status).toBe(429);
  });
});

test.describe("takedown", () => {
  test("a taken-down page is 410 on /p/:id, /p/:id/embed and the v1 read route", async () => {
    const { userId, rawKey } = await seedUserWithKey();
    userIds.push(userId);
    const id = await newDoc();
    await createPageRecord(id, userId, "t", null, null, "public");

    expect((await throughMiddleware(`/p/${id}`)).status).toBe(200);
    await takeDownPage(id);

    const page = await throughMiddleware(`/p/${id}`);
    expect(page.status).toBe(410);
    const html = await page.text();
    expect(html).toContain("taken down");
    expect(html).not.toContain("Secret title");
    expect((await throughMiddleware(`/p/${id}/embed`)).status).toBe(410);

    const res = await v1Get(
      new Request(`http://localhost/api/v1/pages/${id}`, { headers: { authorization: `Bearer ${rawKey}` } }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(410);
    expect(JSON.stringify(await res.json())).not.toContain("Secret title");
  });

  test("a taken-down page reached by its slug is 410 too", async () => {
    const { userId } = await seedUserWithKey();
    userIds.push(userId);
    const id = await newDoc();
    const slug = `gone-slug-${crypto.randomUUID().slice(0, 8)}`;
    await createPageRecord(id, userId, "t");
    await (await getDb()).collection("pages").updateOne({ _id: id } as never, { $set: { slug } });
    await takeDownPage(id);
    expect((await throughMiddleware(`/p/${slug}`)).status).toBe(410);
  });

  test("an anonymous page (no pages record) can be taken down", async () => {
    const id = await newDoc();
    await takeDownPage(id);
    expect(await getGoneReason(id)).toBe("taken_down");
    expect((await throughMiddleware(`/p/${id}`)).status).toBe(410);
  });

  test("takedown delists a public page and closes its open reports", async () => {
    const { userId } = await seedUserWithKey();
    userIds.push(userId);
    const id = await newDoc();
    await createPageRecord(id, userId, "t", null, null, "public");
    await postReport(reportReq({ page_id: id, reason: "spam" }));
    await postReport(reportReq({ page_id: id, reason: "malware" }));

    await takeDownPage(id);

    const record = await getPageRecord(id);
    expect(record?.visibility).toBe("unlisted");
    expect(record?.taken_down_at).toBeTruthy();
    expect((await getRecentPublicPages(500)).map((p) => p.id)).not.toContain(id);
    expect((await listOpenReports()).filter((r) => r.page_id === id)).toHaveLength(0);
  });

  test("the owner cannot change a taken-down page: no re-listing, no new content", async () => {
    const { userId, rawKey } = await seedUserWithKey();
    userIds.push(userId);
    const cookie = await sessionCookieFor(userId);
    const id = await newDoc();
    await createPageRecord(id, userId, "t", null, null, "public");
    await takeDownPage(id);

    const json = { "content-type": "application/json" };
    const ctx = { params: Promise.resolve({ id }) };
    const viaSession = (handler: typeof sessionPatch, body: unknown) => {
      const req = new Request(`http://localhost/api/pages/${id}`, {
        method: "PATCH",
        headers: { ...json, cookie },
        body: JSON.stringify(body),
      });
      return withRequestScope(req, () => handler(req, ctx));
    };

    expect((await viaSession(sessionPatch, { visibility: "public" })).status).toBe(410);
    expect((await viaSession(publishPatch, { raw: "# replaced" })).status).toBe(410);
    const v1 = await v1Patch(
      new Request(`http://localhost/api/v1/pages/${id}`, {
        method: "PATCH",
        headers: { ...json, authorization: `Bearer ${rawKey}` },
        body: JSON.stringify({ visibility: "public", raw: "# replaced" }),
      }),
      ctx,
    );
    expect(v1.status).toBe(410);

    // Nor delete it: that would free its slug for a fresh copy at the same
    // URL, and destroy the record of what was taken down.
    const del = new Request(`http://localhost/api/pages/${id}`, { method: "DELETE", headers: { cookie } });
    expect((await withRequestScope(del, () => sessionDelete(del, ctx))).status).toBe(410);
    const v1Del = await v1Delete(
      new Request(`http://localhost/api/v1/pages/${id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${rawKey}` },
      }),
      ctx,
    );
    expect(v1Del.status).toBe(410);

    expect((await getPageRecord(id))?.visibility).toBe("unlisted");
    expect((await getDoc(id))?.raw).toContain("Secret title");
    expect((await getRecentPublicPages(500)).map((p) => p.id)).not.toContain(id);
  });

  test("a page keeps at most 10 open reports; further ones are accepted and dropped", async () => {
    const id = await newDoc();
    for (let i = 0; i < 12; i++) {
      expect((await postReport(reportReq({ page_id: id, reason: "spam" }))).status).toBe(201);
    }
    expect((await listOpenReports(500)).filter((r) => r.page_id === id)).toHaveLength(10);
  });

  test("the owner re-publishing content does not lift a takedown", async () => {
    const id = await newDoc();
    await takeDownPage(id);
    await putDoc(id, { v: 1, createdAt: new Date().toISOString(), settings: DEFAULT_SETTINGS, blocks: [], raw: "again" });
    expect((await getDoc(id))?.raw).toBe("again");
    expect(await getGoneReason(id)).toBe("taken_down");
  });

  test("share and embed metadata for a taken-down page do not leak its title", async () => {
    const id = await newDoc();
    await takeDownPage(id);
    for (const meta of [
      await generateMetadata({ params: Promise.resolve({ id }) }),
      await generateEmbedMetadata({ params: Promise.resolve({ id }) }),
    ]) {
      expect(JSON.stringify(meta)).not.toContain("Secret title");
      expect(meta.robots).toMatchObject({ index: false });
    }
  });

  test("dismissing a report closes it and leaves the page up", async () => {
    const id = await newDoc();
    await postReport(reportReq({ page_id: id, reason: "other" }));
    const [report] = (await listOpenReports()).filter((r) => r.page_id === id);
    await dismissReport(report.id);
    expect((await listOpenReports()).filter((r) => r.page_id === id)).toHaveLength(0);
    expect(await getGoneReason(id)).toBeNull();
    expect((await throughMiddleware(`/p/${id}`)).status).toBe(200);
  });
});
