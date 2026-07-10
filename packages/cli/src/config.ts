import { homedir } from "os";
import { join } from "path";
import { readFile, writeFile, mkdir, chmod } from "fs/promises";

const CONFIG_DIR = join(homedir(), ".readable");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export const DEFAULT_API_BASE = "https://readable.ashwinsathian.com";

export type Config = {
  apiKey?: string;
  apiBase: string;
};

export async function readConfig(): Promise<Config> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<Config>;
    return { apiBase: DEFAULT_API_BASE, ...parsed };
  } catch {
    return { apiBase: DEFAULT_API_BASE };
  }
}

export async function writeConfig(config: Config): Promise<void> {
  // Config stores a plaintext API key — owner-only permissions. `mode` on
  // mkdir/writeFile only applies at creation time, so re-chmod on every
  // write to also tighten a dir/file left world-readable by an older CLI
  // version.
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await chmod(CONFIG_DIR, 0o700);
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  await chmod(CONFIG_PATH, 0o600);
}

export async function getApiKey(): Promise<string | null> {
  const env = process.env.READABLE_API_KEY;
  if (env) return env;
  const config = await readConfig();
  return config.apiKey ?? null;
}

export async function getApiBase(): Promise<string> {
  const env = process.env.READABLE_API_URL;
  if (env) return env.replace(/\/$/, "");
  const config = await readConfig();
  return config.apiBase.replace(/\/$/, "");
}
