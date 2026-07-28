import { test, expect } from "@playwright/test";
import { computeForceLayout } from "@/lib/wikilinks/layout";

test.describe("computeForceLayout", () => {
  test("returns no positions for an empty node list", () => {
    expect(computeForceLayout([], [])).toEqual({});
  });

  test("places a single node without crashing", () => {
    const pos = computeForceLayout(["only"], []);
    expect(Object.keys(pos)).toEqual(["only"]);
    expect(Number.isFinite(pos.only.x)).toBe(true);
    expect(Number.isFinite(pos.only.y)).toBe(true);
  });

  test("every node gets a finite, in-bounds position", () => {
    const nodes = ["a", "b", "c", "d", "e"];
    const edges = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ];
    const width = 400;
    const height = 400;
    const pos = computeForceLayout(nodes, edges, { width, height, iterations: 50 });

    for (const id of nodes) {
      expect(pos[id]).toBeDefined();
      expect(Number.isFinite(pos[id].x)).toBe(true);
      expect(Number.isFinite(pos[id].y)).toBe(true);
      expect(pos[id].x).toBeGreaterThanOrEqual(0);
      expect(pos[id].x).toBeLessThanOrEqual(width);
      expect(pos[id].y).toBeGreaterThanOrEqual(0);
      expect(pos[id].y).toBeLessThanOrEqual(height);
    }
  });

  test("is deterministic for the same input", () => {
    const nodes = ["a", "b", "c"];
    const edges = [{ source: "a", target: "b" }];
    const first = computeForceLayout(nodes, edges, { iterations: 30 });
    const second = computeForceLayout(nodes, edges, { iterations: 30 });
    expect(first).toEqual(second);
  });
});
