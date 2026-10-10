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

/** One line, no page content, no title. Messages are fixed strings — nothing here is user input. */
export function goneNoticeHtml(reason: GoneReason): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page unavailable</title></head><body style="font-family:system-ui,sans-serif;margin:0;padding:3rem 1.5rem;background:#0b0b0c;color:#e7e7ea"><p style="max-width:32rem;margin:0 auto;line-height:1.6">${GONE_MESSAGES[reason]}</p></body></html>`;
}
