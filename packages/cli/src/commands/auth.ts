import { Command } from "commander";
import { readConfig, writeConfig, getApiKey, getApiBase } from "../config.js";
import { apiRequest } from "../api.js";
import { success, error, info, bold, dim, gray } from "../fmt.js";
import { createInterface } from "readline";

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function registerAuthCommands(program: Command) {
  const auth = program
    .command("login")
    .description("Save your Readable API key")
    .option("--key <key>", "API key (skip interactive prompt)")
    .option("--api-url <url>", "Override API base URL")
    .action(async (opts: { key?: string; apiUrl?: string }) => {
      let key = opts.key;

      if (!key) {
        const base = opts.apiUrl ?? (await (async () => {
          const cfg = await readConfig();
          return cfg.apiBase;
        })());
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

      // Validate the key by hitting the pages list endpoint
      const existing = await readConfig();
      const testBase = opts.apiUrl ?? existing.apiBase;
      const testConfig = { ...existing, apiKey: key, apiBase: testBase };

      // Temporarily write so apiRequest can pick it up
      await writeConfig(testConfig);

      const res = await apiRequest<{ pages: unknown[] }>("/api/v1/pages");
      if (!res.ok) {
        error(`Invalid key or unreachable server: ${res.error}`);
        // Roll back
        await writeConfig(existing);
        process.exit(1);
      }

      success(`Authenticated. Key saved to ~/.readable/config.json`);
      info(`You have ${(res.data as { pages: unknown[] }).pages.length} page(s).`);
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
      const key = await getApiKey();
      const base = await getApiBase();
      if (!key) {
        info("Not authenticated. Run `readable login` to set your API key.");
      } else {
        const masked = key.length > 8
          ? `${key.slice(0, 4)}${"•".repeat(key.length - 8)}${key.slice(-4)}`
          : "•".repeat(key.length);
        console.log(`${bold("Key:")}  ${masked}`);
        console.log(`${bold("Base:")} ${gray(base)}`);
      }
    });

  return auth;
}
