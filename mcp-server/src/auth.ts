// Minimum key length after the rdbl_live_ prefix. Matches Readable's key
// generation (nanoid 32 chars). Rejects obviously fake/truncated keys early
// so we don't burn a round-trip to the Readable API on them.
const KEY_MIN_SUFFIX_LENGTH = 32;
const KEY_PATTERN = new RegExp(`^rdbl_live_[A-Za-z0-9]{${KEY_MIN_SUFFIX_LENGTH},}$`);

export function extractApiKey(request: Request): string | null {
  const auth = request.headers.get("Authorization") ?? "";
  const match = auth.match(/^Bearer\s+(rdbl_live_\S+)$/);
  if (!match) return null;
  const key = match[1] ?? "";
  // Enforce format and minimum length before passing to upstream
  return KEY_PATTERN.test(key) ? key : null;
}
