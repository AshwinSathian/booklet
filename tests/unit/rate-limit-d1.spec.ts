import { test, expect } from "@playwright/test";
import { checkRateLimit, checkMonthlyQuota } from "@/lib/rate-limit";
import { useLocalD1 } from "./helpers/d1";

// The repository had no rate-limit spec before the spike. This covers the
// property the D1 port must keep: the counter is atomic under concurrency.

test.beforeAll(async () => {
  await useLocalD1();
});

test("50 concurrent calls against a limit of 30 block exactly 20", async () => {
  const key = `test__${crypto.randomUUID()}`;
  const results = await Promise.all(Array.from({ length: 50 }, () => checkRateLimit(key, 30)));
  expect(results.filter((r) => r === null)).toHaveLength(30);
  expect(results.filter((r) => r?.status === 429)).toHaveLength(20);
});

test("monthly quota blocks the call after the limit", async () => {
  const key = `test__${crypto.randomUUID()}`;
  for (let i = 0; i < 3; i++) expect(await checkMonthlyQuota(key, 3, "over")).toBeNull();
  const blocked = await checkMonthlyQuota(key, 3, "over");
  expect(blocked?.status).toBe(429);
  expect(await blocked?.json()).toEqual({ error: "over" });
});
