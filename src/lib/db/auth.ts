/**
 * In-house auth data access: users (password-based) and sessions.
 * D1 port. expires_at is stored as epoch milliseconds; an hourly Cron
 * Trigger deletes expired rows in place of MongoDB's TTL indexes.
 */

import { getD1 } from "@/lib/d1";
import { createId } from "@/lib/id";
import type { DbPasswordResetToken, DbSession, DbUser } from "./types";

type TokenRow<T> = Omit<T, "expires_at"> & { expires_at: number };

function withDate<T extends { expires_at: Date }>(row: TokenRow<T> | null): T | null {
  return row ? ({ ...row, expires_at: new Date(row.expires_at) } as unknown as T) : null;
}

/** Creates a new password-based user. Caller must have already checked email uniqueness. */
export async function createUser(
  id: string,
  email: string,
  passwordHash: string,
  displayName: string | null = null,
): Promise<DbUser> {
  const user: DbUser = {
    id,
    email: email.toLowerCase(),
    password_hash: passwordHash,
    display_name: displayName,
    plan: "free",
    created_at: new Date().toISOString(),
  };
  await getD1()
    .prepare("INSERT INTO users (id, email, password_hash, display_name, plan, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(user.id, user.email, user.password_hash, user.display_name, user.plan, user.created_at)
    .run();
  return user;
}

export async function getUserById(id: string): Promise<DbUser | null> {
  return getD1().prepare("SELECT * FROM users WHERE id = ?").bind(id).first<DbUser>();
}

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  return getD1().prepare("SELECT * FROM users WHERE email = ?").bind(email.toLowerCase()).first<DbUser>();
}

/** Sets a user's password (password reset). */
export async function setUserPassword(userId: string, passwordHash: string): Promise<void> {
  await getD1().prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(passwordHash, userId).run();
}

export async function createSessionRecord(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<DbSession> {
  const session: DbSession = {
    id: createId(20),
    user_id: userId,
    token_hash: tokenHash,
    created_at: new Date().toISOString(),
    expires_at: expiresAt,
  };
  await getD1()
    .prepare("INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
    .bind(session.id, userId, tokenHash, session.created_at, expiresAt.getTime())
    .run();
  return session;
}

// MongoDB's TTL index removed expired rows within about a minute. The
// cleanup cron is hourly, so the lookups filter on expires_at themselves.
export async function findSessionByHash(tokenHash: string): Promise<DbSession | null> {
  return withDate<DbSession>(
    await getD1()
      .prepare("SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?")
      .bind(tokenHash, Date.now())
      .first<TokenRow<DbSession>>(),
  );
}

/** Slides a session's expiry forward (called when it's past the halfway point of its window). */
export async function touchSessionExpiry(id: string, expiresAt: Date): Promise<void> {
  await getD1().prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").bind(expiresAt.getTime(), id).run();
}

export async function deleteSessionByHash(tokenHash: string): Promise<void> {
  await getD1().prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}

/** Logout-everywhere: revokes every session for a user. */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  await getD1().prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
}

/** Creates a reset token, first deleting any earlier still-live token for this user — only one live reset link at a time. */
export async function createPasswordResetToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  const db = getD1();
  await db.batch([
    db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").bind(userId),
    db
      .prepare("INSERT INTO password_reset_tokens (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
      .bind(createId(20), userId, tokenHash, new Date().toISOString(), expiresAt.getTime()),
  ]);
}

export async function findPasswordResetTokenByHash(tokenHash: string): Promise<DbPasswordResetToken | null> {
  return withDate<DbPasswordResetToken>(
    await getD1()
      .prepare("SELECT * FROM password_reset_tokens WHERE token_hash = ? AND expires_at > ?")
      .bind(tokenHash, Date.now())
      .first<TokenRow<DbPasswordResetToken>>(),
  );
}

export async function deletePasswordResetToken(tokenHash: string): Promise<void> {
  await getD1().prepare("DELETE FROM password_reset_tokens WHERE token_hash = ?").bind(tokenHash).run();
}
