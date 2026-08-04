"use client";

import { forwardRef, useMemo } from "react";

// Lightweight, presentational-only tokenizer — this is NOT the app's real
// Markdown parser (src/lib/parse.ts), it only needs to visually distinguish
// syntax characters from prose in the editor, line by line. False
// positives/negatives here have zero effect on parsing or publishing.
const SYNTAX_RE = /^(#{1,4}\s|>\s|-\s|\d+\.\s)|(\*\*|__|`{1,3}|~~|\[|\]|\(|\))/g;

type Token = { text: string; syntax: boolean };

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  SYNTAX_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SYNTAX_RE.exec(line))) {
    if (match.index > lastIndex) {
      tokens.push({ text: line.slice(lastIndex, match.index), syntax: false });
    }
    tokens.push({ text: match[0], syntax: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) tokens.push({ text: line.slice(lastIndex), syntax: false });
  return tokens;
}

/**
 * Renders `value` behind the real `<textarea>` in PasteInput, with Markdown
 * syntax characters (`#`, `**`, `- `, etc.) dimmed relative to prose.
 *
 * The textarea itself keeps rendering its native text but with
 * `text-transparent` — the browser still needs it to compute caret/selection
 * geometry and handle all input — while this div, sitting exactly behind it
 * with identical font/line-height/padding, is what the user actually sees.
 * `pointer-events-none` + `aria-hidden` keep it fully out of the way of
 * interaction and assistive tech; it is decoration only.
 *
 * `ref` is forwarded to the inner (unpadded) content wrapper so the parent
 * can sync scroll position via a direct `translateY` on scroll events,
 * without round-tripping through React state on every scroll tick.
 */
export const SyntaxOverlay = forwardRef<HTMLDivElement, { value: string; dimOutsideParagraphAt?: number | null }>(
  function SyntaxOverlay({ value, dimOutsideParagraphAt }, contentRef) {
    const lines = useMemo(() => value.split("\n"), [value]);

    // When set, computes the [start, end] line-index range of the paragraph
    // containing the caret (a "paragraph" is a run of non-blank lines) —
    // every line outside that range renders dimmed. Recomputed only when
    // the caret's line or the text itself changes, not on every render.
    const activeRange = useMemo(() => {
      if (dimOutsideParagraphAt == null) return null;
      const upTo = value.slice(0, dimOutsideParagraphAt);
      const caretLine = upTo.split("\n").length - 1;
      let start = caretLine;
      while (start > 0 && lines[start - 1]?.trim() !== "") start--;
      let end = caretLine;
      while (end < lines.length - 1 && lines[end + 1]?.trim() !== "") end++;
      return [start, end] as const;
    }, [dimOutsideParagraphAt, value, lines]);

    return (
      <div
        aria-hidden
        className={[
          "pointer-events-none absolute inset-0 overflow-hidden",
          // Reserves the same scrollbar gutter as the textarea it sits
          // behind (see .scrollbar-stable in globals.css) so both wrap
          // long lines against an identical content-box width regardless
          // of the textarea's actual scroll state — without this, the two
          // elements can word-wrap differently and drift out of sync.
          "scrollbar-stable",
          "whitespace-pre-wrap break-words",
          "font-mono text-sm leading-[1.65]",
          "px-5 py-4",
          "text-text-primary",
        ].join(" ")}
      >
        <div ref={contentRef}>
          {lines.map((line, i) => {
            const dimmed = activeRange ? i < activeRange[0] || i > activeRange[1] : false;
            return (
              <div key={i} className={dimmed ? "opacity-40 transition-opacity duration-normal" : "transition-opacity duration-normal"}>
                {tokenizeLine(line).map((tok, j) =>
                  tok.syntax ? (
                    <span key={j} className="text-text-muted/60">{tok.text}</span>
                  ) : (
                    <span key={j}>{tok.text}</span>
                  ),
                )}
                {line === "" ? " " : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);
