#!/usr/bin/env node
// Manual, opt-in production verification for the CLI login flow and the MCP
// server — NOT part of the default test suite, run explicitly after a
// deploy that touches src/app/cli-auth, packages/cli, or mcp-server/.
//
// Drives the *real* `readable login` browser flow end-to-end: signs up a
// throwaway account via the real signup API, feeds its session cookie
// through /cli-auth exactly as a browser would (including following the
// 307 redirect to the CLI's local loopback callback server), then runs
// real CLI commands (pages list/publish/delete, whoami, logout) and real
// MCP JSON-RPC tool calls (initialize, tools/list, publish_page,
// list_pages, get_page, update_page, delete_page) against production.
//
// Everything this creates is tagged with an "e2e-cli-verify-<timestamp>"
// email/title prefix and deleted at the end, scoped precisely to what this
// run created.
//
// Usage:
//   MONGODB_URI="mongodb://127.0.0.1:27017/readable?directConnection=true" \
//   node scripts/production-verify/cli-mcp-verify.mjs

import { spawn } from "node:child_process";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MongoClient } from "mongodb";

const BASE = process.env.TEST_BASE_URL ?? "https://readable.ashwinsathian.com";
const MCP_BASE = process.env.TEST_MCP_BASE_URL ?? "https://readable-mcp.ashwinsathian.com";
const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/readable?directConnection=true";
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
  console.log(`Readable CLI + MCP production verification — run ${RUN_ID}`);
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
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    ok("signup returns 201", signupRes.status === 201, `got ${signupRes.status}: ${await signupRes.clone().text()}`);
    const setCookie = signupRes.headers.get("set-cookie");
    sessionCookie = setCookie?.split(";")[0];
    ok("signup returns a session cookie", Boolean(sessionCookie));

    const userDoc = await db.collection("users").findOne({ email: EMAIL });
    userId = userDoc?._id;
    ok("user record created in Mongo", Boolean(userId));

    // ── 2. Real `readable login` browser flow ────────────────────────────
    section("CLI login (browser flow)");
    const home = await mkdtemp(join(tmpdir(), "readable-cli-verify-"));

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

    // ── 3. Simulate the browser: GET /cli-auth with the session cookie ──
    const cliAuthRes = await fetch(authUrl, {
      headers: { Cookie: sessionCookie },
      redirect: "manual",
    });
    const bodyIfNoRedirect = cliAuthRes.status >= 200 && cliAuthRes.status < 300 ? await cliAuthRes.text() : "";
    ok(
      "cli-auth page does NOT show 'Something went wrong'",
      !bodyIfNoRedirect.includes("Something went wrong"),
    );
    ok(
      "cli-auth page redirects (307) instead of rendering an error page",
      cliAuthRes.status === 307 || cliAuthRes.status === 302,
      `got ${cliAuthRes.status}`,
    );
    const location = cliAuthRes.headers.get("location");
    ok(
      "redirect target is the CLI's loopback callback server",
      Boolean(location && location.startsWith(`http://127.0.0.1:${port}/callback`)),
      location ?? "(no location header)",
    );

    // ── 4. Browser follows the redirect to 127.0.0.1:port/callback ──────
    if (location) {
      const callbackRes = await fetch(location);
      ok("CLI's local callback server accepted the redirect", callbackRes.status === 200);
    }

    const { code, stdout, stderr } = await new Promise((resolve) => {
      let out = liveStdout;
      let err = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (err += d));
      child.on("close", (c) => resolve({ code: c, stdout: out, stderr: err }));
    });
    ok("CLI process exited 0", code === 0, `stderr: ${stderr}`);
    ok("CLI printed 'Authenticated'", stdout.includes("Authenticated"), stdout);
    ok("CLI reported 0 pages for a fresh account", /You have 0 pages/.test(stdout), stdout);

    const config = JSON.parse(await readFile(join(home, ".readable", "config.json"), "utf8"));
    const apiKey = config.apiKey;
    ok("CLI saved an API key matching rdbl_ prefix", /^rdbl_[0-9A-Za-z]{40}$/.test(apiKey ?? ""));

    // ── 5. `readable whoami` ──────────────────────────────────────────────
    section("CLI commands");
    const whoami = await runCli(["whoami"], { home });
    ok("whoami exits 0", whoami.code === 0);
    ok("whoami shows the configured base URL", whoami.stdout.includes(BASE));

    // ── 6. `readable pages list` (empty) ─────────────────────────────────
    const listEmpty = await runCli(["pages", "list", "--json"], { home });
    ok("pages list exits 0", listEmpty.code === 0);
    let emptyPages = [];
    try {
      emptyPages = JSON.parse(listEmpty.stdout);
    } catch {
      /* handled by the ok() below */
    }
    ok("pages list returns an empty array", Array.isArray(emptyPages) && emptyPages.length === 0, listEmpty.stdout);

    // ── 7. `readable publish` ─────────────────────────────────────────────
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

    // ── 8. `readable pages list` (one page) ──────────────────────────────
    const listOne = await runCli(["pages", "list", "--json"], { home });
    let onePages = [];
    try {
      onePages = JSON.parse(listOne.stdout);
    } catch {
      /* handled below */
    }
    ok("pages list now shows 1 page", onePages.length === 1, listOne.stdout);
    const cliPageId = onePages[0]?.id;

    // ── 9. `readable pages delete` ────────────────────────────────────────
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

    // ── 10. `readable logout` ─────────────────────────────────────────────
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
    async function mcpCall(method, params) {
      const res = await fetch(`${MCP_BASE}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const body = await res.json().catch(() => null);
      return { status: res.status, body };
    }

    const health = await fetch(`${MCP_BASE}/health`);
    ok("MCP /health returns ok", health.status === 200);

    const init = await mcpCall("initialize", {});
    ok("MCP initialize succeeds", init.status === 200 && init.body?.result?.protocolVersion);

    const toolsList = await mcpCall("tools/list", {});
    const toolNames = (toolsList.body?.result?.tools ?? []).map((t) => t.name);
    ok(
      "MCP tools/list exposes all 5 tools",
      ["publish_page", "update_page", "get_page", "list_pages", "delete_page"].every((n) => toolNames.includes(n)),
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

    const noAuth = await fetch(`${MCP_BASE}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    ok("MCP rejects requests with no API key", noAuth.status === 401);
  } finally {
    // ── Cleanup — scoped precisely to this run's data ──────────────────────
    section("Cleanup");
    if (userId) {
      const pagesDeleted = await db.collection("pages").deleteMany({ user_id: userId });
      const keysDeleted = await db.collection("api_keys").deleteMany({ user_id: userId });
      const sessionsDeleted = await db.collection("sessions").deleteMany({ user_id: userId });
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
