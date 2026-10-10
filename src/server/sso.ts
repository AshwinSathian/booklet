import {
  createIdentity,
  createUser,
  deleteAllUserSessions,
  findIdentity,
  getIdentitiesByUser,
  getPasskeysByUser,
  getUserByEmail,
  getUserById,
  markEmailVerified,
  setUserPassword,
} from "@/lib/db/auth";
import type { SsoProvider } from "@/lib/db/types";
import type { SsoProfile } from "@/lib/auth/sso";
import { createId } from "@/lib/id";
import { getDb } from "@/lib/mongodb";
import { revokeAllForUser } from "@/lib/oauth/server";

function isDuplicateKey(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === 11000;
}

/**
 * The Booklet user a provider sign-in belongs to, creating or linking as
 * needed:
 *
 * 1. The identity is already linked: that user.
 * 2. An account has the same email: link to it. The provider vouches for
 *    the address, so the account's email becomes verified.
 * 3. Otherwise a new account, with no password.
 *
 * Case 2 is where an account could be stolen. Anyone can register an
 * address they do not own and wait for its owner to arrive through a
 * provider. So when the existing account's address was never verified,
 * everything its creator could still sign in with is removed before the
 * link: password, passkeys, sessions and connected apps. (An unverified
 * account cannot create API keys; see assertVerified.)
 */
export async function resolveSsoUser(provider: SsoProvider, profile: SsoProfile): Promise<string> {
  const identity = await findIdentity(provider, profile.providerUserId);
  if (identity && (await getUserById(identity.user_id))) return identity.user_id;

  const existing = await getUserByEmail(profile.email);
  if (existing) {
    if (!existing.email_verified_at) {
      await setUserPassword(existing.id, null);
      await (await getDb()).collection("passkeys").deleteMany({ user_id: existing.id });
      await deleteAllUserSessions(existing.id);
      await revokeAllForUser(existing.id);
    }
    await linkIdentity(existing.id, provider, profile);
    return existing.id;
  }

  try {
    const user = await createUser(createId(20), profile.email, null, null, new Date().toISOString());
    await createIdentity(user.id, provider, profile.providerUserId, profile.email);
    return user.id;
  } catch (err) {
    // Two callbacks for the same new person raced; the other one won.
    if (!isDuplicateKey(err)) throw err;
    return resolveSsoUser(provider, profile);
  }
}

export class SsoLinkError extends Error {}

/** Links a provider identity to `userId`. Refuses an identity that signs in someone else, or a second identity at one provider. */
export async function linkIdentity(userId: string, provider: SsoProvider, profile: SsoProfile): Promise<void> {
  const taken = await findIdentity(provider, profile.providerUserId);
  if (taken && taken.user_id !== userId) throw new SsoLinkError("identity_taken");
  if (!taken) {
    try {
      await createIdentity(userId, provider, profile.providerUserId, profile.email);
    } catch (err) {
      if (isDuplicateKey(err)) throw new SsoLinkError("provider_already_linked");
      throw err;
    }
  }
  // Only the account's own address is vouched for.
  if ((await getUserById(userId))?.email === profile.email) await markEmailVerified(userId);
}

/** How many ways this account can sign in. The last one cannot be removed. */
export async function countSignInMethods(userId: string): Promise<number> {
  const [user, identities, passkeys] = await Promise.all([getUserById(userId), getIdentitiesByUser(userId), getPasskeysByUser(userId)]);
  return (user?.password_hash ? 1 : 0) + identities.length + passkeys.length;
}
