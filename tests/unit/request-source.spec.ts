import { test, expect } from "@playwright/test";
import { resolveApiClientSource } from "@/lib/request-source";

// Regression coverage: /api/v1/publish and /api/v1/pages/[id] previously
// hardcoded source: "api" for every request, even though all 4 first-party
// clients (packages/cli, packages/github-action, packages/vscode,
// mcp-server) already send X-Booklet-Source via packages/shared's
// createClient(). That collapsed MCP/agent-driven publish volume into the
// same bucket as raw curl usage, making it unmeasurable.

test.describe("resolveApiClientSource", () => {
  test("recognizes each first-party client header value", () => {
    for (const source of ["cli", "github-action", "vscode", "mcp"] as const) {
      const req = new Request("http://localhost:3100/api/v1/publish", {
        headers: { "X-Booklet-Source": source },
      });
      expect(resolveApiClientSource(req)).toBe(source);
    }
  });

  test("is case-insensitive", () => {
    const req = new Request("http://localhost:3100/api/v1/publish", {
      headers: { "X-Booklet-Source": "MCP" },
    });
    expect(resolveApiClientSource(req)).toBe("mcp");
  });

  test("falls back to 'api' when the header is missing", () => {
    const req = new Request("http://localhost:3100/api/v1/publish");
    expect(resolveApiClientSource(req)).toBe("api");
  });

  test("falls back to 'api' for an unrecognized value, not a made-up source", () => {
    const req = new Request("http://localhost:3100/api/v1/publish", {
      headers: { "X-Booklet-Source": "browser" },
    });
    expect(resolveApiClientSource(req)).toBe("api");
  });
});
