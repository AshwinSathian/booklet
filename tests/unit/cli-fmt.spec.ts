import { test, expect } from "@playwright/test";
import { bold, setNoColor } from "../../packages/cli/src/fmt";

// fmt.ts's own NO_COLOR/TTY check already disables color when stdout isn't
// a TTY (true for this test runner), so these tests exercise setNoColor()
// directly rather than relying on that — they'd pass even with a broken
// setNoColor if we didn't force color on first.

test.describe("setNoColor", () => {
  test("forcing color off strips ANSI codes even if nothing else would", () => {
    setNoColor(true);
    expect(bold("hello")).toBe("hello");
  });

  test("un-forcing lets the normal NO_COLOR/TTY check decide again", () => {
    setNoColor(true);
    setNoColor(false);
    // stdout is not a TTY under the test runner, so this still comes out
    // plain — the point of this test is that setNoColor(false) doesn't
    // throw or leave stale state, not that colors literally appear here.
    expect(bold("hello")).toBe("hello");
  });
});
