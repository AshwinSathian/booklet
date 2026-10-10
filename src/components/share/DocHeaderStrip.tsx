import Link from "next/link";
import { DOC_TYPE_LABELS, docTypeOf } from "@/lib/doc-types";

const chip = "inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-medium";

/** Statuses that mean the document is still moving; anything else reads as settled. */
const OPEN_STATUS = /^(draft|proposed|open|ongoing|investigating|in[ -]progress|in[ -]review|monitoring|identified)$/i;

/** A document's `status` frontmatter value. Filled while it is open, outlined once settled. */
export function StatusChip({ status }: { status: string }) {
  return (
    <span
      data-status={status}
      className={`${chip} ${OPEN_STATUS.test(status.trim()) ? "bg-accent-dim text-accent" : "border border-border-default text-text-secondary"}`}
    >
      {status}
    </span>
  );
}

/** Severities that mean "drop everything". They are drawn in the danger colour. */
const HIGH_SEVERITY = /^(p0|p1|sev[ -]?[01]|critical|high)$/i;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/** `2026-10-10` as "10 October 2026"; anything that is not a date is shown as written. */
export function formatDocDate(raw: string): string {
  const d = new Date(raw);
  return Number.isNaN(d.getTime())
    ? raw
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * The strip above a share page's content, from the page's frontmatter. A
 * typed document (`type: adr` and the rest) leads with its type, status and
 * severity; every page can show author, date, owners and tags.
 */
export function DocHeaderStrip({
  meta,
  userId,
  teamOnly = false,
}: {
  meta: Record<string, unknown> | null;
  userId: string | null;
  teamOnly?: boolean;
}) {
  const docType = docTypeOf(meta);
  const status = str(meta?.status);
  const severity = str(meta?.severity);
  const author = str(meta?.author);
  const dateRaw = str(meta?.date);
  const supersedes = str(meta?.supersedes);
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const owners = strings(meta?.owners);
  const tags = strings(meta?.tags);

  if (!teamOnly && !docType && !status && !severity && !author && !dateRaw && !supersedes && !owners.length && !tags.length) {
    return null;
  }

  return (
    <div
      data-doc-header
      className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border-subtle pb-4 text-sm text-text-secondary print:mb-4"
    >
      {docType && (
        <span data-doc-type={docType} className={`${chip} bg-fill-1 text-text-primary`}>
          {DOC_TYPE_LABELS[docType]}
        </span>
      )}
      {status && <StatusChip status={status} />}
      {severity && (
        <span
          data-severity={severity}
          className={`${chip} ${HIGH_SEVERITY.test(severity.trim()) ? "bg-danger/10 text-danger" : "border border-border-default text-text-primary"}`}
        >
          {severity}
        </span>
      )}
      {teamOnly && (
        <span className={`${chip} border border-border-default text-text-secondary`} title="Only members of this page's team space can open it">
          Team only
        </span>
      )}
      {dateRaw && <time className="text-text-muted">{formatDocDate(dateRaw)}</time>}
      {author && (
        <span>
          by{" "}
          {userId ? (
            <Link href={`/u/${userId}`} className="font-medium text-text-primary transition hover:text-accent">
              {author}
            </Link>
          ) : (
            <span className="font-medium text-text-primary">{author}</span>
          )}
        </span>
      )}
      {owners.length > 0 && (
        <span>
          {owners.length === 1 ? "Owner" : "Owners"}: <span className="text-text-primary">{owners.join(", ")}</span>
        </span>
      )}
      {supersedes && (
        <span>
          Supersedes <span className="text-text-primary">{supersedes}</span>
        </span>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Link
              key={tag}
              href={`/tags/${encodeURIComponent(tag)}`}
              className="rounded-pill bg-accent-dim text-accent text-xs px-2 py-0.5 font-medium transition hover:bg-accent/20 hover:text-accent"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
