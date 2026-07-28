// Standard "mirror div" technique for locating a textarea caret's pixel
// position (there is no native DOM API for this) — used to anchor the
// wikilink autocomplete popup (src/components/app/PasteInput.tsx) at the
// cursor instead of some fixed corner of the editor.
const MIRRORED_STYLE_PROPS = [
  "boxSizing",
  "width",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontSize",
  "lineHeight",
  "fontFamily",
  "letterSpacing",
  "textIndent",
] as const;

export type CaretCoordinates = { top: number; left: number; height: number };

/** Position of the character at `index`, relative to the textarea's own
 * un-scrolled content box (caller subtracts scrollTop/scrollLeft). */
export function getCaretCoordinates(
  ta: HTMLTextAreaElement,
  index: number,
): CaretCoordinates {
  const div = document.createElement("div");
  const computed = window.getComputedStyle(ta);

  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.overflowWrap = "break-word";

  for (const prop of MIRRORED_STYLE_PROPS) {
    div.style.setProperty(cssPropertyName(prop), computed.getPropertyValue(cssPropertyName(prop)));
  }

  document.body.appendChild(div);

  div.textContent = ta.value.slice(0, index);
  const span = document.createElement("span");
  // A trailing space would collapse in the mirror; a non-breaking marker
  // guarantees the span always has measurable width/position.
  span.textContent = ta.value.slice(index) || "​";
  div.appendChild(span);

  const borderTop = parseFloat(computed.borderTopWidth || "0");
  const borderLeft = parseFloat(computed.borderLeftWidth || "0");
  const lineHeight = parseFloat(computed.lineHeight || "0") || span.offsetHeight;

  const coords: CaretCoordinates = {
    top: span.offsetTop + borderTop,
    left: span.offsetLeft + borderLeft,
    height: lineHeight,
  };

  document.body.removeChild(div);
  return coords;
}

function cssPropertyName(camelCase: string): string {
  return camelCase.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
