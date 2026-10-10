import type { DocType, Visibility } from "./schemas.js";

/**
 * The frontmatter fields Booklet reads. `type` and the four after it show in
 * a page's header strip. An undefined field is left out.
 */
export type DocumentFields = Partial<Record<"title" | "status" | "severity" | "date" | "supersedes" | "slug" | "space", string | undefined>> & {
  type?: DocType | undefined;
  owners?: string[] | undefined;
  visibility?: Visibility | undefined;
};


const ORDER = ["type", "title", "status", "severity", "date", "owners", "supersedes", "slug", "visibility", "space"] as const;

/**
 * A YAML frontmatter block for the fields that are set, ending in a blank
 * line, or "" when none are. Values are written as JSON, which is valid
 * YAML and needs no quoting rules of its own.
 */
export function frontmatterBlock(fields: DocumentFields): string {
  const lines = ORDER.filter((k) => fields[k] !== undefined).map((k) => `${k}: ${JSON.stringify(fields[k])}`);
  return lines.length ? `---\n${lines.join("\n")}\n---\n\n` : "";
}
