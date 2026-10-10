import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { useTestEnv } from "./helpers/pages";
import { sessionCookieFor, withRequestScope } from "./helpers/request-scope";
import { getDb } from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/db/index-specs.mjs";
import { hashApiKey } from "@/lib/api-key";
import { clearClientCache, getClient, isAllowedRedirectUri, metadataFetcher, redirectUriMatches } from "@/lib/oauth/clients";
import { oauthResource, validateAuthorizeRequest } from "@/lib/oauth/server";
import { GET as metadata } from "@/app/.well-known/oauth-authorization-server/route";
import { POST as register } from "@/app/api/oauth/register/route";
import { POST as authorize } from "@/app/api/oauth/authorize/route";
import { POST as token } from "@/app/api/oauth/token/route";
import { POST as revoke } from "@/app/api/oauth/revoke/route";
import { GET as tokeninfo } from "@/app/api/oauth/tokeninfo/route";
import { GET as listPages } from "@/app/api/v1/pages/route";
import { POST as publish } from "@/app/api/v1/publish/route";

// The OAuth authorization server: the happy path a Claude.ai connector
// takes, and each way of abusing it that must be refused.

const ORIGIN = "http://localhost";
const CLAUDE_CALLBACK = "https://claude.ai/api/mcp/auth_callback";
const userIds: string[] = [];
const clientIds: string[] = [];
let ipCounter = 0;

/** A fresh address per request, so the per-IP rate limits never interfere. */
const ip = () => ({ "x-forwarded-for": `198.51.100.${++ipCounter % 250}`, "cf-connecting-ip": `198.51.100.${ipCounter % 250}` });

function pkce() {
  const verifier = `verifier-${crypto.randomUUID()}-${crypto.randomUUID()}`.slice(0, 64);
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

async function newUser() {
  const userId = `testuser${crypto.randomUUID()}`;
  userIds.push(userId);
  return { userId, cookie: await sessionCookieFor(userId) };
}

async function newClient(redirect_uris = [CLAUDE_CALLBACK], client_name = "Claude") {
  const res = await register(
    new Request(`${ORIGIN}/api/oauth/register`, { method: "POST", headers: ip(), body: JSON.stringify({ redirect_uris, client_name }) }),
  );
  const body = await res.json();
  if (body.client_id) clientIds.push(body.client_id);
  return { res, body };
}

type Params = Record<string, string | undefined>;

function authParams(clientId: string, challenge: string, over: Params = {}): Params {
  return {
    response_type: "code",
    client_id: clientId,
    redirect_uri: CLAUDE_CALLBACK,
    code_challenge: challenge,
    code_challenge_method: "S256",
    scope: "pages:read pages:write",
    state: "st4te",
    resource: oauthResource(),
    ...over,
  };
}

/** Clicks Allow (or Cancel) on the consent screen as `cookie`'s user. */
function decide(cookie: string | null, params: Params, decision = "approve", headers: Record<string, string> = { origin: ORIGIN }) {
  const req = new Request(`${ORIGIN}/api/oauth/authorize`, {
    method: "POST",
    headers: { host: "localhost", "content-type": "application/json", ...(cookie ? { cookie } : {}), ...headers },
    body: JSON.stringify({ params, decision }),
  });
  return withRequestScope(req, () => authorize(req));
}

function tokenRequest(form: Record<string, string>) {
  return token(
    new Request(`${ORIGIN}/api/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", ...ip() },
      body: new URLSearchParams(form),
    }),
  );
}

/** Runs consent for a new user and returns the code and everything needed to redeem it. */
async function getCode(over: Params = {}) {
  const user = await newUser();
  const { body: client } = await newClient();
  const { verifier, challenge } = pkce();
  const res = await decide(user.cookie, authParams(client.client_id, challenge, over));
  const redirect = new URL((await res.json()).redirect);
  return { user, clientId: client.client_id as string, verifier, redirect, code: redirect.searchParams.get("code")! };
}

const redeem = (g: { code: string; clientId: string; verifier: string }, over: Record<string, string> = {}) =>
  tokenRequest({ grant_type: "authorization_code", code: g.code, client_id: g.clientId, redirect_uri: CLAUDE_CALLBACK, code_verifier: g.verifier, ...over });

const api = (accessToken: string) => ({ headers: { Authorization: `Bearer ${accessToken}` } });

test.beforeAll(async () => {
  useTestEnv();
  await ensureIndexes(await getDb());
});

test.afterAll(async () => {
  const db = await getDb();
  await db.collection("oauth_tokens").deleteMany({ user_id: { $in: userIds } });
  await db.collection("oauth_codes").deleteMany({ user_id: { $in: userIds } });
  await db.collection("oauth_clients").deleteMany({ _id: { $in: clientIds } } as never);
  await db.collection("sessions").deleteMany({ user_id: { $in: userIds } });
  await db.collection("pages").deleteMany({ user_id: { $in: userIds } });
});

test("metadata advertises PKCE S256, public clients, metadata documents and iss", async () => {
  const doc = await metadata(new Request(`${ORIGIN}/.well-known/oauth-authorization-server`)).json();
  expect(doc).toMatchObject({
    issuer: ORIGIN,
    authorization_endpoint: `${ORIGIN}/oauth/authorize`,
    token_endpoint: `${ORIGIN}/api/oauth/token`,
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
    scopes_supported: ["pages:read", "pages:write"],
  });
});

test("the whole flow: consent, code, tokens, API call, refresh, revoke", async () => {
  const g = await getCode();
  // The code comes back on the registered redirect URI with state and iss.
  expect(`${g.redirect.origin}${g.redirect.pathname}`).toBe(CLAUDE_CALLBACK);
  expect(g.redirect.searchParams.get("state")).toBe("st4te");
  expect(g.redirect.searchParams.get("iss")).toBe(ORIGIN);

  const res = await redeem(g);
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  const tokens = await res.json();
  expect(tokens).toMatchObject({ token_type: "Bearer", expires_in: 3600, scope: "pages:read pages:write" });
  expect(tokens.access_token).toMatch(/^bkat_[0-9A-Za-z]{40}$/);

  // Only hashes are stored.
  const stored = await (await getDb()).collection("oauth_tokens").find({ user_id: g.user.userId }).toArray();
  expect(stored).toHaveLength(2);
  expect(JSON.stringify(stored)).not.toContain(tokens.access_token);
  expect(JSON.stringify(stored)).not.toContain(tokens.refresh_token);

  // The MCP server's view of the token, and the API accepting it as the user.
  const info = await tokeninfo(new Request(`${ORIGIN}/api/oauth/tokeninfo`, { headers: { ...api(tokens.access_token).headers, ...ip() } }));
  expect(await info.json()).toMatchObject({ active: true, client_id: g.clientId, scope: "pages:read pages:write", resource: oauthResource() });
  const published = await publish(new Request(`${ORIGIN}/api/v1/publish`, { method: "POST", body: JSON.stringify({ raw: "# Via OAuth" }), ...api(tokens.access_token) }));
  expect(published.status).toBe(201);
  const list = await (await listPages(new Request(`${ORIGIN}/api/v1/pages`, api(tokens.access_token)))).json();
  expect(list.pages.map((p: { id: string }) => p.id)).toEqual([(await published.json()).id]);

  // A refresh token is not a credential for the API.
  expect((await listPages(new Request(`${ORIGIN}/api/v1/pages`, api(tokens.refresh_token)))).status).toBe(401);

  // Refresh rotates: new pair, and the old refresh token is spent.
  const refreshed = await tokenRequest({ grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: g.clientId });
  expect(refreshed.status).toBe(200);
  const next = await refreshed.json();
  expect(next.refresh_token).not.toBe(tokens.refresh_token);
  expect((await listPages(new Request(`${ORIGIN}/api/v1/pages`, api(next.access_token)))).status).toBe(200);

  // Revoking ends the grant: every token from this consent stops working.
  await revoke(new Request(`${ORIGIN}/api/oauth/revoke`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", ...ip() }, body: new URLSearchParams({ token: next.refresh_token }) }));
  expect((await listPages(new Request(`${ORIGIN}/api/v1/pages`, api(next.access_token)))).status).toBe(401);
  expect((await listPages(new Request(`${ORIGIN}/api/v1/pages`, api(tokens.access_token)))).status).toBe(401);
});

test("scopes are enforced: a pages:read token cannot publish", async () => {
  const g = await getCode({ scope: "pages:read" });
  const { access_token, scope } = await (await redeem(g)).json();
  expect(scope).toBe("pages:read");
  expect((await listPages(new Request(`${ORIGIN}/api/v1/pages`, api(access_token)))).status).toBe(200);
  const res = await publish(new Request(`${ORIGIN}/api/v1/publish`, { method: "POST", body: JSON.stringify({ raw: "# No" }), ...api(access_token) }));
  expect(res.status).toBe(403);
  expect(res.headers.get("www-authenticate")).toContain("insufficient_scope");
  // And a refresh cannot widen it.
  const narrow = await (await redeem(await getCode({ scope: "pages:read" }))).json();
  const widened = await tokenRequest({ grant_type: "refresh_token", refresh_token: narrow.refresh_token, client_id: clientIds[clientIds.length - 1], scope: "pages:read pages:write" });
  expect((await widened.json()).error).toBe("invalid_scope");
});

test.describe("PKCE downgrade", () => {
  test("a request without S256 is refused before any consent", async () => {
    const user = await newUser();
    const { body: client } = await newClient();
    const { verifier, challenge } = pkce();
    for (const over of [
      { code_challenge_method: "plain", code_challenge: verifier },
      { code_challenge_method: undefined },
      { code_challenge: undefined, code_challenge_method: undefined },
      { code_challenge: "tooshort" },
    ]) {
      const res = await decide(user.cookie, authParams(client.client_id, challenge, over));
      const redirect = new URL((await res.json()).redirect);
      expect(redirect.searchParams.get("error")).toBe("invalid_request");
      expect(redirect.searchParams.get("code")).toBeNull();
      expect(redirect.searchParams.get("state")).toBe("st4te");
    }
    expect(await (await getDb()).collection("oauth_codes").countDocuments({ user_id: user.userId })).toBe(0);
  });

  test("the token endpoint needs the right verifier, and a wrong one burns the code", async () => {
    const g = await getCode();
    const wrong = await redeem(g, { code_verifier: pkce().verifier });
    expect(wrong.status).toBe(400);
    expect((await wrong.json()).error).toBe("invalid_grant");
    // The real verifier no longer works either: no second guess.
    expect((await redeem(g)).status).toBe(400);

    const missing = await getCode();
    const res = await tokenRequest({ grant_type: "authorization_code", code: missing.code, client_id: missing.clientId, redirect_uri: CLAUDE_CALLBACK });
    expect((await res.json()).error).toBe("invalid_request");
  });
});

test.describe("redirect URI mismatch", () => {
  test("an unregistered redirect_uri is never redirected to, and no code is issued", async () => {
    const user = await newUser();
    const { body: client } = await newClient();
    for (const redirect_uri of ["https://evil.example/callback", `${CLAUDE_CALLBACK}/../x`, `${CLAUDE_CALLBACK}?a=1`, "https://claude.ai.evil.example/api/mcp/auth_callback", undefined]) {
      const res = await decide(user.cookie, authParams(client.client_id, pkce().challenge, { redirect_uri }));
      expect(res.status).toBe(400);
      expect((await res.json()).redirect).toBeUndefined();
    }
    expect(await (await getDb()).collection("oauth_codes").countDocuments({ user_id: user.userId })).toBe(0);
  });

  test("the token request must repeat the same redirect_uri, and the same client", async () => {
    const a = await getCode();
    expect((await (await redeem(a, { redirect_uri: "https://evil.example/callback" })).json()).error).toBe("invalid_grant");

    const b = await getCode();
    const { body: other } = await newClient();
    expect((await (await redeem(b, { client_id: other.client_id })).json()).error).toBe("invalid_grant");
  });

  test("an unknown client is not redirected to either", async () => {
    const user = await newUser();
    const res = await decide(user.cookie, authParams("bkc_" + "x".repeat(24), pkce().challenge));
    expect(res.status).toBe(400);
  });
});

test("code replay: the second use fails and withdraws the tokens the first use got", async () => {
  const g = await getCode();
  const first = await (await redeem(g)).json();
  expect((await listPages(new Request(`${ORIGIN}/api/v1/pages`, api(first.access_token)))).status).toBe(200);

  const second = await redeem(g);
  expect(second.status).toBe(400);
  expect((await second.json()).error).toBe("invalid_grant");
  expect((await listPages(new Request(`${ORIGIN}/api/v1/pages`, api(first.access_token)))).status).toBe(401);
  expect((await tokenRequest({ grant_type: "refresh_token", refresh_token: first.refresh_token, client_id: g.clientId })).status).toBe(400);

  // Simultaneous redemptions: exactly one wins.
  const race = await getCode();
  const results = await Promise.all([redeem(race), redeem(race), redeem(race)]);
  expect(results.filter((r) => r.status === 200)).toHaveLength(1);
});

test("refresh token reuse: tolerated for a few seconds, then it withdraws the grant", async () => {
  const g = await getCode();
  const first = await (await redeem(g)).json();
  const refresh = () => tokenRequest({ grant_type: "refresh_token", refresh_token: first.refresh_token, client_id: g.clientId });

  // A client whose first response was lost retries at once, or two workers
  // refresh together: each gets a working pair and the grant survives.
  const [a, b] = await Promise.all([refresh(), refresh()]);
  expect([a.status, b.status]).toEqual([200, 200]);
  const second = await a.json();
  expect((await listPages(new Request(`${ORIGIN}/api/v1/pages`, api(second.access_token)))).status).toBe(200);

  // The same token again after the grace window is a stolen token.
  await (await getDb())
    .collection("oauth_tokens")
    .updateOne({ _id: await hashApiKey(first.refresh_token) } as never, { $set: { rotated_at: new Date(Date.now() - 60_000) } });
  expect((await refresh()).status).toBe(400);
  expect((await listPages(new Request(`${ORIGIN}/api/v1/pages`, api(second.access_token)))).status).toBe(401);

  // The grant stays withdrawn: its other refresh tokens are dead too, and
  // the marked rows are still there to say why.
  const again = await tokenRequest({ grant_type: "refresh_token", refresh_token: second.refresh_token, client_id: g.clientId });
  expect(again.status).toBe(400);
  const rows = await (await getDb()).collection("oauth_tokens").find({ user_id: g.user.userId }).toArray();
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every((r) => r.revoked_at instanceof Date)).toBe(true);
});

test.describe("a token for another resource", () => {
  test("is never issued: the authorization request is refused with invalid_target", async () => {
    const user = await newUser();
    const { body: client } = await newClient();
    const res = await decide(user.cookie, authParams(client.client_id, pkce().challenge, { resource: "https://other.example/mcp" }));
    const redirect = new URL((await res.json()).redirect);
    expect(redirect.searchParams.get("error")).toBe("invalid_target");
    expect(redirect.searchParams.get("code")).toBeNull();

    const g = await getCode();
    expect((await (await redeem(g, { resource: "https://other.example/mcp" })).json()).error).toBe("invalid_target");
  });

  test("is rejected by the API even if one exists in the database", async () => {
    const user = await newUser();
    const raw = "bkat_" + "r".repeat(20) + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
    await (await getDb()).collection("oauth_tokens").insertOne({
      _id: await hashApiKey(raw),
      kind: "access",
      grant_id: "g",
      client_id: "c",
      user_id: user.userId,
      scope: ["pages:read", "pages:write"],
      resource: "https://other.example/mcp",
      expires_at: new Date(Date.now() + 600_000),
      rotated_at: null,
    } as never);
    expect((await listPages(new Request(`${ORIGIN}/api/v1/pages`, api(raw)))).status).toBe(401);
    const info = await tokeninfo(new Request(`${ORIGIN}/api/oauth/tokeninfo`, { headers: { ...api(raw).headers, ...ip() } }));
    expect(info.status).toBe(401);
  });
});

test("an expired access token or code is refused", async () => {
  const g = await getCode();
  const { access_token } = await (await redeem(g)).json();
  await (await getDb()).collection("oauth_tokens").updateMany({ user_id: g.user.userId }, { $set: { expires_at: new Date(Date.now() - 1000) } });
  expect((await listPages(new Request(`${ORIGIN}/api/v1/pages`, api(access_token)))).status).toBe(401);

  const late = await getCode();
  await (await getDb()).collection("oauth_codes").updateMany({ user_id: late.user.userId }, { $set: { expires_at: new Date(Date.now() - 1000) } });
  expect((await (await redeem(late)).json()).error).toBe("invalid_grant");
});

test.describe("consent cannot be forged", () => {
  test("no session, a cross-site origin or a missing Origin grants nothing", async () => {
    const user = await newUser();
    const { body: client } = await newClient();
    const params = authParams(client.client_id, pkce().challenge);

    expect((await decide(null, params)).status).toBe(401);
    expect((await decide(user.cookie, params, "approve", { origin: "https://evil.example" })).status).toBe(403);
    expect((await decide(user.cookie, params, "approve", {})).status).toBe(403);
    expect((await decide(user.cookie, params, "maybe")).status).toBe(400);
    expect(await (await getDb()).collection("oauth_codes").countDocuments({ user_id: user.userId })).toBe(0);
  });

  test("Cancel sends access_denied and no code", async () => {
    const user = await newUser();
    const { body: client } = await newClient();
    const res = await decide(user.cookie, authParams(client.client_id, pkce().challenge), "deny");
    const redirect = new URL((await res.json()).redirect);
    expect(redirect.searchParams.get("error")).toBe("access_denied");
    expect(redirect.searchParams.get("code")).toBeNull();
  });
});

test.describe("clients", () => {
  test("registration accepts Claude's callback and refuses dangerous redirect URIs", async () => {
    const ok = await newClient();
    expect(ok.res.status).toBe(201);
    expect(ok.body).toMatchObject({ redirect_uris: [CLAUDE_CALLBACK], token_endpoint_auth_method: "none" });
    expect(ok.body.client_secret).toBeUndefined();

    for (const bad of [["javascript:alert(1)"], ["data:text/html,x"], ["http://evil.example/cb"], ["https://a.example/cb#frag"], [], ["not a url"]]) {
      expect((await newClient(bad)).res.status, JSON.stringify(bad)).toBe(400);
    }
  });

  test("redirect URI rules", () => {
    expect(isAllowedRedirectUri(CLAUDE_CALLBACK)).toBe(true);
    expect(isAllowedRedirectUri("http://127.0.0.1:3000/callback")).toBe(true);
    expect(isAllowedRedirectUri("cursor://anysphere.cursor-mcp/oauth/callback")).toBe(true);
    expect(isAllowedRedirectUri("http://192.168.1.5/callback")).toBe(false);
    expect(isAllowedRedirectUri("https://user:pw@a.example/cb")).toBe(false);

    // Loopback matches on any port (RFC 8252); nothing else is fuzzy.
    expect(redirectUriMatches(["http://127.0.0.1/callback"], "http://127.0.0.1:51234/callback")).toBe(true);
    expect(redirectUriMatches(["http://127.0.0.1/callback"], "http://127.0.0.1:51234/other")).toBe(false);
    expect(redirectUriMatches(["https://a.example/cb"], "https://a.example:8443/cb")).toBe(false);
    expect(redirectUriMatches(["https://a.example/cb"], "https://a.example/cb/")).toBe(false);
  });

  test("a Client ID Metadata Document is fetched, must name itself, and is used for the redirect check", async () => {
    const real = metadataFetcher.fetch;
    const fetched: string[] = [];
    metadataFetcher.fetch = async (url) => {
      fetched.push(url.href);
      return url.href === "https://client.example/oauth/metadata.json"
        ? { client_id: url.href, client_name: "Example", redirect_uris: [CLAUDE_CALLBACK], source: "metadata" }
        : null;
    };
    try {
      clearClientCache();
      const id = "https://client.example/oauth/metadata.json";
      expect(await getClient(id)).toMatchObject({ client_name: "Example", source: "metadata" });
      await getClient(id);
      expect(fetched).toEqual([id]); // cached

      const ok = await validateAuthorizeRequest(authParams(id, pkce().challenge), ORIGIN);
      expect(ok.ok).toBe(true);
      const bad = await validateAuthorizeRequest(authParams(id, pkce().challenge, { redirect_uri: "https://evil.example/cb" }), ORIGIN);
      expect(bad).toMatchObject({ ok: false, redirect: null });

      // Not fetched at all: plain http, a bare origin, credentials, dot segments, internal names.
      for (const notAllowed of ["http://client.example/m.json", "https://client.example/", "https://u:p@client.example/m.json", "https://client.example/a/../m.json", "https://client.example/m.json#x"]) {
        expect(await getClient(notAllowed), notAllowed).toBeNull();
      }
      expect(fetched).toEqual([id]);
    } finally {
      metadataFetcher.fetch = real;
      clearClientCache();
    }
  });

  test("the real metadata fetch refuses internal addresses", async () => {
    clearClientCache();
    for (const internal of ["https://127.0.0.1/client.json", "https://localhost/client.json", "https://169.254.169.254/latest/meta-data", "https://10.0.0.1/client.json"]) {
      expect(await getClient(internal), internal).toBeNull();
    }
  });
});
