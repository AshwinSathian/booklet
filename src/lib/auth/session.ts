/**
 * Session management for in-house auth. Sessions are opaque, DB-backed,
 * HMAC-hashed tokens (src/lib/auth/session-token.ts) delivered via an
 * httpOnly/Secure/SameSite=Lax cookie — see PLAN-backend-auth-migration.md
 * for why this is DB-backed rather than a stateless JWT (instant revocation).
 *
 * `createSession`/`destroySession` mutate cookies and may only be called
 * from a Route Handler or Server Action (Next.js forbids cookie writes from
 * Server Components). `getSession` is read-only and safe anywhere.
 */

import { cookies } from "next/headers";
import {
  createSessionRecord,
  deleteAllUserSessions,
  deleteSessionByHash,
  findSessionByHash,
  touchSessionExpiry,
} from "@/lib/db/auth";
import { generateSessionToken, hashSessionToken } from "./session-token";
import { SESSION_COOKIE_NAME } from "./constants";

export { SESSION_COOKIE_NAME };

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const REFRESH_THRESHOLD_MS = SESSION_TTL_MS / 2; // slide forward once past the halfway point

export type SessionUser = { userId: string };

export async function createSession(userId: string): Promise<void> {
  const raw = generateSessionToken();
  const tokenHash = await hashSessionToken(raw);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await createSessionRecord(userId, tokenHash, expiresAt);

  (await cookies()).set(SESSION_COOKIE_NAME, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const raw = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;

  const tokenHash = await hashSessionToken(raw);
  const session = await findSessionByHash(tokenHash);
  if (!session) return null;

  if (session.expires_at.getTime() <= Date.now()) return null;

  // Sliding expiry: only write back once we're past the halfway point, so a
  // busy session isn't paying a Mongo write on every single request.
  const remaining = session.expires_at.getTime() - Date.now();
  if (remaining < REFRESH_THRESHOLD_MS) {
    void touchSessionExpiry(session.id, new Date(Date.now() + SESSION_TTL_MS)).catch(() => {});
  }

  return { userId: session.user_id };
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;
  if (raw) {
    const tokenHash = await hashSessionToken(raw);
    await deleteSessionByHash(tokenHash);
  }
  store.delete(SESSION_COOKIE_NAME);
}

/** Logout-everywhere — revokes every session for a user, including the caller's own. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await deleteAllUserSessions(userId);
}
