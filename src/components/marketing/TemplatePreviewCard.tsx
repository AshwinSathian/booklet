import Link from "next/link";

export type TemplatePreviewCardProps = {
  name: string;
  description: string;
  slug: string;
  content: string;
  category?: string;
};

/**
 * Lightweight, best-effort extraction of a "mini preview" from a template's
 * raw Markdown `content` — not a full Markdown parser. Pulls the first
 * `#`/`##` heading line (stripped of its markers) plus the next 1-2
 * non-empty, non-heading lines, with light inline-syntax cleanup so the
 * preview reads as plain text rather than raw Markdown.
 */
function extractPreview(content: string): { heading: string; body: string[] } {
  const lines = content.split("\n").map((line) => line.trim());

  let heading = "";
  let bodyStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^#{1,2}\s+(.+)/);
    if (match) {
      heading = cleanLine(match[1]);
      bodyStart = i + 1;
      break;
    }
  }

  const body: string[] = [];
  for (let i = bodyStart; i < lines.length && body.length < 2; i++) {
    const raw = lines[i];
    if (!raw) continue; // blank line
    if (raw.startsWith("#")) continue; // further heading
    if (/^-{3,}$/.test(raw)) continue; // horizontal rule

    const cleaned = cleanLine(raw);
    if (cleaned) body.push(cleaned);
  }

  return { heading, body };
}

/** Strips common inline Markdown syntax so a raw content line reads as plain text. */
function cleanLine(line: string): string {
  return line
    .replace(/^>\s?/, "") // blockquote marker
    .replace(/^[-*]\s+/, "") // bullet list marker
    .replace(/^\d+\.\s+/, "") // numbered list marker
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images -> alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> label text
    .replace(/\*\*(.*?)\*\*/g, "$1") // bold
    .replace(/`([^`]+)`/g, "$1") // inline code
    .trim();
}

export function TemplatePreviewCard({ name, description, slug, content, category }: TemplatePreviewCardProps) {
  const { heading, body } = extractPreview(content);

  return (
    <Link
      href={`/templates/${slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border-default bg-bg-elevated shadow-card transition hover:border-border-strong hover:bg-bg-soft"
    >
      {/* Mini paper-page preview — an honest excerpt of the template's own content */}
      <div className="bg-paper p-4 text-paper-ink">
        {heading && (
          <p className="font-display text-[15px] font-medium leading-snug line-clamp-1">
            {heading}
          </p>
        )}
        {body.map((line, i) => (
          <p key={i} className="mt-1.5 text-xs leading-relaxed text-paper-ink-secondary line-clamp-1">
            {line}
          </p>
        ))}
      </div>

      {/* Info area */}
      <div className="flex flex-1 flex-col justify-between border-t border-border-default p-4">
        <div>
          {category && (
            <span className="mb-1 block text-2xs font-medium uppercase tracking-wider text-text-muted">
              {category}
            </span>
          )}
          <p className="text-sm font-semibold text-text-primary transition group-hover:text-accent">
            {name}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">{description}</p>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-2xs text-text-muted">Free · No signup</span>
          <span className="text-xs text-accent opacity-0 transition group-hover:opacity-100">
            Use template →
          </span>
        </div>
      </div>
    </Link>
  );
}
