import { load as yamlLoad } from "js-yaml";
import type { DocType, Visibility } from "booklet-api-client";
import { isDocType } from "./doc-types";

export type FrontmatterMeta = {
  title?: string;
  visibility?: Visibility;
  slug?: string;
  description?: string;
  author?: string;
  date?: string;
  tags?: string[];
  /** Document type. With it, the fields below show in the page's header strip. */
  type?: DocType;
  status?: string;
  severity?: string;
  owners?: string[];
  supersedes?: string;
  /** Slug of the team space to publish into (read by POST /api/v1/publish). */
  space?: string;
};

type ParseResult = {
  meta: FrontmatterMeta;
  body: string;
};

function toStringArray(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string").map((s) => s.slice(0, 60));
  if (typeof v === "string") return [v];
  return undefined;
}

function safeStr(v: unknown, max = 300): string | undefined {
  if (typeof v === "string" || typeof v === "number") return String(v).slice(0, max);
  // YAML reads an unquoted `2026-10-10` as a timestamp, not a string.
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  return undefined;
}

// Parses YAML frontmatter from a Markdown string using js-yaml.
// Supports all scalar types and arrays (e.g. tags).
export function parseFrontmatter(raw: string): ParseResult {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("---")) {
    return { meta: {}, body: raw };
  }

  // Find the closing ---
  const afterOpen = trimmed.slice(3);
  // Allow --- immediately on same line or next line
  const match = afterOpen.match(/^([\s\S]*?)\n---(?:\s*$|\s*\n)/m);
  if (!match) {
    return { meta: {}, body: raw };
  }

  const yamlBlock = match[1];
  const body = afterOpen.slice(match[0].length).trimStart();

  let parsed: unknown;
  try {
    parsed = yamlLoad(yamlBlock);
  } catch {
    return { meta: {}, body: raw };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { meta: {}, body };
  }

  const obj = parsed as Record<string, unknown>;
  const meta: FrontmatterMeta = {};

  const title = safeStr(obj.title, 200);
  if (title) meta.title = title;

  const vis = safeStr(obj.visibility, 10);
  if (vis === "public" || vis === "unlisted" || vis === "team") meta.visibility = vis;

  const slug = safeStr(obj.slug, 60);
  if (slug) {
    meta.slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  }

  const desc = safeStr(obj.description, 300);
  if (desc) meta.description = desc;

  const author = safeStr(obj.author, 100);
  if (author) meta.author = author;

  const date = safeStr(obj.date, 30);
  if (date) meta.date = date;

  const tags = toStringArray(obj.tags);
  if (tags && tags.length > 0) meta.tags = tags.slice(0, 20);

  const type = safeStr(obj.type, 20)?.trim().toLowerCase();
  if (isDocType(type)) meta.type = type;

  const status = safeStr(obj.status, 40)?.trim();
  if (status) meta.status = status;

  const severity = safeStr(obj.severity, 20)?.trim();
  if (severity) meta.severity = severity;

  const owners = toStringArray(obj.owners);
  if (owners && owners.length > 0) meta.owners = owners.slice(0, 20);

  const supersedes = safeStr(obj.supersedes, 200)?.trim();
  if (supersedes) meta.supersedes = supersedes;

  const space = safeStr(obj.space, 60)?.trim().toLowerCase();
  if (space) meta.space = space;

  return { meta, body };
}

// Strips frontmatter and returns just the body — for the browser editor.
export function stripFrontmatter(raw: string): string {
  return parseFrontmatter(raw).body;
}
