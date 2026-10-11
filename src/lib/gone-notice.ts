/**
 * The 410 response for a page that was taken down or has expired.
 * Edge-safe (no Node or database imports) — built by src/middleware.ts.
 * Copy lives here so the middleware and the pages' own render guards
 * (src/server/page-gone.ts re-exports the same messages) cannot drift.
 */

export type GoneReason = "taken_down" | "expired";

export const GONE_MESSAGES: Record<GoneReason, string> = {
  taken_down: "This page was taken down for breaking the terms of use.",
  expired: "This page has expired. Pages published without an account are kept for 90 days.",
};

export function isGoneReason(v: unknown): v is GoneReason {
  return v === "taken_down" || v === "expired";
}

// The site's paper and ink in both themes (src/app/globals.css). The middleware
// cannot load the stylesheet or the fonts, so the colours are repeated here
// and the faces are the system's.
const GONE_STYLE =
  ":root{color-scheme:light dark}" +
  "body{margin:0;padding:4rem 1.5rem;background:#fbfaf7;color:#16150f;font-family:system-ui,sans-serif;line-height:1.6}" +
  "main{max-width:32rem;margin:0 auto}" +
  "h1{margin:0 0 .75rem;font:500 2rem/1.15 'Source Serif 4',Georgia,serif;letter-spacing:-.02em}" +
  "p{margin:0 0 1.5rem;color:#45433b}" +
  "a{color:inherit;text-underline-offset:3px}" +
  "@media (prefers-color-scheme:dark){body{background:#121110;color:#f4f1ea}p{color:#c9c5ba}}";

/** A heading, one line and a way out. No page content, no title. Messages are fixed strings — nothing here is user input. */
export function goneNoticeHtml(reason: GoneReason): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page unavailable</title><style>${GONE_STYLE}</style></head><body><main><h1>This page is not available</h1><p>${GONE_MESSAGES[reason]}</p><a href="/">Booklet home</a></main></body></html>`;
}
