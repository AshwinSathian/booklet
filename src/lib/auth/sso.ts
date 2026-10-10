/**
 * "Continue with GitHub / Google": Booklet as an OAuth client. (Booklet as
 * an OAuth *server*, for MCP clients, is src/lib/oauth.)
 *
 * A provider exists only when both its client ID and secret are set. With
 * neither configured there are no buttons and the routes answer 404.
 */

import { SSO_PROVIDERS, type SsoProvider } from "@/lib/db/types";

export type SsoProfile = {
  providerUserId: string;
  /** Lower-cased, and verified by the provider. A profile without one is refused. */
  email: string;
};

type ProviderConfig = {
  id: SsoProvider;
  label: string;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  fetchProfile: (accessToken: string) => Promise<SsoProfile | null>;
};

async function getJson(url: string, accessToken: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json", "user-agent": "Booklet" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

// SSO_GITHUB_BASE_URL and SSO_GOOGLE_BASE_URL point a provider at a stub.
// They exist for tests/e2e/accounts.spec.ts and are not a way to use
// GitHub Enterprise Server, whose API lives under a different path.
function github(): ProviderConfig | null {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const base = process.env.SSO_GITHUB_BASE_URL;
  const web = base ?? "https://github.com";
  const api = base ?? "https://api.github.com";
  return {
    id: "github",
    label: "GitHub",
    clientId,
    clientSecret,
    authorizeUrl: `${web}/login/oauth/authorize`,
    tokenUrl: `${web}/login/oauth/access_token`,
    scope: "read:user user:email",
    async fetchProfile(token) {
      const user = (await getJson(`${api}/user`, token)) as { id?: unknown };
      // The profile's own `email` is whatever the user chose to show and is
      // not marked verified. The emails endpoint says which one is.
      const emails = (await getJson(`${api}/user/emails`, token)) as Array<{ email?: unknown; primary?: unknown; verified?: unknown }>;
      const primary = Array.isArray(emails) ? emails.find((e) => e.primary === true && e.verified === true) : undefined;
      if (typeof user.id !== "number" || typeof primary?.email !== "string") return null;
      return { providerUserId: String(user.id), email: primary.email.toLowerCase() };
    },
  };
}

function google(): ProviderConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const base = process.env.SSO_GOOGLE_BASE_URL;
  return {
    id: "google",
    label: "Google",
    clientId,
    clientSecret,
    authorizeUrl: base ? `${base}/authorize` : "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: base ? `${base}/token` : "https://oauth2.googleapis.com/token",
    scope: "openid email",
    async fetchProfile(token) {
      const info = (await getJson(base ? `${base}/userinfo` : "https://openidconnect.googleapis.com/v1/userinfo", token)) as {
        sub?: unknown;
        email?: unknown;
        email_verified?: unknown;
      };
      if (typeof info.sub !== "string" || typeof info.email !== "string" || info.email_verified !== true) return null;
      return { providerUserId: info.sub, email: info.email.toLowerCase() };
    },
  };
}

export function getSsoProvider(id: string): ProviderConfig | null {
  if (id === "github") return github();
  if (id === "google") return google();
  return null;
}

/** The configured providers, for rendering buttons. Never includes a secret. */
export function enabledSsoProviders(): Array<{ id: SsoProvider; label: string }> {
  return SSO_PROVIDERS.flatMap((id) => {
    const p = getSsoProvider(id);
    return p ? [{ id: p.id, label: p.label }] : [];
  });
}

export function ssoAuthorizeUrl(p: ProviderConfig, redirectUri: string, state: string, codeChallenge: string): string {
  const url = new URL(p.authorizeUrl);
  url.search = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: p.scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

/** Trades the authorization code for the user's profile. Null when the provider reports no verified email. */
export async function ssoExchange(p: ProviderConfig, code: string, redirectUri: string, codeVerifier: string): Promise<SsoProfile | null> {
  const res = await fetch(p.tokenUrl, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: p.clientId,
      client_secret: p.clientSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => null)) as { access_token?: unknown } | null;
  if (!res.ok || typeof body?.access_token !== "string") throw new Error(`${p.id} token endpoint answered ${res.status}`);
  return p.fetchProfile(body.access_token);
}
