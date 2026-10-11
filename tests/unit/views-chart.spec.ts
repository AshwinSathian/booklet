import { test, expect } from "@playwright/test";
import { xTicks } from "../../src/app/my-pages/analytics/[id]/ViewsChart";

// The chart labels each tick with data[i].date. With no days it used to get
// tick 0 anyway and throw on data[0].

test("no days of data has no ticks to label", () => {
  expect(xTicks(0)).toEqual([]);
});

test("ticks are valid indices that include the first and last day", () => {
  expect(xTicks(1)).toEqual([0]);
  expect(xTicks(2)).toEqual([0, 1]);
  const ticks = xTicks(30);
  expect(ticks[0]).toBe(0);
  expect(ticks.at(-1)).toBe(29);
  expect(ticks.length).toBe(6);
});
