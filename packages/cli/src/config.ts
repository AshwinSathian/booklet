import { homedir } from "os";
import { join } from "path";
import { readFile, writeFile, mkdir } from "fs/promises";

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
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf8");
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
