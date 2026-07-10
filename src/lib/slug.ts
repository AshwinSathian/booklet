// Canonical page-slug validation, shared by the UI PATCH path
// (api/pages/[id]/route.ts), the v1 API PATCH path (api/v1/pages/[id]/route.ts),
// and v1 publish's frontmatter `slug:` handling (api/v1/publish/route.ts) — these
// previously each enforced slightly different rules (3-60 chars vs. 1-60 chars),
// and v1/publish's frontmatter slug had no validation or collision check at all.
//
// Rule: 3-60 lowercase alphanumeric + hyphens, no leading/trailing/consecutive
// hyphens. 3 chars minimum (not 1) to avoid near-collision-prone, land-grabby
// single/double-character slugs in a public, shared namespace.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$|^[a-z0-9]{3,60}$/;

export const SLUG_RULES_MESSAGE =
  "Use 3-60 lowercase letters, numbers, or hyphens (no leading, trailing, or consecutive hyphens).";

export function isValidSlug(s: string): boolean {
  return SLUG_RE.test(s) && !s.includes("--");
}
