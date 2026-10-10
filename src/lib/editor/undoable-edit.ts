/**
 * Applies a programmatic edit to a textarea in a way the browser's native
 * undo stack records.
 *
 * Setting a controlled textarea's value through React state replaces the
 * whole value and wipes undo history, so Cmd/Ctrl+Z after a toolbar click
 * did nothing. `document.execCommand("insertText")` is deprecated but is
 * still the only API in any engine that edits a textarea *and* pushes an undo
 * entry; it fires a normal `input` event, so React's onChange sees the edit
 * exactly as if the user had typed it.
 *
 * Only the span that differs between the current and next value is replaced
 * (common prefix and suffix are left alone), so the undo entry is the edit
 * itself and a replace-all is still a single undo step.
 *
 * `fallback` receives the full next value when execCommand is unavailable or
 * refuses (returns false) — the pre-existing behaviour, without undo.
 */
export function applyUndoableEdit(
  ta: HTMLTextAreaElement,
  next: string,
  fallback: (value: string) => void,
): void {
  const prev = ta.value;
  if (prev === next) return;

  const max = Math.min(prev.length, next.length);
  let start = 0;
  while (start < max && prev.charCodeAt(start) === next.charCodeAt(start)) start++;
  let tail = 0;
  while (
    tail < max - start &&
    prev.charCodeAt(prev.length - 1 - tail) === next.charCodeAt(next.length - 1 - tail)
  ) {
    tail++;
  }
  // Never split a surrogate pair: widen the span to whole code points.
  if (start > 0 && isHighSurrogate(prev.charCodeAt(start - 1))) start--;
  if (tail > 0 && isLowSurrogate(prev.charCodeAt(prev.length - tail))) tail--;

  const insertion = next.slice(start, next.length - tail);
  ta.focus();
  ta.setSelectionRange(start, prev.length - tail);

  let ok = false;
  try {
    ok = insertion
      ? document.execCommand("insertText", false, insertion)
      : document.execCommand("delete");
  } catch {
    ok = false;
  }
  if (!ok || ta.value !== next) fallback(next);
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}
