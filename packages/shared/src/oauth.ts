/**
 * OAuth facts shared by the authorization server (the Booklet app) and the
 * resource server (the MCP server), so the two cannot disagree.
 */

export const OAUTH_SCOPES = ["pages:read", "pages:write"] as const;
export type OAuthScope = (typeof OAUTH_SCOPES)[number];

/** Access tokens are `bkat_` plus 40 characters; refresh tokens use `bkrt_`. */
export const ACCESS_TOKEN_PATTERN = /^bkat_[0-9A-Za-z]{40}$/;

/**
 * RFC 8414 authorization server metadata. `issuer` is the app's public
 * origin with no trailing slash.
 */
export function oauthServerMetadata(issuer: string) {
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/api/oauth/token`,
    revocation_endpoint: `${issuer}/api/oauth/revoke`,
    scopes_supported: [...OAUTH_SCOPES],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    // Public clients only: PKCE is the client's proof, there are no secrets.
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
    service_documentation: `${issuer}/mcp-setup`,
  };
}
