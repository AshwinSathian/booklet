import { upsertUser } from "./index";

export async function ensureDbUser(
  clerkUserId: string,
  email: string | null | undefined,
): Promise<void> {
  await upsertUser(clerkUserId, email ?? null);
}
