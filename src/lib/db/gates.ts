import { getUser } from "./index";

export const FREE_PAGE_LIMIT = 5;

/** Returns true if the user has an active pro subscription. */
export async function isPro(userId: string): Promise<boolean> {
  const user = await getUser(userId);
  return user?.is_pro === 1;
}
