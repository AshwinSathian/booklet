import type { Inline } from "@/lib/blocks";

/**
 * `[[Target]]` or `[[Target|Label]]`. Deliberately not a remark/micromark
 * plugin: `[[...]]` never forms a valid CommonMark link/reference (no
 * following `(url)` or matching `[ref]` definition), so it survives
 * remark-parse as a literal text run — the same way the `> [!NOTE]` callout
 * marker (src/lib/parse.ts) is detected by regex on already-parsed text
 * rather than by extending the mdast grammar itself.
 *
 * Excludes `]` and `\n` from the target/label bodies so this never spans
 * across a genuine paragraph break or an adjacent bracketed construct.
 */
const WIKILINK_RE = /\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/g;

/**
 * Splits `[[...]]` occurrences out of the "text" runs in an already-parsed
 * `Inline[]` array into standalone `wikilink` inlines. Non-text inlines
 * (already-recursed strong/em/del/link/etc.) pass through untouched — each
 * of those was produced by its own `inlineFromNodes` call, which already
 * applied this same split to its own text runs.
 */
export function splitWikilinksInInlines(inl: Inline[]): Inline[] {
  const out: Inline[] = [];

  for (const node of inl) {
    if (node.t !== "text") {
      out.push(node);
      continue;
    }

    const text = node.v;
    WIKILINK_RE.lastIndex = 0;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let matched = false;

    while ((match = WIKILINK_RE.exec(text))) {
      matched = true;

      if (match.index > lastIndex) {
        out.push({ t: "text", v: text.slice(lastIndex, match.index) });
      }

      const target = match[1].trim();
      const label = match[2]?.trim();
      out.push({ t: "wikilink", target, label: label ? label : undefined });

      lastIndex = WIKILINK_RE.lastIndex;
    }

    if (!matched) {
      out.push(node);
      continue;
    }

    if (lastIndex < text.length) {
      out.push({ t: "text", v: text.slice(lastIndex) });
    }
  }

  return out;
}

/** Every distinct `[[target]]` referenced anywhere in a raw draft body,
 * trimmed exactly as `splitWikilinksInInlines` would produce as `target`.
 * Used by the backlink index (src/lib/wikilinks/index.ts) to avoid
 * depending on a full parse of every draft just to find its outbound links. */
export function extractWikilinkTargets(raw: string): string[] {
  const targets = new Set<string>();
  WIKILINK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WIKILINK_RE.exec(raw))) {
    const target = match[1].trim();
    if (target) targets.add(target);
  }
  return Array.from(targets);
}
