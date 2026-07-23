// Matches Booklet's key generation: "bklt_" prefix + exactly 40 alphanumeric
// chars, plus the legacy "rdbl_" prefix issued before the Readable -> Booklet
// rename (already-issued keys must keep working — see src/lib/api-key.ts in
// the main app, which mirrors this same dual-prefix acceptance).
const KEY_PATTERN = /^(?:bklt_|rdbl_)[0-9A-Za-z]{40}$/;

export function extractApiKey(request: Request): string | null {
  const auth = request.headers.get("Authorization") ?? "";
  const match = auth.match(/^Bearer\s+((?:bklt_|rdbl_)\S+)$/);
  if (!match) return null;
  const key = match[1] ?? "";
  return KEY_PATTERN.test(key) ? key : null;
}
