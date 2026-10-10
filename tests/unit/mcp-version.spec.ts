import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { SERVER_VERSION } from "../../mcp-server/src/mcp-server.js";

// The MCP registry entry (server.json), the package version and the version
// the running server reports had drifted apart (2.0.0, 1.0.0 and both).
const read = (path: string) => JSON.parse(readFileSync(path, "utf8")) as { version: string; description: string };

// The registry rejects a longer one with 422 at publish time, long after CI.
test("server.json's description fits the registry's 100-character limit", () => {
  expect(read("mcp-server/server.json").description.length).toBeLessThanOrEqual(100);
});

test("server.json, mcp-server/package.json and the server agree on the version", () => {
  expect(read("mcp-server/server.json").version).toBe(SERVER_VERSION);
  expect(read("mcp-server/package.json").version).toBe(SERVER_VERSION);
});
