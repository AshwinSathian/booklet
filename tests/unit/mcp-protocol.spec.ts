import { test, expect } from "@playwright/test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import worker from "../../mcp-server/src/index.js";
import { TOOL_NAMES, PROMPT_NAMES } from "../../mcp-server/src/mcp-server.js";

// The MCP server speaks protocol 2026-07-28 and still answers a 2025-11-25
// client, from one set of tool/prompt/resource registrations. Driven with
// the SDK's own client, in-process: the transport's fetch calls the server's
// fetch handler directly, and the Booklet API behind it is stubbed.

const ENV = {
  BOOKLET_API_BASE: "http://api.stub",
  BOOKLET_PUBLIC_URL: "https://app.example.test",
  MCP_PUBLIC_URL: "https://mcp.example.test/mcp",
};
const MCP_URL = new URL(ENV.MCP_PUBLIC_URL);
const API_KEY = "bklt_" + "a".repeat(40);
const OAUTH_TOKEN = "bkat_" + "b".repeat(40);
const exp = () => Math.floor(Date.now() / 1000) + 600;

/** What the stubbed app says about OAUTH_TOKEN; tests replace it. */
let tokeninfo: () => Response = () => Response.json({ active: false }, { status: 401 });
const apiCalls: string[] = [];

const realFetch = globalThis.fetch;
test.beforeAll(() => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    if (url.origin !== ENV.BOOKLET_API_BASE) throw new Error(`unexpected fetch: ${url}`);
    if (url.pathname === "/favicon.svg") return new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } });
    apiCalls.push(`${req.method} ${url.pathname} ${req.headers.get("authorization")}`);
    if (url.pathname === "/api/oauth/tokeninfo") return tokeninfo();
    if (url.pathname === "/api/v1/publish") {
      const detail = "This token does not have the pages:write scope.";
      return Response.json({ type: "about:blank", title: "Forbidden", status: 403, detail }, { status: 403 });
    }
    if (url.pathname === "/api/v1/pages") {
      return Response.json({ pages: [], total: 0, limit: 20, next_cursor: null });
    }
    return Response.json({ type: "about:blank", title: "Not Found", status: 404, detail: "Page not found" }, { status: 404 });
  }) as typeof fetch;
});
test.afterAll(() => {
  globalThis.fetch = realFetch;
});
test.beforeEach(() => {
  apiCalls.length = 0;
});
// The stubbed tokeninfo and the call log are shared.
test.describe.configure({ mode: "serial" });

const serve = (input: RequestInfo | URL, init?: RequestInit) => worker.fetch(new Request(input, init), ENV);

async function connect(token: string, versionNegotiation?: ConstructorParameters<typeof Client>[1]) {
  const client = new Client({ name: "spec", version: "1.0.0" }, versionNegotiation);
  await client.connect(
    new StreamableHTTPClientTransport(MCP_URL, {
      fetch: serve as typeof fetch,
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    }),
  );
  return client;
}

const PINNED = { versionNegotiation: { mode: { pin: "2026-07-28" } } } as never;

{
  test("a 2026-07-28 client lists 7 tools, 6 prompts and the resource template", async () => {
    const client = await connect(API_KEY, PINNED);
    expect(client.getNegotiatedProtocolVersion()).toBe("2026-07-28");

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual([...TOOL_NAMES]); // fixed order
    expect(tools).toHaveLength(7);

    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name).sort()).toEqual([...PROMPT_NAMES].sort());
    expect(prompts).toHaveLength(6);

    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates.map((t) => t.uriTemplate)).toEqual(["booklet://pages/{id}"]);

    const result = await client.callTool({ name: "list_pages", arguments: {} });
    expect(JSON.stringify(result.content)).toContain("No pages found");
    expect(apiCalls).toContain(`GET /api/v1/pages Bearer ${API_KEY}`);

    // An unknown resource is a protocol error, -32602.
    await expect(client.readResource({ uri: "booklet://pages/nopenope00" })).rejects.toMatchObject({ code: -32602 });
    await client.close();
  });
}

test("a 2025-era request (initialize) is refused: only 2026-07-28 is served", async () => {
  const res = await serve(MCP_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${API_KEY}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "old", version: "1" } },
    }),
  });
  const text = await res.text();
  expect(res.ok && !text.includes('"error"')).toBe(false);
  expect(text).toContain("2026-07-28");
  expect(apiCalls).toEqual([]);
});

test("2026-07-28 list results carry ttlMs and cacheScope: private", async () => {
  // Read off the wire: the client object hides these fields.
  const bodies: string[] = [];
  const client = new Client({ name: "spec", version: "1.0.0" }, { versionNegotiation: { mode: { pin: "2026-07-28" } } } as never);
  await client.connect(
    new StreamableHTTPClientTransport(MCP_URL, {
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const res = await serve(input, init);
        bodies.push(await res.clone().text());
        return res;
      }) as typeof fetch,
      requestInit: { headers: { Authorization: `Bearer ${API_KEY}` } },
    }),
  );
  await client.listTools();
  await client.listPrompts();
  await client.close();
  const lists = bodies.filter((b) => b.includes('"tools":[') || b.includes('"prompts":['));
  expect(lists.length).toBeGreaterThanOrEqual(2);
  for (const body of lists) {
    expect(body).toContain('"ttlMs":300000');
    expect(body).toContain('"cacheScope":"private"');
  }
});

test("the MCP host serves the app's icon, with no credential", async () => {
  const res = await serve("https://mcp.example.test/favicon.svg");
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("image/svg+xml");
  expect(await res.text()).toBe("<svg/>");
});

test.describe("authorization", () => {
  const post = (headers: Record<string, string> = {}) =>
    serve(MCP_URL, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: "{}" });

  test("no credential: 401 with a WWW-Authenticate challenge naming the resource metadata", async () => {
    const res = await post();
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain(
      'resource_metadata="https://mcp.example.test/.well-known/oauth-protected-resource/mcp"',
    );
    expect((await post({ authorization: "Bearer nonsense" })).status).toBe(401);
  });

  test("/.well-known/oauth-protected-resource names this server and the app as its authorization server", async () => {
    for (const path of ["/.well-known/oauth-protected-resource/mcp", "/.well-known/oauth-protected-resource"]) {
      const res = await serve(new URL(path, MCP_URL));
      expect(res.status, path).toBe(200);
      expect(await res.json()).toMatchObject({
        resource: "https://mcp.example.test/mcp",
        authorization_servers: ["https://app.example.test"],
        scopes_supported: ["pages:read", "pages:write"],
      });
    }
  });

  test("an OAuth token issued for this server is accepted and forwarded to the API", async () => {
    tokeninfo = () => Response.json({ active: true, client_id: "c1", scope: "pages:read pages:write", exp: exp(), resource: ENV.MCP_PUBLIC_URL });
    const client = await connect(OAUTH_TOKEN, PINNED);
    await client.callTool({ name: "list_pages", arguments: {} });
    expect(apiCalls).toContain(`GET /api/v1/pages Bearer ${OAUTH_TOKEN}`);
    await client.close();
  });

  test("a tool the token's scopes do not cover says so, not 'you do not own this page'", async () => {
    tokeninfo = () => Response.json({ active: true, client_id: "c1", scope: "pages:read", exp: exp(), resource: ENV.MCP_PUBLIC_URL });
    const client = await connect(OAUTH_TOKEN, PINNED);
    const result = await client.callTool({ name: "publish_page", arguments: { raw: "# Hi" } });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("pages:write scope");
    await client.close();
  });

  test("an OAuth token issued for another resource is refused", async () => {
    tokeninfo = () => Response.json({ active: true, client_id: "c1", scope: "pages:read", exp: exp(), resource: "https://other.example.test/mcp" });
    const res = await post({ authorization: `Bearer ${OAUTH_TOKEN}` });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("invalid_token");
    expect(apiCalls.some((c) => c.includes("/api/v1/"))).toBe(false);
  });

  test("an expired or revoked OAuth token is 401; an app outage is not reported as a bad token", async () => {
    tokeninfo = () => Response.json({ active: false }, { status: 401 });
    expect((await post({ authorization: `Bearer ${OAUTH_TOKEN}` })).status).toBe(401);

    tokeninfo = () => new Response("down", { status: 503 });
    expect((await post({ authorization: `Bearer ${OAUTH_TOKEN}` })).status).toBeGreaterThanOrEqual(500);
  });
});
