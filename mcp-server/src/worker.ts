// Spike entry for running the MCP server as a Cloudflare Worker that reaches
// the app Worker through a service binding instead of the public internet.
//
// booklet-api-client calls the global fetch. Until createClient takes a
// fetch option (a Phase 3 change), requests to BOOKLET_API_BASE are routed
// to the binding here.
import worker from "./index.js";
import type { Env } from "./types.js";

type Fetcher = { fetch(request: Request): Promise<Response> };

let patched = false;

export default {
  fetch(request: Request, env: Env & { APP: Fetcher }): Promise<Response> {
    if (!patched) {
      patched = true;
      const publicFetch = globalThis.fetch;
      const appOrigin = new URL(env.BOOKLET_API_BASE).origin;
      globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        const req = new Request(input, init);
        return new URL(req.url).origin === appOrigin ? env.APP.fetch(req) : publicFetch(req);
      }) as typeof fetch;
    }
    return worker.fetch(request, env);
  },
};
