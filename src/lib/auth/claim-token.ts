import { jwtVerify, SignJWT } from "jose";

const CLAIM_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface ClaimPayload {
  userId: string;
}

/**
 * Reads the dedicated claim-signing secret. Deliberately has no fallback —
 * same fail-closed convention as INVITE_JWT_SECRET/UNLOCK_TOKEN_SECRET/
 * API_KEY_PEPPER/SESSION_TOKEN_PEPPER (see src/lib/invite-token.ts).
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.CLAIM_TOKEN_SECRET;
  if (!secret) {
    throw new Error(
      "CLAIM_TOKEN_SECRET is not set. Account-claim tokens cannot be signed or verified without it — set CLAIM_TOKEN_SECRET in the environment (see .env.example).",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signClaimToken(payload: ClaimPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${CLAIM_TTL_SECONDS}s`)
    .setIssuedAt()
    .sign(getJwtSecret());
}

export async function verifyClaimToken(token: string): Promise<ClaimPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return payload as unknown as ClaimPayload;
}
