// Deliberately dependency-free (no db/mongodb imports) — middleware.ts runs
// in the Edge runtime and needs this cookie name without pulling in the
// Node-only MongoDB driver transitively through src/lib/auth/session.ts.
export const SESSION_COOKIE_NAME = "readable_session";
