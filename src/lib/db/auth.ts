/**
 * In-house auth data access: users (password-based) and sessions.
 */

import { getDb } from "@/lib/mongodb";
import { createId } from "@/lib/id";
import type { DbPasskey, DbPasswordResetToken, DbSession, DbUser, DbUserIdentity, SsoProvider } from "./types";

type UserDoc = Omit<DbUser, "id"> & { _id: string };
type SessionDoc = Omit<DbSession, "id"> & { _id: string };

function toUser(doc: UserDoc): DbUser {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

function toSession(doc: SessionDoc): DbSession {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

/**
 * Creates a user. `passwordHash` is null for an account that signs in through
 * a provider only. Caller must have already checked email uniqueness; the
 * unique index on users.email is the authoritative guard.
 */
export async function createUser(
  id: string,
  email: string,
  passwordHash: string | null,
  displayName: string | null = null,
  emailVerifiedAt: string | null = null,
): Promise<DbUser> {
  const db = await getDb();
  const doc: UserDoc = {
    _id: id,
    email: email.toLowerCase(),
    password_hash: passwordHash,
    display_name: displayName,
    plan: "free",
    created_at: new Date().toISOString(),
    email_verified_at: emailVerifiedAt,
  };
  await db.collection<UserDoc>("users").insertOne(doc);
  return toUser(doc);
}

export async function getUserById(id: string): Promise<DbUser | null> {
  const db = await getDb();
  const doc = await db.collection<UserDoc>("users").findOne({ _id: id });
  return doc ? toUser(doc) : null;
}

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const db = await getDb();
  const doc = await db.collection<UserDoc>("users").findOne({ email: email.toLowerCase() });
  return doc ? toUser(doc) : null;
}

/** Sets a user's password, or removes it with null (the account then signs in through a provider or passkey only). */
export async function setUserPassword(userId: string, passwordHash: string | null): Promise<void> {
  const db = await getDb();
  await db.collection<UserDoc>("users").updateOne({ _id: userId }, { $set: { password_hash: passwordHash } });
}

export async function createSessionRecord(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<DbSession> {
  const db = await getDb();
  const doc: SessionDoc = {
    _id: createId(20),
    user_id: userId,
    token_hash: tokenHash,
    created_at: new Date().toISOString(),
    expires_at: expiresAt,
  };
  await db.collection<SessionDoc>("sessions").insertOne(doc);
  return toSession(doc);
}

export async function findSessionByHash(tokenHash: string): Promise<DbSession | null> {
  const db = await getDb();
  const doc = await db.collection<SessionDoc>("sessions").findOne({ token_hash: tokenHash });
  return doc ? toSession(doc) : null;
}

/** Slides a session's expiry forward (called when it's past the halfway point of its window). */
export async function touchSessionExpiry(id: string, expiresAt: Date): Promise<void> {
  const db = await getDb();
  await db.collection<SessionDoc>("sessions").updateOne({ _id: id }, { $set: { expires_at: expiresAt } });
}

export async function deleteSessionByHash(tokenHash: string): Promise<void> {
  const db = await getDb();
  await db.collection<SessionDoc>("sessions").deleteOne({ token_hash: tokenHash });
}

/** Logout-everywhere: revokes every session for a user. */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  const db = await getDb();
  await db.collection<SessionDoc>("sessions").deleteMany({ user_id: userId });
}

type PasswordResetTokenDoc = Omit<DbPasswordResetToken, "id"> & { _id: string };

function toPasswordResetToken(doc: PasswordResetTokenDoc): DbPasswordResetToken {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

/** Creates a reset token, first deleting any earlier still-live token for this user — only one live reset link at a time. */
export async function createPasswordResetToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  const db = await getDb();
  await db.collection<PasswordResetTokenDoc>("password_reset_tokens").deleteMany({ user_id: userId });
  await db.collection<PasswordResetTokenDoc>("password_reset_tokens").insertOne({
    _id: createId(20),
    user_id: userId,
    token_hash: tokenHash,
    created_at: new Date().toISOString(),
    expires_at: expiresAt,
  });
}

export async function findPasswordResetTokenByHash(tokenHash: string): Promise<DbPasswordResetToken | null> {
  const db = await getDb();
  const doc = await db.collection<PasswordResetTokenDoc>("password_reset_tokens").findOne({ token_hash: tokenHash });
  return doc ? toPasswordResetToken(doc) : null;
}

export async function deletePasswordResetToken(tokenHash: string): Promise<void> {
  const db = await getDb();
  await db.collection<PasswordResetTokenDoc>("password_reset_tokens").deleteOne({ token_hash: tokenHash });
}

// ── Email verification ──────────────────────────────────────────────────────

/** Records that the user's current address is verified. Keeps the first time if already set. */
export async function markEmailVerified(userId: string): Promise<void> {
  const db = await getDb();
  await db
    .collection<UserDoc>("users")
    .updateOne({ _id: userId, email_verified_at: null }, { $set: { email_verified_at: new Date().toISOString() } });
}

type EmailVerificationTokenDoc = {
  _id: string;
  user_id: string;
  /** The address the link was mailed to. The link is void if the account's address changed since. */
  email: string;
  token_hash: string;
  expires_at: Date;
};

/** Creates a verification token, replacing any earlier one: only the newest link works. */
export async function createEmailVerificationToken(userId: string, email: string, tokenHash: string, expiresAt: Date): Promise<void> {
  const col = (await getDb()).collection<EmailVerificationTokenDoc>("email_verification_tokens");
  await col.deleteMany({ user_id: userId });
  await col.insertOne({ _id: createId(20), user_id: userId, email, token_hash: tokenHash, expires_at: expiresAt });
}

/** Removes and returns the token, so a link works once. Null when unknown or expired. */
export async function consumeEmailVerificationToken(tokenHash: string): Promise<{ user_id: string; email: string } | null> {
  const col = (await getDb()).collection<EmailVerificationTokenDoc>("email_verification_tokens");
  const doc = await col.findOneAndDelete({ token_hash: tokenHash });
  if (!doc || doc.expires_at.getTime() <= Date.now()) return null;
  return { user_id: doc.user_id, email: doc.email };
}

export async function hasLiveEmailVerificationToken(userId: string): Promise<boolean> {
  const col = (await getDb()).collection<EmailVerificationTokenDoc>("email_verification_tokens");
  return Boolean(await col.findOne({ user_id: userId, expires_at: { $gt: new Date() } }));
}

// ── Provider identities ─────────────────────────────────────────────────────

type IdentityDoc = Omit<DbUserIdentity, "id"> & { _id: string };

function toIdentity(doc: IdentityDoc): DbUserIdentity {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

export async function findIdentity(provider: SsoProvider, providerUserId: string): Promise<DbUserIdentity | null> {
  const doc = await (await getDb())
    .collection<IdentityDoc>("user_identities")
    .findOne({ provider, provider_user_id: providerUserId });
  return doc ? toIdentity(doc) : null;
}

/** Links a provider identity to a user. Throws E11000 if that identity is already linked. */
export async function createIdentity(userId: string, provider: SsoProvider, providerUserId: string, email: string): Promise<void> {
  await (await getDb()).collection<IdentityDoc>("user_identities").insertOne({
    _id: createId(20),
    user_id: userId,
    provider,
    provider_user_id: providerUserId,
    email,
    created_at: new Date().toISOString(),
  });
}

export async function getIdentitiesByUser(userId: string): Promise<DbUserIdentity[]> {
  const docs = await (await getDb()).collection<IdentityDoc>("user_identities").find({ user_id: userId }).toArray();
  return docs.map(toIdentity);
}

export async function deleteIdentity(userId: string, provider: SsoProvider): Promise<void> {
  await (await getDb()).collection<IdentityDoc>("user_identities").deleteMany({ user_id: userId, provider });
}

// ── Passkeys ────────────────────────────────────────────────────────────────

type PasskeyDoc = Omit<DbPasskey, "id"> & { _id: string };

function toPasskey(doc: PasskeyDoc): DbPasskey {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

export async function createPasskey(passkey: Omit<DbPasskey, "created_at" | "last_used_at">): Promise<void> {
  const { id, ...rest } = passkey;
  await (await getDb())
    .collection<PasskeyDoc>("passkeys")
    .insertOne({ _id: id, ...rest, created_at: new Date().toISOString(), last_used_at: null });
}

export async function getPasskeysByUser(userId: string): Promise<DbPasskey[]> {
  const docs = await (await getDb()).collection<PasskeyDoc>("passkeys").find({ user_id: userId }).sort({ created_at: 1 }).toArray();
  return docs.map(toPasskey);
}

export async function findPasskey(id: string): Promise<DbPasskey | null> {
  const doc = await (await getDb()).collection<PasskeyDoc>("passkeys").findOne({ _id: id });
  return doc ? toPasskey(doc) : null;
}

export async function touchPasskey(id: string, counter: number): Promise<void> {
  await (await getDb())
    .collection<PasskeyDoc>("passkeys")
    .updateOne({ _id: id }, { $set: { counter, last_used_at: new Date().toISOString() } });
}

export async function deletePasskey(id: string, userId: string): Promise<boolean> {
  const res = await (await getDb()).collection<PasskeyDoc>("passkeys").deleteOne({ _id: id, user_id: userId });
  return res.deletedCount === 1;
}

type ChallengeDoc = { _id: string; challenge: string; user_id: string | null; expires_at: Date };

/** Stores a WebAuthn challenge for one ceremony. `id` travels in an httpOnly cookie. */
export async function saveWebAuthnChallenge(id: string, challenge: string, userId: string | null): Promise<void> {
  await (await getDb())
    .collection<ChallengeDoc>("webauthn_challenges")
    .insertOne({ _id: id, challenge, user_id: userId, expires_at: new Date(Date.now() + 5 * 60_000) });
}

/** Removes and returns a challenge, so it can be answered once. */
export async function takeWebAuthnChallenge(id: string): Promise<{ challenge: string; user_id: string | null } | null> {
  const doc = await (await getDb()).collection<ChallengeDoc>("webauthn_challenges").findOneAndDelete({ _id: id });
  if (!doc || doc.expires_at.getTime() <= Date.now()) return null;
  return { challenge: doc.challenge, user_id: doc.user_id };
}
