import { homedir } from "os";
import { join } from "path";
import { readFile, writeFile, mkdir, chmod } from "fs/promises";
import { osKeychain, type KeychainBackend } from "./keychain.js";

function configDir(): string {
  return join(homedir(), ".booklet");
}

function configPath(): string {
  return join(configDir(), "config.json");
}

// Deliberately NOT booklet-api.ashwinsathian.com: `booklet login`'s
// browser flow opens `${base}/cli-auth`, a web UI page, not an API route —
// src/middleware.ts restricts the dedicated API hostname to /api/* only.
// The CLI needs one base that serves both, and booklet.ashwinsathian.com
// already serves /api/v1/* too, so it stays the default here.
export const DEFAULT_API_BASE = "https://booklet.ashwinsathian.com";

export type Config = {
  /** Legacy plaintext fallback — see getApiKey()/setApiKey(). Not written
   * to when the OS keychain is available. */
  apiKey?: string;
  apiBase: string;
};

export async function readConfig(): Promise<Config> {
  try {
    const raw = await readFile(configPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<Config>;
    return { apiBase: DEFAULT_API_BASE, ...parsed };
  } catch {
    return { apiBase: DEFAULT_API_BASE };
  }
}

export async function writeConfig(config: Config): Promise<void> {
  // Config stores a plaintext API key (when the keychain isn't available)
  // — owner-only permissions. `mode` on mkdir/writeFile only applies at
  // creation time, so re-chmod on every write to also tighten a dir/file
  // left world-readable by an older CLI version.
  await mkdir(configDir(), { recursive: true, mode: 0o700 });
  await chmod(configDir(), 0o700);
  await writeFile(configPath(), JSON.stringify(config, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  await chmod(configPath(), 0o600);
}

export type ApiKeySource = "env" | "keychain" | "file";

/**
 * Looks up the active API key: BOOKLET_API_KEY env var, then the OS
 * keychain, then the legacy plaintext config-file field (used when the
 * keychain is unavailable, or for anyone who logged in before this CLI
 * version added keychain support).
 */
export async function getApiKey(backend: KeychainBackend = osKeychain): Promise<string | null> {
  const env = process.env.BOOKLET_API_KEY;
  if (env) return env;

  const fromKeychain = await backend.get();
  if (fromKeychain) return fromKeychain;

  const config = await readConfig();
  return config.apiKey ?? null;
}

/** Same lookup as getApiKey(), but reports where the key came from (for `whoami`). */
export async function getApiKeySource(backend: KeychainBackend = osKeychain): Promise<ApiKeySource | null> {
  if (process.env.BOOKLET_API_KEY) return "env";
  if (await backend.get()) return "keychain";
  const config = await readConfig();
  return config.apiKey ? "file" : null;
}

/**
 * Saves the API key. Prefers the OS keychain; if that's unavailable (no
 * backend on headless Linux, unsupported OS, `--omit=optional` install),
 * falls back to the existing 0600 config file. Either way, any legacy
 * plaintext key from a prior version — or a prior run on this same
 * machine before the keychain became available — is cleaned up once a
 * keychain write succeeds, so the key never ends up duplicated in both
 * places.
 */
export async function setApiKey(key: string, backend: KeychainBackend = osKeychain): Promise<void> {
  const existing = await readConfig();
  const savedToKeychain = await backend.set(key);

  if (savedToKeychain) {
    const { apiKey: _legacy, ...rest } = existing;
    await writeConfig(rest as Config);
  } else {
    await writeConfig({ ...existing, apiKey: key });
  }
}

/** Removes the API key from wherever it's stored — keychain and/or the legacy file field. */
export async function clearApiKey(backend: KeychainBackend = osKeychain): Promise<void> {
  await backend.clear();
  const existing = await readConfig();
  if (existing.apiKey) {
    const { apiKey: _removed, ...rest } = existing;
    await writeConfig(rest as Config);
  }
}

export async function getApiBase(): Promise<string> {
  const env = process.env.BOOKLET_API_URL;
  if (env) return env.replace(/\/$/, "");
  const config = await readConfig();
  return config.apiBase.replace(/\/$/, "");
}
