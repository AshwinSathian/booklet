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

/**
 * "11 Oct 2026, 18:53" in the visitor's time zone: the date as formatDate
 * writes it, then a 24-hour time. Built by hand, not by Intl, so the server
 * and every browser write the same shape. The clock value is local, so a
 * caller that is server-rendered and then hydrated must paint
 * formatUpdatedAtLongUTC first and swap to this after mount (see
 * VersionsClient.tsx).
 */
export function formatUpdatedAtLong(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${formatDate(iso)}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** The same, pinned to UTC: what the server and the first client paint both render. */
export function formatUpdatedAtLongUTC(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${formatDateUTC(iso)}, ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
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

// Month names come from this list, not from Intl: ICU versions disagree on
// some abbreviations ("Sep" and "Sept"), and the server and a browser must
// render the same text.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "11 Oct 2026" in the visitor's time zone. Client-only: see formatDateUTC. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** The same date pinned to UTC: what the server and the first client paint both render. */
export function formatDateUTC(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
