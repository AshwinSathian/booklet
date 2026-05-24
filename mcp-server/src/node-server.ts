import http from "node:http";
import { Buffer } from "node:buffer";

// Type-erase the CF Worker export so this file stays Node-type-clean.
// At runtime, tsx resolves ./index.js → index.ts and calls fetch correctly.
type FetchHandler = (req: Request, env: Record<string, string>, ctx: object) => Promise<Response>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const worker = (require("./index.js") as { default: { fetch: FetchHandler } }).default;

const PORT = Number(process.env.PORT ?? 8788);

// Mirror the Env bindings expected by the Worker
const env = {
  READABLE_API_BASE: process.env.READABLE_API_BASE ?? "http://localhost:3000",
  MCP_SERVER_NAME: process.env.MCP_SERVER_NAME ?? "readable",
  MCP_SERVER_VERSION: process.env.MCP_SERVER_VERSION ?? "1.0.0",
};

const server = http.createServer(async (req, res) => {
  try {
    const url = `http://127.0.0.1:${PORT}${req.url ?? "/"}`;

    // Convert Node IncomingMessage headers → plain Record
    const headers: Record<string, string> = {};
    for (const [key, val] of Object.entries(req.headers)) {
      if (typeof val === "string") headers[key] = val;
      else if (Array.isArray(val)) headers[key] = val.join(", ");
    }

    // Buffer body for non-GET/HEAD requests
    let body: Buffer | undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      body = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
      });
    }

    // Build a Web-standard Request and hand it to the Worker
    const cfReq = new Request(url, {
      method: req.method ?? "GET",
      headers,
      ...(body?.length ? { body } : {}),
    });

    const cfRes = await worker.fetch(cfReq, env as never, {} as never);

    // Forward response headers and status
    const resHeaders: Record<string, string> = {};
    cfRes.headers.forEach((val: string, key: string) => {
      resHeaders[key] = val;
    });

    res.writeHead(cfRes.status, resHeaders);
    res.end(Buffer.from(await cfRes.arrayBuffer()));
  } catch (err) {
    console.error("[readable-mcp] Unhandled error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(
    `[readable-mcp] Node bridge listening on :${PORT} → ${env.READABLE_API_BASE}`,
  );
});

process.on("SIGINT", () => server.close());
process.on("SIGTERM", () => server.close());
