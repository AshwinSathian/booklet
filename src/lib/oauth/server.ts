/**
 * The OAuth 2.1 authorization server behind "sign in" on the MCP server:
 * authorization code + PKCE (S256 only), public clients, rotating refresh
 * tokens. Hand-written because Booklet runs as a plain Node process with
 * MongoDB (docs/adr/0001-hosting-platform.md); the routes under
 * src/app/api/oauth and src/app/oauth are thin wrappers over this file.
 *
 * Codes and tokens are random strings. Only their HMAC (the API-key pepper)
 * is stored, so a database leak yields nothing usable.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { OAUTH_SCOPES, type OAuthScope } from "booklet-api-client";
import { getDb } from "@/lib/mongodb";
import { hashApiKey } from "@/lib/api-key";
import { createId } from "@/lib/id";
import { getClient, redirectUriMatches, type OAuthClient } from "./clients";

export const ACCESS_TOKEN_TTL_S = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL_S = 30 * 24 * 60 * 60; // 30 days, renewed on each use
const CODE_TTL_S = 120;
// A used code is kept a little longer than it is valid, so a replay inside
// that window is recognized as a replay and not as an unknown code.
const CODE_RETENTION_S = 15 * 60;

/** The one resource tokens are issued for: the MCP server's public URL. */
export function oauthResource(): string {
  return normalizeResource(process.env.MCP_PUBLIC_URL || "https://booklet-mcp.ashwinsathian.com/mcp");
}

function normalizeResource(resource: string): string {
  return resource.replace(/\/+$/, "");
}

type CodeDoc = {
  _id: string; // HMAC of the code
  grant_id: string;
  client_id: string;
  user_id: string;
  redirect_uri: string;
  code_challenge: string;
  scope: OAuthScope[];
  resource: string;
  expires_at: Date;
  used_at: Date | null;
  purge_at: Date; // TTL index
};

type TokenDoc = {
  _id: string; // HMAC of the token
  kind: "access" | "refresh";
  /** Every token descended from one consent shares this, so a replay can revoke them all. */
  grant_id: string;
  client_id: string;
  user_id: string;
  scope: OAuthScope[];
  resource: string;
  expires_at: Date; // TTL index
  /** Refresh tokens only: set when exchanged. A later use is a replay. */
  rotated_at: Date | null;
  /** Set on every token of a grant when the grant is withdrawn. */
  revoked_at?: Date;
};

async function codes() {
  return (await getDb()).collection<CodeDoc>("oauth_codes");
}
async function tokens() {
  return (await getDb()).collection<TokenDoc>("oauth_tokens");
}

// ── Authorization request ───────────────────────────────────────────────────

export type AuthorizeParams = Record<string, string | undefined>;

export type AuthorizeRequest = {
  client: OAuthClient;
  redirectUri: string;
  scope: OAuthScope[];
  resource: string;
  state: string | undefined;
  codeChallenge: string;
};

export type AuthorizeValidation =
  | { ok: true; request: AuthorizeRequest }
  /** The client or redirect URI cannot be trusted: tell the user, never redirect. */
  | { ok: false; redirect: null; message: string }
  /** The request is wrong in a way the client should hear about. */
  | { ok: false; redirect: string; message: string };

/** `redirect_uri` plus the given query parameters and `iss` (RFC 9207). */
export function buildRedirect(redirectUri: string, issuer: string, params: Record<string, string | undefined>): string {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v);
  url.searchParams.set("iss", issuer);
  return url.toString();
}

const CODE_CHALLENGE = /^[A-Za-z0-9_-]{43}$/; // base64url of a SHA-256 digest

export async function validateAuthorizeRequest(params: AuthorizeParams, issuer: string): Promise<AuthorizeValidation> {
  const client = await getClient(params.client_id);
  if (!client) {
    return { ok: false, redirect: null, message: "This app is not recognized. Its client ID is unknown, or its metadata could not be read." };
  }
  const redirectUri = params.redirect_uri;
  if (!redirectUri || !redirectUriMatches(client.redirect_uris, redirectUri)) {
    return { ok: false, redirect: null, message: "This app asked to send you to an address it has not registered." };
  }

  const fail = (error: string, message: string): AuthorizeValidation => ({
    ok: false,
    message,
    redirect: buildRedirect(redirectUri, issuer, { error, error_description: message, state: params.state }),
  });

  if (params.response_type !== "code") return fail("unsupported_response_type", "Only response_type=code is supported.");
  // PKCE is required and must be S256. A request with no challenge, or with
  // the "plain" method, is refused rather than downgraded.
  if (params.code_challenge_method !== "S256" || !params.code_challenge || !CODE_CHALLENGE.test(params.code_challenge)) {
    return fail("invalid_request", "PKCE with code_challenge_method=S256 is required.");
  }

  const requested = (params.scope ?? "").split(/\s+/).filter(Boolean);
  const unknown = requested.find((s) => !(OAUTH_SCOPES as readonly string[]).includes(s));
  if (unknown) return fail("invalid_scope", `Unknown scope: ${unknown.slice(0, 50)}`);
  const scope = OAUTH_SCOPES.filter((s) => requested.length === 0 || requested.includes(s));

  const resource = oauthResource();
  if (params.resource !== undefined && normalizeResource(params.resource) !== resource) {
    return fail("invalid_target", "Tokens are only issued for the Booklet MCP server.");
  }

  return { ok: true, request: { client, redirectUri, scope, resource, state: params.state, codeChallenge: params.code_challenge } };
}

/** Records the user's consent and returns the one-time code to hand the client. */
export async function issueAuthorizationCode(req: AuthorizeRequest, userId: string): Promise<string> {
  const code = `bkac_${createId(40)}`;
  const now = Date.now();
  await (await codes()).insertOne({
    _id: await hashApiKey(code),
    grant_id: createId(20),
    client_id: req.client.client_id,
    user_id: userId,
    redirect_uri: req.redirectUri,
    code_challenge: req.codeChallenge,
    scope: req.scope,
    resource: req.resource,
    expires_at: new Date(now + CODE_TTL_S * 1000),
    used_at: null,
    purge_at: new Date(now + CODE_RETENTION_S * 1000),
  });
  return code;
}

// ── Token endpoint ──────────────────────────────────────────────────────────

/** An error the token endpoint reports as `{ error, error_description }` (RFC 6749 section 5.2). */
export class OAuthTokenError extends Error {
  constructor(
    public code: "invalid_request" | "invalid_grant" | "invalid_client" | "unsupported_grant_type" | "invalid_scope" | "invalid_target",
    message: string,
  ) {
    super(message);
  }
}

export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
};

async function issueTokens(grant: Pick<TokenDoc, "grant_id" | "client_id" | "user_id" | "scope" | "resource">): Promise<TokenResponse> {
  const access = `bkat_${createId(40)}`;
  const refresh = `bkrt_${createId(40)}`;
  const now = Date.now();
  const col = await tokens();
  const ids = [await hashApiKey(access), await hashApiKey(refresh)];
  await col.insertMany([
    { ...grant, _id: ids[0], kind: "access", expires_at: new Date(now + ACCESS_TOKEN_TTL_S * 1000), rotated_at: null },
    { ...grant, _id: ids[1], kind: "refresh", expires_at: new Date(now + REFRESH_TOKEN_TTL_S * 1000), rotated_at: null },
  ]);
  // The grant may have been withdrawn while this request was running (a
  // replay detected by a parallel request). Its other tokens carry the
  // mark; tokens issued after it must not outlive it.
  if (await col.findOne({ grant_id: grant.grant_id, revoked_at: { $exists: true } })) {
    await col.updateMany({ _id: { $in: ids } }, { $set: { revoked_at: new Date() } });
    throw new OAuthTokenError("invalid_grant", "This authorization was withdrawn. Sign in again.");
  }
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TOKEN_TTL_S, refresh_token: refresh, scope: grant.scope.join(" ") };
}

/**
 * Withdraws a grant. Its tokens are marked, not deleted: the marks are how
 * a request that is issuing tokens for the same grant at this moment finds
 * out (see issueTokens), and how a later replay is still recognized. The
 * TTL index removes the rows when they would have expired anyway.
 */
async function revokeGrant(grantId: string): Promise<void> {
  await (await tokens()).updateMany({ grant_id: grantId }, { $set: { revoked_at: new Date() } });
}

// A refresh token may be used again for this long after its first use. A
// client whose first response was lost, or which refreshed from two workers
// at once, gets a second pair instead of losing the grant. After the window
// a second use is treated as theft.
const REFRESH_REUSE_GRACE_MS = 10_000;

const CODE_VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/;

function pkceMatches(verifier: string, challenge: string): boolean {
  const computed = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  const expected = Buffer.from(challenge);
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}

export async function exchangeAuthorizationCode(form: {
  code?: string;
  client_id?: string;
  redirect_uri?: string;
  code_verifier?: string;
  resource?: string;
}): Promise<TokenResponse> {
  const { code, client_id, redirect_uri, code_verifier } = form;
  if (!code || !client_id || !redirect_uri || !code_verifier) {
    throw new OAuthTokenError("invalid_request", "code, client_id, redirect_uri and code_verifier are required.");
  }

  // Claim the code first, atomically: of any number of simultaneous
  // requests with the same code, exactly one gets the document.
  const _id = await hashApiKey(code);
  const col = await codes();
  const doc = await col.findOneAndUpdate({ _id, used_at: null }, { $set: { used_at: new Date() } });
  if (!doc) {
    // A code presented twice means it leaked. Whoever used it first may be
    // the attacker, so everything issued from it is withdrawn.
    const replayed = await col.findOne({ _id });
    if (replayed) await revokeGrant(replayed.grant_id);
    throw new OAuthTokenError("invalid_grant", "The authorization code is invalid or was already used.");
  }

  // From here every failure leaves the code spent: a wrong guess at the
  // verifier cannot be retried against the same code.
  if (doc.expires_at.getTime() <= Date.now()) throw new OAuthTokenError("invalid_grant", "The authorization code has expired.");
  if (doc.client_id !== client_id) throw new OAuthTokenError("invalid_grant", "The authorization code was issued to another client.");
  if (doc.redirect_uri !== redirect_uri) throw new OAuthTokenError("invalid_grant", "redirect_uri does not match the authorization request.");
  if (form.resource !== undefined && normalizeResource(form.resource) !== doc.resource) {
    throw new OAuthTokenError("invalid_target", "resource does not match the authorization request.");
  }
  if (!CODE_VERIFIER.test(code_verifier) || !pkceMatches(code_verifier, doc.code_challenge)) {
    throw new OAuthTokenError("invalid_grant", "code_verifier does not match the code_challenge.");
  }

  return issueTokens(doc);
}

export async function exchangeRefreshToken(form: { refresh_token?: string; client_id?: string; scope?: string }): Promise<TokenResponse> {
  const { refresh_token, client_id } = form;
  if (!refresh_token || !client_id) throw new OAuthTokenError("invalid_request", "refresh_token and client_id are required.");

  const _id = await hashApiKey(refresh_token);
  const col = await tokens();
  const now = new Date();
  const doc = await col.findOneAndUpdate(
    {
      _id,
      kind: "refresh",
      revoked_at: { $exists: false },
      $or: [{ rotated_at: null }, { rotated_at: { $gt: new Date(now.getTime() - REFRESH_REUSE_GRACE_MS) } }],
    },
    // Keep the time of the first use, so the grace window does not slide.
    [{ $set: { rotated_at: { $ifNull: ["$rotated_at", now] } } }],
  );
  if (!doc) {
    // A refresh token used again after the grace window: it was copied.
    // Withdraw the grant.
    const replayed = await col.findOne({ _id, kind: "refresh" });
    if (replayed) await revokeGrant(replayed.grant_id);
    throw new OAuthTokenError("invalid_grant", "The refresh token is invalid or was already used.");
  }
  if (doc.expires_at.getTime() <= Date.now()) throw new OAuthTokenError("invalid_grant", "The refresh token has expired.");
  if (doc.client_id !== client_id) {
    await revokeGrant(doc.grant_id);
    throw new OAuthTokenError("invalid_grant", "The refresh token was issued to another client.");
  }

  // A client may ask for fewer scopes on refresh, never more.
  let scope = doc.scope;
  if (form.scope) {
    const requested = form.scope.split(/\s+/).filter(Boolean);
    if (requested.some((s) => !(doc.scope as string[]).includes(s))) {
      throw new OAuthTokenError("invalid_scope", "A refresh cannot add scopes.");
    }
    scope = doc.scope.filter((s) => requested.includes(s));
  }

  return issueTokens({ grant_id: doc.grant_id, client_id: doc.client_id, user_id: doc.user_id, scope, resource: doc.resource });
}

/** RFC 7009: revokes the grant a token (access or refresh) belongs to. Unknown tokens are ignored. */
export async function revokeToken(token: string): Promise<void> {
  const doc = await (await tokens()).findOne({ _id: await hashApiKey(token) });
  if (doc) await revokeGrant(doc.grant_id);
}


/** Withdraws every grant a user has given. For password changes and account deletion. */
export async function revokeAllForUser(userId: string): Promise<void> {
  await (await tokens()).deleteMany({ user_id: userId });
  await (await codes()).deleteMany({ user_id: userId });
}

// ── Token use ───────────────────────────────────────────────────────────────

export type AccessTokenInfo = { userId: string; clientId: string; scope: OAuthScope[]; resource: string; expiresAt: Date };

/** The live access token behind `raw`, or null. Refresh tokens are never accepted here. */
export async function verifyAccessToken(raw: string): Promise<AccessTokenInfo | null> {
  const doc = await (await tokens()).findOne({ _id: await hashApiKey(raw), kind: "access" });
  // The TTL index removes expired tokens within about a minute; this check
  // covers that minute.
  if (!doc || doc.revoked_at || doc.expires_at.getTime() <= Date.now()) return null;
  // Tokens are only ever issued for oauthResource(). If that setting
  // changes, tokens for the old value stop working.
  if (doc.resource !== oauthResource()) return null;
  return { userId: doc.user_id, clientId: doc.client_id, scope: doc.scope, resource: doc.resource, expiresAt: doc.expires_at };
}
