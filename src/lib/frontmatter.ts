export type FrontmatterMeta = {
  title?: string;
  visibility?: "public" | "unlisted";
  slug?: string;
  description?: string;
  author?: string;
  date?: string;
};

type ParseResult = {
  meta: FrontmatterMeta;
  body: string;
};

// Parses YAML frontmatter from a markdown string.
// Only handles scalar string values — no arrays, nested objects, or multi-line values.
// Returns the stripped body and any recognised fields.
export function parseFrontmatter(raw: string): ParseResult {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("---")) {
    return { meta: {}, body: raw };
  }

  const rest = trimmed.slice(3);
  const end = rest.indexOf("\n---");
  if (end === -1) {
    return { meta: {}, body: raw };
  }

  const yamlBlock = rest.slice(0, end).trim();
  const body = rest.slice(end + 4).trimStart(); // skip \n---

  const meta: FrontmatterMeta = {};

  for (const line of yamlBlock.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const rawVal = line.slice(colonIdx + 1).trim();
    // Strip surrounding quotes
    const val = rawVal.replace(/^["']|["']$/g, "");
    if (!val) continue;

    switch (key) {
      case "title":
        meta.title = val.slice(0, 200);
        break;
      case "visibility":
        if (val === "public" || val === "unlisted") meta.visibility = val;
        break;
      case "slug":
        meta.slug = val.slice(0, 60).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        break;
      case "description":
        meta.description = val.slice(0, 300);
        break;
      case "author":
        meta.author = val.slice(0, 100);
        break;
      case "date":
        meta.date = val.slice(0, 30);
        break;
    }
  }

  return { meta, body };
}

// Strips frontmatter and returns just the body — for the browser editor.
export function stripFrontmatter(raw: string): string {
  return parseFrontmatter(raw).body;
}
