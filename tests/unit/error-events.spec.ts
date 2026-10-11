import { test, expect } from "@playwright/test";
import { getDb } from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/db/index-specs.mjs";
import { errorFingerprint, listErrorEvents, recordErrorEvent } from "@/lib/db/error-events";
import { useTestEnv } from "./helpers/pages";

// The app's own error tracking: one row per distinct error, counted.

const scope = `spec-${crypto.randomUUID()}`;

test.beforeAll(async () => {
  useTestEnv();
  await ensureIndexes(await getDb());
});
test.afterAll(async () => {
  await (await getDb()).collection("error_events").deleteMany({ scope });
});

test("the same error is one row with a count; a different one is its own row", async () => {
  const boom = new Error("connection reset");
  const fields = { name: boom.name, message: boom.message, stack: boom.stack };
  await recordErrorEvent(scope, "Publish failed", fields);
  await recordErrorEvent(scope, "Publish failed", { ...fields, message: "connection reset (again)" });
  await recordErrorEvent(scope, "Slug write failed", fields);

  const rows = (await listErrorEvents(200)).filter((e) => e.scope === scope);
  expect(rows.map((r) => [r.message, r.count]).sort()).toEqual([
    ["Publish failed", 2],
    ["Slug write failed", 1],
  ]);
  const publish = rows.find((r) => r.message === "Publish failed")!;
  expect(publish.error_message).toBe("connection reset (again)"); // the latest
  expect(publish.first_seen.getTime()).toBeLessThanOrEqual(publish.last_seen.getTime());
  expect(publish.stack).toContain("error-events.spec");
});

test("the fingerprint ignores the error's own message, which often carries an id", () => {
  const stack = "Error: page Ab3k91QxZp not found\n    at load (src/server/pages.ts:10:5)";
  const other = "Error: page Zz9k00QxAa not found\n    at load (src/server/pages.ts:10:5)";
  expect(errorFingerprint("pages", "Load failed", "Error", stack)).toBe(errorFingerprint("pages", "Load failed", "Error", other));
  expect(errorFingerprint("pages", "Load failed", "Error", stack)).not.toBe(errorFingerprint("pages", "Load failed", "TypeError", stack));
});

test("recording never throws, whatever it is handed", async () => {
  await expect(recordErrorEvent(scope, "x".repeat(10_000), { name: 1, message: {}, stack: null } as never)).resolves.toBeUndefined();
  await expect(recordErrorEvent(scope, "no error object", undefined)).resolves.toBeUndefined();
});

test.describe("alert email", () => {
  // Changes process.env and globalThis.fetch: one at a time, and put back.
  test.describe.configure({ mode: "serial" });
  const realFetch = globalThis.fetch;
  const mails: string[] = [];
  let reject = false;

  test.beforeAll(() => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.ERROR_ALERT_EMAIL = "owner@example.test";
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (!url.startsWith("https://api.resend.com/")) return realFetch(input, init);
      if (reject) return Response.json({ name: "validation_error", message: "rejected" }, { status: 422 });
      mails.push(JSON.parse(String(init?.body ?? "{}")).subject);
      return Response.json({ id: "mail_1" });
    }) as typeof fetch;
  });
  test.afterAll(() => {
    globalThis.fetch = realFetch;
    delete process.env.RESEND_API_KEY;
    delete process.env.ERROR_ALERT_EMAIL;
  });

  test("twenty requests hitting the same new error at once send one mail", async () => {
    const message = `Burst ${crypto.randomUUID()}`;
    const err = new Error("boom");
    await Promise.all(Array.from({ length: 20 }, () => recordErrorEvent(scope, message, { name: err.name, message: err.message, stack: err.stack })));
    expect(mails.filter((subject) => subject.includes(message))).toHaveLength(1);
    // And not again within the day.
    await recordErrorEvent(scope, message, { name: err.name, message: err.message, stack: err.stack });
    expect(mails.filter((subject) => subject.includes(message))).toHaveLength(1);
  });

  test("a mail the provider rejects is not counted as sent: the next sighting tries again", async () => {
    const message = `Rejected ${crypto.randomUUID()}`;
    reject = true;
    await recordErrorEvent(scope, message, undefined);
    reject = false;
    await recordErrorEvent(scope, message, undefined);
    expect(mails.filter((subject) => subject.includes(message))).toHaveLength(1);
  });
});
