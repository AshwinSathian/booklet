/**
 * Post-auth redirect validation.
 *
 * `redirect_url` (sign-in / sign-up) is attacker-controlled: it comes
 * straight off the query string of a link someone else can send a user.
 * If we let it point anywhere, a crafted sign-in link sends a
 * freshly-authenticated user to an attacker-controlled origin — a
 * phishing-adjacent open redirect that trades on the trust of "I just
 * signed in to Booklet".
 *
 * Rather than trying to block every way a string can *look* like it points
 * off-site (protocol-relative `//evil.com`, backslash `/\evil.com`
 * — browsers normalize a leading backslash to a slash — percent-encoded
 * `/%2F%2Fevil.com`, double-encoded `/%252F%252Fevil.com`, etc.), we check
 * the string against an explicit allowlist of the same-app path prefixes
 * this app actually redirects to post sign-in/up. That turns "have I
 * blocked every bypass of my blocklist" into "is this one of the small,
 * known set of destinations we expect" — robust against encoding tricks we
 * haven't thought of, because we're not trying to decode/normalize
 * attacker input at all.
 *
 * Legitimate destinations found in the codebase (see grep for
 * `redirect_url` across `src/app`):
 *   - `/app`        — default post sign-in/up redirect (see src/app/sign-in/AuthForm.tsx)
 *   - `/my-pages`   — dashboard, linked post-auth in various places
 *   - `/cli-auth`   — `?port=&state=` return target for `booklet login`
 *   - `/t/join`     — `?token=` team-invite return target
 */
const SAFE_REDIRECT_PREFIXES = ["/app", "/my-pages", "/cli-auth", "/t/join"] as const;

/**
 * Returns true only if `url` is a same-app relative path under one of
 * `SAFE_REDIRECT_PREFIXES`. Matching requires the prefix to be followed by
 * end-of-string, `/`, `?`, or `#` — so `/app` and `/app?x=1` match, but
 * `/app-evil.com` does not.
 */
export function isSafeRedirect(url: string | undefined | null): url is string {
  if (typeof url !== "string" || url.length === 0) return false;

  return SAFE_REDIRECT_PREFIXES.some((prefix) => {
    if (!url.startsWith(prefix)) return false;
    const next = url.charAt(prefix.length);
    return next === "" || next === "/" || next === "?" || next === "#";
  });
}
