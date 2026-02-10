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
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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
