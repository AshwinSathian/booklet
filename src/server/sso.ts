import {
  createIdentity,
  createUser,
  findIdentity,
  getIdentitiesByUser,
  getPasskeysByUser,
  getUserByEmail,
  getUserById,
  markEmailVerified,
} from "@/lib/db/auth";
import type { SsoProvider } from "@/lib/db/types";
import type { SsoProfile } from "@/lib/auth/sso";
import { createId } from "@/lib/id";
import { isVerified } from "./verification";

function isDuplicateKey(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === 11000;
}

/**
 * The Booklet user a provider sign-in belongs to, creating or linking as
 * needed:
 *
 * 1. The identity is already linked: that user.
 * 2. An account has the same email, and that account's address is
 *    verified: link to it.
 * 3. No account has that email: a new account, with no password.
 *
 * Case 2 is where an account could be stolen. Anyone can register an
 * address they do not own and wait for its owner to arrive through a
 * provider; whatever they set up there (a password, an API key) would give
 * them the owner's account. So an account whose address was never verified
 * is not linked to. The person is told to sign in to it and confirm the
 * address, or reset its password, which proves the same thing.
 */
export async function resolveSsoUser(provider: SsoProvider, profile: SsoProfile): Promise<string> {
  const identity = await findIdentity(provider, profile.providerUserId);
  if (identity && (await getUserById(identity.user_id))) return identity.user_id;

  const existing = await getUserByEmail(profile.email);
  if (existing) {
    // The stored field, not isVerified(): where verification is not
    // enforced nobody's address is proven, and the rule matters just as much.
    if (!existing.email_verified_at) throw new SsoLinkError("email_unverified");
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

/**
 * Links a provider identity to `userId`. Refuses an identity that signs in
 * someone else, or a second identity at one provider.
 *
 * An account that still has to confirm its address can only connect a
 * provider account with that same address (which then confirms it). Any
 * other identity would be a way in that survives the address's real owner
 * taking the account over.
 */
export async function linkIdentity(userId: string, provider: SsoProvider, profile: SsoProfile): Promise<void> {
  const user = await getUserById(userId);
  if (!user) throw new SsoLinkError("failed");
  if (!isVerified(user) && user.email !== profile.email) throw new SsoLinkError("email_unverified");

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
  await markEmailVerified(userId, profile.email);
}

/** How many ways this account can sign in. The last one cannot be removed. */
export async function countSignInMethods(userId: string): Promise<number> {
  const [user, identities, passkeys] = await Promise.all([getUserById(userId), getIdentitiesByUser(userId), getPasskeysByUser(userId)]);
  return (user?.password_hash ? 1 : 0) + identities.length + passkeys.length;
}
