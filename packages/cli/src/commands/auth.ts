import { Command } from "commander";
import { readConfig, writeConfig, getApiKey, getApiBase } from "../config.js";
import { success, error, info, bold, dim, gray } from "../fmt.js";
import { createInterface } from "readline";

const REQUEST_TIMEOUT_MS = 10_000;

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Validates a key directly against the API without touching local config.
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

export function registerAuthCommands(program: Command) {
  program
    .command("login")
    .description("Save your Readable API key")
    .option("--key <key>", "API key (skip interactive prompt)")
    .option("--api-url <url>", "Override API base URL")
    .action(async (opts: { key?: string; apiUrl?: string }) => {
      const existing = await readConfig();
      const base = opts.apiUrl?.replace(/\/$/, "") ?? existing.apiBase;

      let key = opts.key;

      if (!key) {
        console.log();
        console.log(`${bold("Readable CLI")} — authenticate`);
        console.log(dim(`API: ${base}`));
        console.log();
        console.log(`Get your key at: ${bold(`${base}/my-pages`)} → Settings → API Keys`);
        console.log();
        key = await prompt("Paste your API key: ");
      }

      if (!key) {
        error("No key provided.");
        process.exit(1);
      }

      // Validate BEFORE touching the config file.
      const result = await validateKey(key, base);
      if (!result.ok) {
        error(`Invalid key or unreachable server: ${result.error}`);
        process.exit(1);
      }

      await writeConfig({ ...existing, apiKey: key, apiBase: base });
      success(`Authenticated. Key saved to ~/.readable/config.json`);
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
        info("Not authenticated. Run `readable login` to set your API key.");
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
