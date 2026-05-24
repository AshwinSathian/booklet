// Matches Readable's key generation: "rdbl_" prefix + exactly 40 alphanumeric chars.
// See src/lib/api-key.ts in the main app: PREFIX = "rdbl_", createId(40) uses [0-9a-zA-Z].
const KEY_PATTERN = /^rdbl_[0-9A-Za-z]{40}$/;

export function extractApiKey(request: Request): string | null {
  const auth = request.headers.get("Authorization") ?? "";
  const match = auth.match(/^Bearer\s+(rdbl_\S+)$/);
  if (!match) return null;
  const key = match[1] ?? "";
  return KEY_PATTERN.test(key) ? key : null;
}
