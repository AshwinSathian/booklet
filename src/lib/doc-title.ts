import type { Block } from "./blocks";

export function extractDocTitle(blocks: Block[]): string | null {
  for (const b of blocks ?? []) {
    if (b?.t === "heading" && ((b as { level?: number }).level === 1 || (b as { level?: number }).level === 2)) {
      const t = inlineToText((b as Record<string, unknown>).inl);
      if (t) return clamp(t, 64);
    }
  }
  return null;
}

/**
 * One or two sentences for a link preview: the first paragraph long enough
 * to say something. A badge line or a one-word paragraph ("MIT") is passed
 * over; if there is nothing longer, the first paragraph is used after all.
 */
export function extractDocDescription(blocks: Block[]): string | null {
  let first: string | null = null;
  for (const b of blocks ?? []) {
    if (b?.t !== "paragraph") continue;
    const t = inlineToText((b as Record<string, unknown>).inl);
    if (!t) continue;
    first ??= t;
    if (t.length >= 50) return clamp(t, 160);
  }
  return first ? clamp(first, 160) : null;
}

function inlineToText(inl: unknown): string {
  if (!inl) return "";
  if (Array.isArray(inl)) return inl.map(inlineToText).join("").trim();
  if (typeof inl === "string") return inl;
  if (typeof inl !== "object" || inl === null) return "";
  const o = inl as Record<string, unknown>;
  if (o.t === "text" || o.t === "code") return String(o.v ?? "");
  if (o.t === "link") return inlineToText(o.c);
  if (o.t === "strong" || o.t === "em") return inlineToText(o.c);
  return "";
}

function clamp(s: string, n: number) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n - 1).trimEnd() + "…";
}
