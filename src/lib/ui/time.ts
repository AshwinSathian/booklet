const TIME_LABELS = {
  justNow: "just now",
  ago: "ago",
  sec: "sec",
  min: "min",
  hr: "hr",
  day: "day",
  days: "days",
} as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatTimeHHMM(d: Date): string {
  const hours = d.getHours();
  const minutes = d.getMinutes();
  return `${pad2(hours)}:${pad2(minutes)}`;
}

export function formatUpdatedAtLong(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Locale pinned to "en-US" (and hour12 made explicit) so the *format*
  // (12h vs 24h, month-name style, field order) can never differ between
  // Node's ICU default locale and the visitor's browser locale — that
  // divergence is what caused a hydration mismatch on /my-pages/versions/[id]
  // (see VersionsClient.tsx, the one call site of this function that's
  // genuinely server-rendered then hydrated). timeZone is deliberately left
  // unpinned: this still resolves to each environment's local timezone,
  // which is correct once a caller is client-only (this codebase's other
  // three call sites — TopBar, DraftsDialog — never render this value until
  // after mount, so there's no second, server-side evaluation to disagree
  // with). Callers that ARE server-rendered-then-hydrated must defer this
  // call to a client-only render pass instead (see VersionsClient.tsx).
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * A deterministic stand-in for formatUpdatedAtLong's output, safe to use
 * during server rendering (and a client's very first, pre-hydration paint)
 * because timeZone is pinned rather than left to the ambient environment.
 * Callers that render this value from server-fetched data (e.g.
 * VersionsClient.tsx) must show THIS during the initial render and only
 * swap to the richer, local-timezone formatUpdatedAtLong() after mount —
 * otherwise the server's timezone and the visitor's browser timezone can
 * legitimately disagree, producing a React hydration mismatch even with
 * formatUpdatedAtLong's locale/hour12 already pinned.
 */
export function formatUpdatedAtLongUTC(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
}

export function formatRelativeTimeFromIso(iso: string, nowMs?: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const now = typeof nowMs === "number" ? nowMs : Date.now();
  const diffMs = Math.max(0, now - d.getTime());
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 8) return TIME_LABELS.justNow;
  if (diffSec < 60) return `${diffSec} ${TIME_LABELS.sec} ${TIME_LABELS.ago}`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} ${TIME_LABELS.min} ${TIME_LABELS.ago}`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ${TIME_LABELS.hr} ${TIME_LABELS.ago}`;

  const diffDay = Math.floor(diffHr / 24);
  const dayLabel = diffDay === 1 ? TIME_LABELS.day : TIME_LABELS.days;
  return `${diffDay} ${dayLabel} ${TIME_LABELS.ago}`;
}
