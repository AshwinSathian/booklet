import type { DocType } from "booklet-api-client";

/**
 * Engineering document types, set with frontmatter `type`. The list itself
 * lives in packages/shared (DOC_TYPES); this record must name every one of
 * them, which the compiler checks. Kept apart from that package's runtime so
 * the editor bundle does not pull in the API schemas.
 */
export const DOC_TYPE_LABELS: Record<DocType, string> = {
  incident: "Incident",
  postmortem: "Postmortem",
  adr: "ADR",
  rfc: "RFC",
  runbook: "Runbook",
  "release-notes": "Release notes",
};

/** Plural headings for the team space home, in the order the groups appear. */
export const DOC_TYPE_GROUPS: Array<{ type: DocType; heading: string }> = [
  { type: "incident", heading: "Incidents" },
  { type: "postmortem", heading: "Postmortems" },
  { type: "adr", heading: "Decision log" },
  { type: "rfc", heading: "RFCs" },
  { type: "runbook", heading: "Runbooks" },
  { type: "release-notes", heading: "Release notes" },
];

export function isDocType(v: unknown): v is DocType {
  return typeof v === "string" && Object.hasOwn(DOC_TYPE_LABELS, v);
}

/** `doc_type` for a page record, from its parsed frontmatter. */
export function docTypeOf(meta: { type?: unknown } | null | undefined): DocType | null {
  return isDocType(meta?.type) ? meta.type : null;
}
