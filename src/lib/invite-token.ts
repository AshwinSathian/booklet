import { jwtVerify, SignJWT } from "jose";

const INVITE_TTL_SECONDS = 72 * 60 * 60; // 72 hours

export interface InvitePayload {
  teamId: string;
  invitedEmail: string;
  invitedBy: string;
}

/**
 * Reads the dedicated invite-signing secret. Deliberately has no fallback —
 * if INVITE_JWT_SECRET is unset, invite tokens must not be signed or verified
 * with any other value (a hardcoded constant would be readable from source;
 * borrowing CLERK_SECRET_KEY would needlessly couple two unrelated systems).
 * Throws so misconfiguration fails loudly instead of silently trusting a
 * guessable secret.
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.INVITE_JWT_SECRET;
  if (!secret) {
    throw new Error(
      "INVITE_JWT_SECRET is not set. Team-invite tokens cannot be signed or verified without it — set INVITE_JWT_SECRET in the environment (see .env.example).",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signInviteToken(payload: InvitePayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${INVITE_TTL_SECONDS}s`)
    .setIssuedAt()
    .sign(getJwtSecret());
}

export async function verifyInviteToken(token: string): Promise<InvitePayload> {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return payload as unknown as InvitePayload;
}
