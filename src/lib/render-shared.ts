import type { CalloutKind } from "./blocks";

/**
 * Single URL-sanitization policy, used by both the React renderer
 * (InlineRenderer/BlockRenderer) and the HTML string exporter
 * (src/lib/export/html.ts). Before this existed, each had its own
 * hand-written version — `safeHref`/`safeSrc` in InlineRenderer.tsx only
 * allowed http(s)/mailto, while `sanitizeHref` in html.ts additionally
 * allowed relative (`/`, `./`, `../`) and `#` URLs. That divergence meant
 * what a reader sees while writing/viewing a page and what a "Copy as HTML"
 * export produces could genuinely disagree on which links survive — and a
 * URL-scheme allowlist is exactly the kind of security-relevant logic that
 * should have exactly one implementation, not two that can drift out of
 * sync as new schemes are considered.
 *
 * A published page is a standalone document with no concept of "relative to
 * itself" (there's no meaningful `/foo` on `booklet`'s domain from a
 * reader's page), so only fully-qualified http(s)/mailto survive; anything
 * else (javascript:, data:, vbscript:, bare relative paths, unknown
 * schemes) becomes inert (`#`) rather than silently doing nothing — an
 * inert link is visibly a link, which is easier for an author to notice and
 * fix than markup that silently didn't produce one.
 */
export function sanitizeUrl(href: string): string {
  const trimmed = (href ?? "").trim();
  if (!trimmed) return "#";

  const lowered = trimmed.toLowerCase();
  if (lowered.startsWith("http://") || lowered.startsWith("https://") || lowered.startsWith("mailto:")) {
    return trimmed;
  }

  return "#";
}

/** Same allowlist, but for embedded resources (images) — a bare `#` isn't a
 * meaningful image source, so callers should treat "" as "omit the image"
 * rather than rendering a broken-image icon. */
export function sanitizeImageUrl(src: string): string {
  const trimmed = (src ?? "").trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : "";
}

export type CalloutMeta = { label: string; colorVar: string };

/** Shared callout label text + accent color token, one definition instead of
 * the two that previously existed independently in Callout.tsx (Tailwind
 * classes) and export/html.ts (inline hex colors for email/doc-paste
 * targets) — the label text in particular must not drift between what a
 * reader sees and what an export produces. */
export const CALLOUT_META: Record<CalloutKind, CalloutMeta> = {
  note: { label: "Note", colorVar: "#0ea5e9" },
  tip: { label: "Tip", colorVar: "#10b981" },
  warning: { label: "Warning", colorVar: "#f59e0b" },
  important: { label: "Important", colorVar: "#7c5cfc" },
  caution: { label: "Caution", colorVar: "#ef4444" },
};
