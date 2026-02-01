import { STORAGE } from "./constants";

export function normalizeInput(raw: string): string {
  const s = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return s.length > STORAGE.maxInputChars
    ? s.slice(0, STORAGE.maxInputChars)
    : s;
}

/**
 * Defensive: remove a few risky patterns if they appear in pasted content.
 * We still never render HTML, but this reduces surprise if someone pastes HTML-ish blobs.
 */
export function stripDangerousSequences(s: string): string {
  return s
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/on\w+\s*=\s*(['"]).*?\1/gi, "");
}
