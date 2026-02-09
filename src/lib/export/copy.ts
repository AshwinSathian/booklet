/**
 * Clipboard helpers.
 *
 * - Uses `navigator.clipboard.writeText` when available.
 * - Falls back to a temporary `<textarea>` + `document.execCommand('copy')`.
 *
 * Must only be called in client event handlers.
 */

export async function copyTextToClipboard(text: string): Promise<void> {
  // Clipboard API (preferred)
  if (
    typeof navigator !== "undefined" &&
    typeof window !== "undefined" &&
    "clipboard" in navigator &&
    typeof navigator.clipboard?.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to legacy approach.
    }
  }

  // Legacy fallback.
  fallbackCopyText(text);
}

function fallbackCopyText(text: string) {
  if (typeof document === "undefined") {
    throw new Error("Clipboard unavailable");
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;

  // Avoid scrolling to bottom on iOS.
  textarea.setAttribute("readonly", "");

  // Keep it offscreen and non-intrusive.
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.left = "-1000px";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);

  // Selection must happen after append.
  textarea.focus();
  textarea.select();

  const ok = document.execCommand?.("copy") ?? false;
  document.body.removeChild(textarea);

  if (!ok) {
    throw new Error("Copy failed");
  }
}
