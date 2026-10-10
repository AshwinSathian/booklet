import { test, expect } from "@playwright/test";
import http from "node:http";
import { pinnedLookup } from "@/lib/ssrf-guard";

// Outbound requests to user-supplied hosts (webhooks, OAuth client metadata)
// connect to an address that already passed the SSRF denylist, by handing
// node:http a `lookup` that returns it. Node 20+ calls that lookup with
// `{ all: true }` and expects an array; answering with a bare address makes
// every such request fail with ERR_INVALID_IP_ADDRESS.

test("a request pinned with pinnedLookup connects to the pinned address, whatever the hostname", async () => {
  const server = http.createServer((_req, res) => res.end("pinned"));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as { port: number };
  try {
    const body = await new Promise<string>((resolve, reject) => {
      const req = http.request(
        { hostname: "does-not-resolve.invalid", port, path: "/", lookup: pinnedLookup("127.0.0.1", 4) },
        (res) => {
          let text = "";
          res.on("data", (c) => (text += c));
          res.on("end", () => resolve(text));
        },
      );
      req.on("error", reject);
      req.end();
    });
    expect(body).toBe("pinned");
  } finally {
    server.close();
  }
});

test("pinnedLookup answers both call shapes", () => {
  const lookup = pinnedLookup("203.0.113.7", 4);
  lookup("x", { all: true }, (err, addresses) => {
    expect(err).toBeNull();
    expect(addresses).toEqual([{ address: "203.0.113.7", family: 4 }]);
  });
  lookup("x", {}, (err, address, family) => {
    expect(err).toBeNull();
    expect(address).toBe("203.0.113.7");
    expect(family).toBe(4);
  });
});
