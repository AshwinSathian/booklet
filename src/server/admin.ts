import { getSession } from "@/lib/auth/session";

/**
 * The authoritative admin check: a real session whose user id is in
 * ADMIN_USER_IDS. Fails closed — an empty or unset list admits nobody.
 * Bypassed in development, like the IP allowlist in src/middleware.ts.
 *
 * Used by src/app/admin/layout.tsx for page renders and, separately, by
 * every admin Server Action: a layout does not run for an action POST, so
 * an action that skipped this would be callable by any signed-in user.
 */
export async function isAdminRequest(): Promise<boolean> {
  if (process.env.NODE_ENV === "development") return true;

  const allowedUserIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowedUserIds.length === 0) return false;

  const session = await getSession();
  return session !== null && allowedUserIds.includes(session.userId);
}
