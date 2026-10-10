import { OAuthError, OAuthErrorCode, type AuthInfo, type OAuthTokenVerifier } from "@modelcontextprotocol/server";
import { ACCESS_TOKEN_PATTERN, OAUTH_SCOPES } from "booklet-api-client";

// Matches Booklet's key generation (src/lib/api-key.ts in the main app):
// "bklt_" + exactly 40 alphanumeric chars.
const KEY_PATTERN = /^bklt_[0-9A-Za-z]{40}$/;

const invalid = (message: string) => new OAuthError(OAuthErrorCode.InvalidToken, message);

/**
 * Checks the bearer credential on an MCP request. Two kinds are accepted:
 *
 * - An API key. Only its format is checked here; the Booklet API verifies it
 *   on every tool call, as it always has.
 * - An OAuth access token. The app that issued it says whether it is still
 *   valid and which resource it was issued for. The caller (requireBearerAuth
 *   with `expectedResource`) then refuses a token issued for anything but
 *   this server.
 */
export function createTokenVerifier(apiBase: string, resource: URL): OAuthTokenVerifier {
  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      if (KEY_PATTERN.test(token)) {
        return {
          token,
          clientId: "api-key",
          scopes: [...OAUTH_SCOPES],
          // An API key does not expire; the bearer helpers require a value.
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
          resource,
        };
      }
      if (!ACCESS_TOKEN_PATTERN.test(token)) throw invalid("Unrecognized credential");

      const res = await fetch(`${apiBase}/api/oauth/tokeninfo`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      // 401 is the app saying "not a live token". Anything else is an outage
      // and must not be reported to the client as a bad token.
      if (res.status === 401) throw invalid("Token is expired or revoked");
      if (!res.ok) throw new Error(`tokeninfo returned HTTP ${res.status}`);
      const info = (await res.json()) as { client_id: string; scope: string; exp: number; resource: string };
      return {
        token,
        clientId: info.client_id,
        scopes: info.scope.split(" ").filter(Boolean),
        expiresAt: info.exp,
        resource: new URL(info.resource),
      };
    },
  };
}
