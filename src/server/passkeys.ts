import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import {
  createPasskey,
  findPasskey,
  getPasskeysByUser,
  saveWebAuthnChallenge,
  takeWebAuthnChallenge,
  touchPasskey,
} from "@/lib/db/auth";
import type { DbUser } from "@/lib/db/types";
import { createId } from "@/lib/id";
import { ServiceError } from "./errors";

/**
 * Passkeys (WebAuthn). A passkey is added from Account settings by someone
 * already signed in, and then signs in with no email or password typed:
 * the credential is discoverable, so the browser offers it and the
 * credential ID tells us whose it is.
 *
 * The relying-party ID is the site's hostname, so a passkey made on one
 * hostname does not work on another.
 */

export const WEBAUTHN_COOKIE = "booklet_webauthn";
export const MAX_PASSKEYS = 10;

const rpId = (origin: string) => new URL(origin).hostname;

/** Each ceremony gets a challenge stored server-side; its random ID goes in a cookie. */
async function newChallenge(challenge: string, userId: string | null): Promise<string> {
  const id = createId(32);
  await saveWebAuthnChallenge(id, challenge, userId);
  return id;
}

const failed = () => new ServiceError("PASSKEY_FAILED", "That passkey could not be verified. Try again.", 400);

export async function passkeyRegistrationOptions(user: DbUser, origin: string) {
  const existing = await getPasskeysByUser(user.id);
  if (existing.length >= MAX_PASSKEYS) {
    throw new ServiceError("TOO_MANY_PASSKEYS", `An account can have ${MAX_PASSKEYS} passkeys. Remove one first.`, 409);
  }
  const options = await generateRegistrationOptions({
    rpName: "Booklet",
    rpID: rpId(origin),
    userName: user.email ?? user.id,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    // Stops the same authenticator being registered twice.
    excludeCredentials: existing.map((p) => ({ id: p.id })),
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });
  return { options, challengeId: await newChallenge(options.challenge, user.id) };
}

export async function verifyPasskeyRegistration(
  userId: string,
  origin: string,
  challengeId: string | undefined,
  response: RegistrationResponseJSON,
  name: string,
): Promise<void> {
  const challenge = challengeId ? await takeWebAuthnChallenge(challengeId) : null;
  // The challenge was issued to this user, in this browser.
  if (!challenge || challenge.user_id !== userId) throw failed();

  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: origin,
    expectedRPID: rpId(origin),
    requireUserVerification: false,
  }).catch(() => null);
  if (!result?.verified || !result.registrationInfo) throw failed();

  const { credential } = result.registrationInfo;
  try {
    await createPasskey({
      id: credential.id,
      user_id: userId,
      public_key: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports ?? null,
      name,
    });
  } catch {
    throw new ServiceError("PASSKEY_EXISTS", "This passkey is already registered.", 409);
  }
}

export async function passkeyLoginOptions(origin: string) {
  // No allowCredentials: the browser offers whichever passkeys it holds for this site.
  const options = await generateAuthenticationOptions({ rpID: rpId(origin), userVerification: "preferred" });
  return { options, challengeId: await newChallenge(options.challenge, null) };
}

/** The user the passkey signs in. Throws when the response does not verify. */
export async function verifyPasskeyLogin(
  origin: string,
  challengeId: string | undefined,
  response: AuthenticationResponseJSON,
): Promise<string> {
  const challenge = challengeId ? await takeWebAuthnChallenge(challengeId) : null;
  const passkey = typeof response?.id === "string" ? await findPasskey(response.id) : null;
  if (!challenge || !passkey) throw failed();

  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: origin,
    expectedRPID: rpId(origin),
    credential: {
      id: passkey.id,
      publicKey: new Uint8Array(Buffer.from(passkey.public_key, "base64url")),
      counter: passkey.counter,
      transports: (passkey.transports ?? undefined) as never,
    },
    requireUserVerification: false,
  }).catch(() => null);
  if (!result?.verified) throw failed();

  await touchPasskey(passkey.id, result.authenticationInfo.newCounter);
  return passkey.user_id;
}
