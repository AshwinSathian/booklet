import { test, expect } from "@playwright/test";
import { formatUpdatedAtLong, formatUpdatedAtLongUTC } from "@/lib/ui/time";

// Regression coverage for a hydration mismatch on /my-pages/versions/[id]:
// formatUpdatedAtLong() used to call toLocaleString(undefined, {...}) with no
// pinned locale/timeZone/hour12, so the server (Node's ICU default) and the
// client (the visitor's browser) could legitimately disagree on 12h vs. 24h
// formatting (or worse, on the actual time value, if their timezones
// differ) — producing different text for the same render, which is exactly
// what a React hydration mismatch is.
//
// Node respects mutations to process.env.TZ for newly-evaluated Intl calls
// (verified directly, not assumed), so these tests simulate "server in one
// timezone, browser in another" by changing TZ between calls in the same
// process.

const FIXED_ISO = "2026-01-15T10:30:00.000Z";
const ORIGINAL_TZ = process.env.TZ;

test.afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

test.describe("formatUpdatedAtLong — locale pinned", () => {
  test("always uses en-US 12h format shape (Month DD, YYYY, HH:MM AM/PM), regardless of ambient timezone", () => {
    process.env.TZ = "Asia/Kolkata";
    const inIst = formatUpdatedAtLong(FIXED_ISO);
    process.env.TZ = "America/Los_Angeles";
    const inLa = formatUpdatedAtLong(FIXED_ISO);

    const shape = /^[A-Z][a-z]{2} \d{2}, \d{4}, \d{2}:\d{2} (AM|PM)$/;
    expect(inIst).toMatch(shape);
    expect(inLa).toMatch(shape);
  });

  test("the actual clock value still reflects the ambient (local) timezone — this is intentional, not a bug", () => {
    // formatUpdatedAtLong is only ever called from client-only render paths
    // (see time.ts's doc comment) once this fix lands, so showing the
    // visitor's own local time there is correct and desired; only the
    // *format* needed to be pinned, not the timezone.
    process.env.TZ = "Asia/Kolkata";
    const inIst = formatUpdatedAtLong(FIXED_ISO);
    process.env.TZ = "America/Los_Angeles";
    const inLa = formatUpdatedAtLong(FIXED_ISO);

    expect(inIst).not.toBe(inLa);
  });

  test("returns an empty string for an invalid ISO string instead of 'Invalid Date'", () => {
    expect(formatUpdatedAtLong("not-a-date")).toBe("");
  });
});

test.describe("formatUpdatedAtLongUTC — deterministic SSR-safe fallback", () => {
  test("produces byte-identical output regardless of the ambient timezone", () => {
    process.env.TZ = "Asia/Kolkata";
    const inIst = formatUpdatedAtLongUTC(FIXED_ISO);
    process.env.TZ = "America/Los_Angeles";
    const inLa = formatUpdatedAtLongUTC(FIXED_ISO);
    process.env.TZ = "UTC";
    const inUtc = formatUpdatedAtLongUTC(FIXED_ISO);

    expect(inIst).toBe(inLa);
    expect(inIst).toBe(inUtc);
    expect(inIst).toBe("Jan 15, 2026, 10:30 AM");
  });

  test("returns an empty string for an invalid ISO string instead of 'Invalid Date'", () => {
    expect(formatUpdatedAtLongUTC("not-a-date")).toBe("");
  });
});
