#!/usr/bin/env node
// Manual, opt-in production verification for the CLI login flow and the MCP
// server — NOT part of the default test suite, run explicitly after a
// deploy that touches src/app/cli-auth, packages/cli, or mcp-server/.
//
// Drives the *real* `booklet login` browser flow end-to-end: signs up a
// throwaway account via the real signup API, feeds its session cookie
// through /cli-auth exactly as a browser would (including following the
// 307 redirect to the CLI's local loopback callback server), then runs
// real CLI commands (pages list/publish/delete, whoami, logout) and real
// MCP JSON-RPC tool calls (initialize, tools/list, publish_page,
// list_pages, get_page, update_page, delete_page) against production, and
// finally the OAuth sign-in a Claude.ai connector performs (discovery,
// client registration, consent, PKCE token exchange, an MCP call with the
// token, revocation).
//
// Everything this creates is tagged with an "e2e-cli-verify-<timestamp>"
// email/title prefix and deleted at the end, scoped precisely to what this
// run created.
//
// Usage:
//   MONGODB_URI="mongodb://127.0.0.1:27017/booklet?directConnection=true" \
//   node scripts/production-verify/cli-mcp-verify.mjs

import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MongoClient } from "mongodb";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const BASE = process.env.TEST_BASE_URL ?? "https://booklet.ashwinsathian.com";
const MCP_BASE = process.env.TEST_MCP_BASE_URL ?? "https://booklet-mcp.ashwinsathian.com";
const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/booklet?directConnection=true";
const CLI_ENTRY = new URL("../../packages/cli/dist/index.js", import.meta.url).pathname;

const RUN_ID = Date.now();
const EMAIL = `e2e-cli-verify-${RUN_ID}@example.test`;
const PASSWORD = "cli-verify-correct-horse-battery";

let passed = 0;
let failed = 0;

function ok(label, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failed++;
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

/** Run the CLI binary with an isolated $HOME so its config.json never touches the real one. */
function runCli(args, { home, env = {}, input } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI_ENTRY, ...args], {
      env: { ...process.env, HOME: home, NO_COLOR: "1", PATH: "", ...env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function main() {
  console.log(`Booklet CLI + MCP production verification — run ${RUN_ID}`);
  console.log(`  App: ${BASE}`);
  console.log(`  MCP: ${MCP_BASE}`);

  const mongo = new MongoClient(MONGODB_URI);
  await mongo.connect();
  const db = mongo.db();

  let sessionCookie;
  let userId;

  try {
    // ── 1. Real signup against the live API ──────────────────────────────
    section("Signup");
    const signupRes = await fetch(`${BASE}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: BASE },
      // With Turnstile on, the site lets this token through in place of a solved challenge (src/lib/turnstile.ts).
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, turnstile_token: process.env.TURNSTILE_BYPASS_TOKEN }),
    });
    ok("signup returns 201", signupRes.status === 201, `got ${signupRes.status}: ${await signupRes.clone().text()}`);
    const setCookie = signupRes.headers.get("set-cookie");
    sessionCookie = setCookie?.split(";")[0];
    ok("signup returns a session cookie", Boolean(sessionCookie));

    const userDoc = await db.collection("users").findOne({ email: EMAIL });
    userId = userDoc?._id;
    ok("user record created in Mongo", Boolean(userId));

    // A new account cannot publish or create credentials until its email is
    // confirmed, and this address receives no mail. First check that rule,
    // then confirm the address the way the link would.
    const earlyKey = await fetch(`${BASE}/api/v1/keys`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: sessionCookie, origin: BASE },
      body: JSON.stringify({ label: "too-early" }),
    });
    ok("an unverified account cannot create an API key (403)", earlyKey.status === 403, `got ${earlyKey.status}`);
    await db.collection("users").updateOne({ _id: userId }, { $set: { email_verified_at: new Date().toISOString() } });

    // ── 2. Real `booklet login` browser flow ────────────────────────────
    section("CLI login (browser flow)");
    const home = await mkdtemp(join(tmpdir(), "booklet-cli-verify-"));

    // Spawn with a live stdout listener (rather than runCli's buffer-until-
    // close helper) since we need to read the auth URL while the process is
    // still running and waiting on its local callback server. PATH is
    // stripped so the CLI's fire-and-forget `open <url>` shell-out can't
    // find the `open` binary and pop a real browser tab on this machine —
    // node itself is invoked via process.execPath (absolute), so it needs
    // no PATH lookup to run.
    const child = spawn(process.execPath, [CLI_ENTRY, "login", "--api-url", BASE], {
      env: { ...process.env, HOME: home, NO_COLOR: "1", PATH: "" },
    });
    let liveStdout = "";
    const authUrlPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out waiting for CLI auth URL")), 15000);
      child.stdout.on("data", (d) => {
        liveStdout += d.toString();
        const m = liveStdout.match(/Visit:\s*(\S+)/);
        if (m) {
          clearTimeout(timer);
          resolve(m[1]);
        }
      });
    });
    const authUrl = await authUrlPromise;
    ok("CLI printed an auth URL", Boolean(authUrl), authUrl);

    const parsed = new URL(authUrl);
    const port = parsed.searchParams.get("port");
    const state = parsed.searchParams.get("state");
    ok("auth URL has port + state", Boolean(port && state));

    // ── 3. Simulate the browser: open /cli-auth, then click "Authorize" ──
    // /cli-auth is a confirmation screen: a bare GET must NOT mint a key or
    // redirect (that was the CSRF hole closed on 2026-09-05 — see
    // docs/OPERATIONS.md). The key is only minted by the same-origin POST
    // the page's button sends.
    const cliAuthRes = await fetch(authUrl, {
      headers: { Cookie: sessionCookie },
      redirect: "manual",
    });
    const confirmHtml = cliAuthRes.status === 200 ? await cliAuthRes.text() : "";
    ok("cli-auth renders the confirmation page (200)", cliAuthRes.status === 200, `got ${cliAuthRes.status}`);
    ok("cli-auth page does NOT show 'Something went wrong'", !confirmHtml.includes("Something went wrong"));
    ok(
      "a bare GET does not hand out a key or redirect to the callback",
      !cliAuthRes.headers.get("location") && !/bklt_[A-Za-z0-9]{40}/.test(confirmHtml),
    );

    const authorizeRes = await fetch(`${BASE}/api/auth/cli-authorize`, {
      method: "POST",
      headers: { Cookie: sessionCookie, Origin: BASE, "Content-Type": "application/json" },
      body: JSON.stringify({ port, state }),
    });
    const authorizeBody = await authorizeRes.json().catch(() => ({}));
    ok("POST /api/auth/cli-authorize returns 200", authorizeRes.status === 200, `got ${authorizeRes.status}`);
    const location = typeof authorizeBody.callbackUrl === "string" ? authorizeBody.callbackUrl : null;
    ok(
      "callback URL is the CLI's loopback callback server",
      Boolean(location && location.startsWith(`http://127.0.0.1:${port}/callback`)),
      location ? "(callback URL withheld: it carries the key)" : "(no callbackUrl in response)",
    );

    const crossOrigin = await fetch(`${BASE}/api/auth/cli-authorize`, {
      method: "POST",
      headers: { Cookie: sessionCookie, Origin: "https://evil.example", "Content-Type": "application/json" },
      body: JSON.stringify({ port, state }),
    });
    ok("cross-origin authorize is rejected (403)", crossOrigin.status === 403, `got ${crossOrigin.status}`);

    // ── 4. Browser navigates to 127.0.0.1:port/callback ─────────────────
    if (location) {
      const callbackRes = await fetch(location);
      ok("CLI's local callback server accepted the callback", callbackRes.status === 200);
    } else {
      // Without a callback the CLI would sit until its own 5-minute timeout.
      child.kill();
    }

    const { code, stdout, stderr } = await new Promise((resolve) => {
      let out = liveStdout;
      let err = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (err += d));
      child.on("close", (c) => resolve({ code: c, stdout: out, stderr: err }));
    });
    ok("CLI process exited 0", code === 0, `stderr: ${stderr}`);
    ok("CLI printed 'Signed in'", stdout.includes("Signed in"), stdout);
    ok("CLI reported 0 pages for a fresh account", /You have 0 pages/.test(stdout), stdout);

    const config = JSON.parse(await readFile(join(home, ".booklet", "config.json"), "utf8"));
    const apiKey = config.apiKey;
    ok("CLI saved an API key with the bklt_ prefix", /^bklt_[0-9A-Za-z]{40}$/.test(apiKey ?? ""));

    // ── 5. `booklet whoami` ──────────────────────────────────────────────
    section("CLI commands");
    const whoami = await runCli(["whoami"], { home });
    ok("whoami exits 0", whoami.code === 0);
    ok("whoami shows the configured base URL", whoami.stdout.includes(BASE));

    // ── 6. `booklet pages list` (empty) ─────────────────────────────────
    const listEmpty = await runCli(["pages", "list", "--json"], { home });
    ok("pages list exits 0", listEmpty.code === 0);
    let emptyPages = [];
    try {
      emptyPages = JSON.parse(listEmpty.stdout);
    } catch {
      /* handled by the ok() below */
    }
    ok("pages list returns an empty array", Array.isArray(emptyPages) && emptyPages.length === 0, listEmpty.stdout);

    // ── 7. `booklet publish` ─────────────────────────────────────────────
    const tmpFile = join(home, "test-doc.md");
    const docTitle = `e2e-cli-verify-${RUN_ID}`;
    await writeFile(tmpFile, `# ${docTitle}\n\nPublished by the CLI production verification script.\n`);
    const publish = await runCli(["publish", tmpFile], { home });
    ok("publish exits 0", publish.code === 0, publish.stderr);
    const urlMatch = publish.stdout.match(/https?:\/\/\S+/);
    ok("publish printed a URL", Boolean(urlMatch), publish.stdout);
    ok(
      "published URL points at production, not localhost",
      Boolean(urlMatch && !urlMatch[0].includes("localhost") && urlMatch[0].startsWith(BASE)),
      urlMatch?.[0],
    );

    if (urlMatch) {
      const pageRes = await fetch(urlMatch[0]);
      ok("published page is actually reachable", pageRes.status === 200, `got ${pageRes.status}`);
    }

    // ── 8. `booklet pages list` (one page) ──────────────────────────────
    const listOne = await runCli(["pages", "list", "--json"], { home });
    let onePages = [];
    try {
      onePages = JSON.parse(listOne.stdout);
    } catch {
      /* handled below */
    }
    ok("pages list now shows 1 page", onePages.length === 1, listOne.stdout);
    const cliPageId = onePages[0]?.id;

    // ── 9. `booklet pages delete` ────────────────────────────────────────
    if (cliPageId) {
      const del = await runCli(["pages", "delete", cliPageId, "-y"], { home });
      ok("pages delete exits 0", del.code === 0, del.stderr);
    }
    const listAfterDelete = await runCli(["pages", "list", "--json"], { home });
    let afterDelete = [];
    try {
      afterDelete = JSON.parse(listAfterDelete.stdout);
    } catch {
      /* handled below */
    }
    ok("pages list is empty again after delete", afterDelete.length === 0, listAfterDelete.stdout);

    // ── 10. `booklet logout` ─────────────────────────────────────────────
    const logout = await runCli(["logout"], { home });
    ok("logout exits 0", logout.code === 0);
    const whoamiAfterLogout = await runCli(["whoami"], { home });
    ok(
      "whoami reports not authenticated after logout",
      whoamiAfterLogout.stdout.includes("Not authenticated"),
      whoamiAfterLogout.stdout,
    );

    await rm(home, { recursive: true, force: true });

    // ── 11. MCP server — JSON-RPC over the public hostname ───────────────
    section("MCP server");
    // The SDK's own client, pinned to the one protocol version the server
    // speaks. One connection per credential.
    const mcpClients = new Map();
    async function mcpClient(token) {
      if (!mcpClients.has(token)) {
        const client = new Client(
          { name: "booklet-production-verify", version: "1.0.0" },
          { versionNegotiation: { mode: { pin: "2026-07-28" } } },
        );
        await client.connect(
          new StreamableHTTPClientTransport(new URL(`${MCP_BASE}/mcp`), {
            requestInit: { headers: { Authorization: `Bearer ${token}` } },
          }),
        );
        mcpClients.set(token, client);
      }
      return mcpClients.get(token);
    }
    /** Same shape the checks below read: `{ status, body: { result } }`. */
    async function mcpCall(method, params, token = apiKey) {
      try {
        const client = await mcpClient(token);
        const result = method === "tools/list" ? await client.listTools() : await client.callTool(params);
        return { status: 200, body: { result } };
      } catch (e) {
        // A refused credential surfaces as an error from the transport.
        const text = `${e?.name ?? ""} ${e?.code ?? ""} ${e?.status ?? ""} ${e?.message ?? e}`;
        return { status: /401|unauthori|invalid_token/i.test(text) ? 401 : 0, body: { error: text } };
      }
    }

    const health = await fetch(`${MCP_BASE}/health`);
    ok("MCP /health returns ok", health.status === 200);

    const negotiated = await mcpClient(apiKey).then((c) => c.getNegotiatedProtocolVersion()).catch((e) => String(e));
    ok("MCP speaks protocol 2026-07-28", negotiated === "2026-07-28", String(negotiated));

    const oldInit = await fetch(`${MCP_BASE}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "old-client", version: "1.0.0" } },
      }),
    });
    const oldInitText = await oldInit.text();
    ok("a 2025-era initialize is refused", !(oldInit.ok && !oldInitText.includes('"error"')), oldInitText.slice(0, 200));

    const toolsList = await mcpCall("tools/list", {});
    const toolNames = (toolsList.body?.result?.tools ?? []).map((t) => t.name);
    ok(
      "MCP tools/list exposes all 7 tools",
      ["publish_page", "update_page", "get_page", "list_pages", "delete_page", "create_document", "search_pages"].every((n) =>
        toolNames.includes(n),
      ),
      toolNames.join(", "),
    );

    const mcpTitle = `${docTitle}-mcp`;
    const mcpPublish = await mcpCall("tools/call", {
      name: "publish_page",
      arguments: { title: mcpTitle, raw: "# MCP-published page\n\nProduction verification." },
    });
    const mcpPublishText = mcpPublish.body?.result?.content?.[0]?.text ?? "";
    ok("MCP publish_page succeeds", mcpPublish.status === 200 && !mcpPublish.body?.result?.isError, mcpPublishText);
    const mcpUrlMatch = mcpPublishText.match(/https?:\/\/\S+/);
    ok("MCP publish_page returned a URL", Boolean(mcpUrlMatch), mcpPublishText);
    ok(
      "MCP-published URL points at production, not localhost",
      Boolean(mcpUrlMatch && !mcpUrlMatch[0].includes("localhost") && mcpUrlMatch[0].startsWith(BASE)),
      mcpUrlMatch?.[0],
    );

    let mcpPageId;
    if (mcpUrlMatch) {
      const pageRes = await fetch(mcpUrlMatch[0]);
      ok("MCP-published page is actually reachable", pageRes.status === 200, `got ${pageRes.status}`);
    }
    const idMatch = mcpPublishText.match(/^ID:\s*(\S+)/m);
    mcpPageId = idMatch?.[1];
    ok("MCP publish_page response included an ID", Boolean(mcpPageId), mcpPublishText);

    const mcpList = await mcpCall("tools/call", { name: "list_pages", arguments: {} });
    const mcpListText = mcpList.body?.result?.content?.[0]?.text ?? "";
    ok(
      "MCP list_pages sees the page just published",
      mcpListText.includes(mcpTitle),
      mcpListText.slice(0, 300),
    );

    if (mcpPageId) {
      const mcpGet = await mcpCall("tools/call", { name: "get_page", arguments: { id: mcpPageId } });
      ok("MCP get_page succeeds", mcpGet.status === 200 && !mcpGet.body?.result?.isError);

      const mcpUpdate = await mcpCall("tools/call", {
        name: "update_page",
        arguments: { id: mcpPageId, raw: "# MCP-published page\n\nUpdated by production verification." },
      });
      ok("MCP update_page succeeds", mcpUpdate.status === 200 && !mcpUpdate.body?.result?.isError);

      const mcpDelete = await mcpCall("tools/call", {
        name: "delete_page",
        arguments: { id: mcpPageId, confirm: true },
      });
      ok("MCP delete_page succeeds", mcpDelete.status === 200 && !mcpDelete.body?.result?.isError);
    }

    // An engineering document: typed frontmatter in, header strip out.
    const adrTitle = `ADR-001 ${docTitle}`;
    const mcpDoc = await mcpCall("tools/call", {
      name: "create_document",
      arguments: { type: "adr", title: adrTitle, status: "Proposed", body: "## Context\n\nProduction verification." },
    });
    const adrId = mcpDoc.body?.result?.structuredContent?.id;
    ok("MCP create_document succeeds", mcpDoc.status === 200 && !mcpDoc.body?.result?.isError && Boolean(adrId));
    if (adrId) {
      const adrHtml = await (await fetch(`${BASE}/p/${adrId}`)).text();
      ok("the document's page shows the ADR header strip with its status", adrHtml.includes('data-doc-type="adr"') && adrHtml.includes('data-status="Proposed"'));
      const adrGet = await mcpCall("tools/call", { name: "get_page", arguments: { id: adrId } });
      ok("its Markdown carries the ADR frontmatter", (adrGet.body?.result?.content?.[0]?.text ?? "").includes('type: "adr"'));
      const found = await mcpCall("tools/call", { name: "search_pages", arguments: { query: docTitle, type: "adr" } });
      const foundPages = found.body?.result?.structuredContent?.pages ?? [];
      ok("MCP search_pages finds it by type", foundPages.length === 1 && foundPages[0].id === adrId, JSON.stringify(foundPages));
      await mcpCall("tools/call", { name: "delete_page", arguments: { id: adrId, confirm: true } });
    }

    const noAuth = await fetch(`${MCP_BASE}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    ok("MCP rejects requests with no API key", noAuth.status === 401);

    // ── 12. OAuth sign-in, the way a Claude.ai custom connector does it ──
    section("MCP OAuth sign-in");
    const challenge = noAuth.headers.get("www-authenticate") ?? "";
    const prmUrl = challenge.match(/resource_metadata="([^"]+)"/)?.[1];
    ok("401 carries WWW-Authenticate with resource_metadata", Boolean(prmUrl), challenge);

    const prm = prmUrl ? await (await fetch(prmUrl)).json().catch(() => null) : null;
    ok("protected resource metadata names this MCP server", prm?.resource === `${MCP_BASE}/mcp`, JSON.stringify(prm));
    const issuer = prm?.authorization_servers?.[0];
    ok("its authorization server is the Booklet app", issuer === BASE, String(issuer));

    const asMeta = await (await fetch(`${issuer}/.well-known/oauth-authorization-server`)).json().catch(() => null);
    ok(
      "authorization server metadata: S256 only, issuer matches",
      asMeta?.issuer === issuer && JSON.stringify(asMeta?.code_challenge_methods_supported) === '["S256"]',
      JSON.stringify(asMeta),
    );

    const redirectUri = "https://claude.ai/api/mcp/auth_callback";
    // The client is Claude's own metadata document, the one a Claude.ai
    // connector presents. Nothing is registered: the app fetches the document.
    const oauthClientId = "https://claude.ai/oauth/mcp-oauth-client-metadata";
    ok("there is no dynamic client registration", asMeta.registration_endpoint === undefined && asMeta.client_id_metadata_document_supported === true);

    const verifier = randomBytes(48).toString("base64url");
    const authParams = {
      response_type: "code",
      client_id: oauthClientId,
      redirect_uri: redirectUri,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      scope: "pages:read pages:write",
      state: `state-${RUN_ID}`,
      resource: prm.resource,
    };

    const consentPage = await fetch(`${asMeta.authorization_endpoint}?${new URLSearchParams(authParams)}`, {
      headers: { Cookie: sessionCookie },
      redirect: "manual",
    });
    const consentHtml = await consentPage.text();
    ok("consent screen renders and grants nothing by itself", consentPage.status === 200 && consentHtml.includes("Allow"), `got ${consentPage.status}`);
    ok(
      "loading the consent screen issued no code",
      (await db.collection("oauth_codes").countDocuments({ user_id: userId })) === 0,
    );

    // The browser clicking "Allow".
    const allow = await fetch(`${BASE}/api/oauth/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie, Origin: BASE },
      body: JSON.stringify({ params: authParams, decision: "approve" }),
    });
    const allowBody = await allow.json().catch(() => null);
    const back = allowBody?.redirect ? new URL(allowBody.redirect) : null;
    const oauthCode = back?.searchParams.get("code");
    ok("Allow redirects to the client's callback with a code", back?.href.startsWith(redirectUri) && Boolean(oauthCode), JSON.stringify(allowBody));
    ok("the redirect carries state and iss", back?.searchParams.get("state") === authParams.state && back?.searchParams.get("iss") === issuer);

    const exchange = (extra) =>
      fetch(asMeta.token_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: oauthClientId, ...extra }),
      });
    const tokenRes = await exchange({ grant_type: "authorization_code", code: oauthCode, redirect_uri: redirectUri, code_verifier: verifier, resource: prm.resource });
    const tokens = await tokenRes.json().catch(() => null);
    ok("code + PKCE verifier exchange for tokens", tokenRes.status === 200 && Boolean(tokens?.access_token && tokens?.refresh_token), `got ${tokenRes.status}: ${JSON.stringify(tokens)}`);

    const replay = await exchange({ grant_type: "authorization_code", code: oauthCode, redirect_uri: redirectUri, code_verifier: verifier });
    ok("the code cannot be used twice", replay.status === 400);
    // The replay withdrew the grant, which is correct. Sign in again.
    const allow2 = await (
      await fetch(`${BASE}/api/oauth/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: sessionCookie, Origin: BASE },
        body: JSON.stringify({ params: authParams, decision: "approve" }),
      })
    ).json();
    const tokens2 = await (
      await exchange({ grant_type: "authorization_code", code: new URL(allow2.redirect).searchParams.get("code"), redirect_uri: redirectUri, code_verifier: verifier })
    ).json();

    const oauthList = await mcpCall("tools/call", { name: "list_pages", arguments: {} }, tokens2.access_token);
    ok(
      "MCP list_pages works with the OAuth token and returns the caller's pages",
      oauthList.status === 200 && !oauthList.body?.result?.isError,
      JSON.stringify(oauthList.body)?.slice(0, 300),
    );
    const staleToken = await mcpCall("tools/call", { name: "list_pages", arguments: {} }, tokens?.access_token);
    ok("the token from the replayed code no longer works", staleToken.status === 401, `got ${staleToken.status}`);

    const refreshed = await (await exchange({ grant_type: "refresh_token", refresh_token: tokens2.refresh_token })).json();
    ok("refresh token rotates", Boolean(refreshed?.access_token) && refreshed.refresh_token !== tokens2.refresh_token);

    await fetch(asMeta.revocation_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refreshed.refresh_token }),
    });
    const afterRevoke = await mcpCall("tools/call", { name: "list_pages", arguments: {} }, refreshed.access_token);
    ok("a revoked token is refused with 401", afterRevoke.status === 401, `got ${afterRevoke.status}`);
  } finally {
    // ── Cleanup — scoped precisely to this run's data ──────────────────────
    section("Cleanup");
    if (userId) {
      const pagesDeleted = await db.collection("pages").deleteMany({ user_id: userId });
      const keysDeleted = await db.collection("api_keys").deleteMany({ user_id: userId });
      const sessionsDeleted = await db.collection("sessions").deleteMany({ user_id: userId });
      await db.collection("oauth_tokens").deleteMany({ user_id: userId });
      await db.collection("oauth_codes").deleteMany({ user_id: userId });
      const userDeleted = await db.collection("users").deleteMany({ _id: userId });
      console.log(
        `  Deleted: ${pagesDeleted.deletedCount} page(s), ${keysDeleted.deletedCount} key(s), ` +
          `${sessionsDeleted.deletedCount} session(s), ${userDeleted.deletedCount} user`,
      );
    }
    await mongo.close();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
