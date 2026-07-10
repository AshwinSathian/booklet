import { test, expect } from "@playwright/test";
import { buildLockedPageMetadata } from "@/lib/locked-page-metadata";

// Regression coverage for the audit finding fixed alongside this suite:
// generateMetadata() in src/app/p/[id]/page.tsx (and the /embed variant)
// runs independently of the page's password gate, so it used to emit the
// real title and first paragraph into <title>, og:title, og:description,
// Twitter tags, and an OG/Twitter image URL built from the real title —
// all visible to an unauthenticated request, before any password check.
// Live-confirmed: a locked page's HTML leaked the real content via
// og:description.
//
// buildLockedPageMetadata() is the generic replacement generateMetadata()
// must return (before touching any real content) whenever a page's
// password_hash is set. These tests confirm it never contains anything
// page-specific.

const SECRET_TITLE = "Q3 Layoff Plan — Confidential";
const SECRET_DESCRIPTION = "This document contains details of the upcoming reduction in force.";

test.describe("buildLockedPageMetadata", () => {
  test("never echoes back a page-specific title or description", () => {
    const meta = buildLockedPageMetadata("/p/some-id");
    const serialized = JSON.stringify(meta);
    expect(serialized).not.toContain(SECRET_TITLE);
    expect(serialized).not.toContain(SECRET_DESCRIPTION);
  });

  test("uses a generic, fixed title and description", () => {
    const meta = buildLockedPageMetadata("/p/some-id");
    expect(meta.title).toBe("Password-protected page — Readable");
    expect(meta.description).toContain("password protected");
  });

  test("marks locked pages noIndex, same treatment as unlisted pages", () => {
    const meta = buildLockedPageMetadata("/p/some-id");
    expect(meta.robots).toMatchObject({ index: false, follow: false });
  });

  test("does not construct a title-bearing OG/Twitter image URL", () => {
    const meta = buildLockedPageMetadata("/p/some-id");
    const serialized = JSON.stringify(meta);
    // The real-content path builds /opengraph-image?title=<...>; the
    // locked path must never pass a `title` query param through to the
    // image endpoints.
    expect(serialized).not.toMatch(/opengraph-image\?title=/);
    expect(serialized).not.toMatch(/twitter-image\?title=/);
  });

  test("is identical regardless of the real page content — only pathname varies", () => {
    const metaA = buildLockedPageMetadata("/p/aaa");
    const metaB = buildLockedPageMetadata("/p/bbb");
    expect(metaA.title).toBe(metaB.title);
    expect(metaA.description).toBe(metaB.description);
  });
});
