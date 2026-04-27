import { upsertUser } from "./index";

/**
 * Idempotently ensures a D1 user row exists for the given Clerk user.
 * Called at the top of every authenticated API route — creates the row
 * on first call, does nothing on subsequent calls (ON CONFLICT DO UPDATE).
 */
export async function ensureDbUser(
  clerkUserId: string,
  email: string | null | undefined,
): Promise<void> {
  await upsertUser(clerkUserId, email ?? null);
}
