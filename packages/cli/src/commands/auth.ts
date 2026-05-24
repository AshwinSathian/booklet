import { Command } from "commander";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readConfig, writeConfig, getApiKey, getApiBase } from "../config.js";
import { success, error, info, bold, dim, gray, openUrl } from "../fmt.js";

const REQUEST_TIMEOUT_MS = 10_000;
const BROWSER_AUTH_TIMEOUT_MS = 5 * 60_000; // 5 minutes

// Served by the local callback server so the user gets a clean close-this-tab page
const CALLBACK_SUCCESS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Readable CLI — Authorized</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;
         background:#0c0c0e;color:#e8e8f0;min-height:100vh;
         display:flex;align-items:center;justify-content:center}
    .card{text-align:center;padding:2.5rem;max-width:360px}
    .icon{font-size:2.5rem;margin-bottom:1.25rem;color:#7c5cfc}
    h1{font-size:1.25rem;font-weight:600;margin-bottom:.5rem}
    p{font-size:.875rem;color:#888;line-height:1.6}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>CLI authorized</h1>
    <p>You can close this tab and return to your terminal.</p>
  </div>
</body>
</html>`;

// ── Key validation (does not touch local config) ───────────────────────────

async function validateKey(
  key: string,
  base: string,
): Promise<{ ok: true; pageCount: number } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${base}/api/v1/pages`, {
      headers: {
        Authorization: `Bearer ${key}`,
        "X-Readable-Source": "cli",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as Record<string, unknown>;
        if (typeof body.error === "string") msg = body.error;
      } catch { /* ignore */ }
      return { ok: false, error: msg };
    }

    const body = (await res.json()) as { pages: unknown[] };
    return { ok: true, pageCount: body.pages?.length ?? 0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Network error: ${msg}` };
  }
}

// ── Browser-based login (loopback redirect flow) ───────────────────────────

/** Bind to port 0 to let the OS assign a free port. */
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

/**
 * Start a one-shot HTTP server on `port`, wait for the browser to POST
 * /callback?key=…&state=…, validate CSRF state, then shut down.
 * Returns the raw API key on success.
 */
function waitForCallback(port: number, expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(
        new Error("Login timed out after 5 minutes. Run `readable login` to try again."),
      );
    }, BROWSER_AUTH_TIMEOUT_MS);

    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

        if (url.pathname !== "/callback") {
          res.writeHead(404);
          res.end();
          return;
        }

        const key = url.searchParams.get("key") ?? "";
        const returnedState = url.searchParams.get("state") ?? "";

        // Respond to the browser first so it gets the success page
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(CALLBACK_SUCCESS_HTML);

        clearTimeout(timer);
        server.close();

        if (returnedState !== expectedState) {
          reject(new Error("State mismatch — possible CSRF. Aborting."));
          return;
        }
        if (!key) {
          reject(new Error("No API key received from server."));
          return;
        }

        resolve(key);
      } catch (err) {
        clearTimeout(timer);
        server.close();
        reject(err);
      }
    });

    server.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    server.listen(port, "127.0.0.1");
  });
}

async function loginWithBrowser(base: string): Promise<{ key: string; pageCount: number }> {
  const port = await findFreePort();
  const state = randomBytes(20).toString("hex"); // 40-char hex, used as CSRF token
  const authUrl = `${base}/cli-auth?port=${port}&state=${state}`;

  console.log();
  openUrl(authUrl);
  info(`Opening ${bold(new URL(base).hostname)} in your browser…`);
  console.log(dim(`  Didn't open? Visit: ${authUrl}`));
  console.log(dim(`  In a non-interactive environment? Use: readable login --key <key>`));
  console.log();
  info("Waiting for authorization… (Ctrl+C to cancel)");

  const key = await waitForCallback(port, state);

  // Validate the received key against the live API
  const validation = await validateKey(key, base);
  if (!validation.ok) {
    throw new Error(`Key validation failed after auth: ${validation.error}`);
  }

  return { key, pageCount: validation.pageCount };
}

// ── Command registration ───────────────────────────────────────────────────

export function registerAuthCommands(program: Command) {
  program
    .command("login")
    .description("Authenticate with Readable")
    .option("--key <key>", "Authenticate with an API key directly (for CI/scripts)")
    .option("--api-url <url>", "Override API base URL")
    .action(async (opts: { key?: string; apiUrl?: string }) => {
      const existing = await readConfig();
      const base = opts.apiUrl?.replace(/\/$/, "") ?? existing.apiBase;

      // ── Non-interactive: key provided on the command line ──────────────────
      if (opts.key) {
        const result = await validateKey(opts.key, base);
        if (!result.ok) {
          error(`Invalid key or unreachable server: ${result.error}`);
          process.exit(1);
        }
        await writeConfig({ ...existing, apiKey: opts.key, apiBase: base });
        success("Authenticated. Key saved to ~/.readable/config.json");
        info(`You have ${result.pageCount} page${result.pageCount === 1 ? "" : "s"}.`);
        return;
      }

      // ── Interactive: open browser ──────────────────────────────────────────
      let result: { key: string; pageCount: number };
      try {
        result = await loginWithBrowser(base);
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }

      await writeConfig({ ...existing, apiKey: result.key, apiBase: base });
      console.log();
      success("Authenticated. Key saved to ~/.readable/config.json");
      info(`You have ${result.pageCount} page${result.pageCount === 1 ? "" : "s"}.`);
    });

  program
    .command("logout")
    .description("Remove saved API key")
    .action(async () => {
      const config = await readConfig();
      if (!config.apiKey) {
        info("No key stored.");
        return;
      }
      const { apiKey: _removed, ...rest } = config;
      await writeConfig(rest as typeof config);
      success("Logged out. API key removed.");
    });

  program
    .command("whoami")
    .description("Show the active API key and base URL")
    .action(async () => {
      const fromEnv = Boolean(process.env.READABLE_API_KEY);
      const key = await getApiKey();
      const base = await getApiBase();

      if (!key) {
        info("Not authenticated. Run `readable login` to authenticate.");
        return;
      }

      const masked =
        key.length > 8
          ? `${key.slice(0, 4)}${"•".repeat(key.length - 8)}${key.slice(-4)}`
          : "•".repeat(key.length);

      console.log(`${bold("Key:")}    ${masked}`);
      console.log(`${bold("Base:")}   ${gray(base)}`);
      console.log(`${bold("Source:")} ${dim(fromEnv ? "READABLE_API_KEY (env)" : "~/.readable/config.json")}`);
    });
}
