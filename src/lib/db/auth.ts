/**
 * In-house auth data access: users (password-based) and sessions.
 * See PLAN-backend-auth-migration.md for the full design.
 */

import { getDb } from "@/lib/mongodb";
import { createId } from "@/lib/id";
import type { DbSession, DbUser } from "./types";

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

/** Creates a new password-based user. Caller must have already checked email uniqueness. */
export async function createUser(
  id: string,
  email: string,
  passwordHash: string,
  displayName: string | null = null,
): Promise<DbUser> {
  const db = await getDb();
  const doc: UserDoc = {
    _id: id,
    email: email.toLowerCase(),
    password_hash: passwordHash,
    display_name: displayName,
    plan: "free",
    created_at: new Date().toISOString(),
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

/** Sets a user's password (initial /claim, or a future reset flow). */
export async function setUserPassword(userId: string, passwordHash: string): Promise<void> {
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
