/**
 * Login-CSRF mitigation for state-changing auth endpoints (signup/login).
 * SameSite=Lax on the session cookie stops a cross-site request from
 * *sending* an existing cookie, but does not stop the browser from
 * executing a cross-site POST and accepting whatever Set-Cookie the
 * response returns — that's exactly how "login CSRF" (silently logging a
 * victim into an attacker's account) works. Checking Origin against Host
 * closes that gap without needing a CSRF-token subsystem.
 *
 * Modern browsers send `Origin` on virtually all non-GET requests, same-
 * origin or not. A request with no Origin header at all is left alone here
 * (older/non-browser clients) — there is no session cookie to hijack before
 * one of these endpoints succeeds, so the residual risk is negligible.
 */
export function isSameOriginRequest(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;

  const host = req.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
