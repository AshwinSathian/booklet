import { test, expect } from "@playwright/test";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { KeychainBackend } from "../../packages/cli/src/keychain";
import {
  getApiKey,
  getApiKeySource,
  setApiKey,
  clearApiKey,
  readConfig,
  DEFAULT_API_BASE,
} from "../../packages/cli/src/config";

function fakeBackend(initial: string | null = null): KeychainBackend & { stored: string | null } {
  return {
    stored: initial,
    async get() {
      return this.stored;
    },
    async set(key: string) {
      this.stored = key;
      return true;
    },
    async clear() {
      this.stored = null;
    },
  };
}

function unavailableBackend(): KeychainBackend {
  return {
    async get() {
      return null;
    },
    async set() {
      return false; // simulates "no backend available"
    },
    async clear() {
      /* no-op */
    },
  };
}

test.describe("config.ts credential precedence", () => {
  let home: string;
  const originalHome = process.env.HOME;
  const originalEnvKey = process.env.BOOKLET_API_KEY;

  test.beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "booklet-cli-test-"));
    process.env.HOME = home;
    delete process.env.BOOKLET_API_KEY;
  });

  test.afterEach(async () => {
    await rm(home, { recursive: true, force: true });
    process.env.HOME = originalHome;
    if (originalEnvKey === undefined) delete process.env.BOOKLET_API_KEY;
    else process.env.BOOKLET_API_KEY = originalEnvKey;
  });

  test("BOOKLET_API_KEY env var wins over everything else", async () => {
    process.env.BOOKLET_API_KEY = "bklt_from_env";
    const backend = fakeBackend("bklt_from_keychain");
    expect(await getApiKey(backend)).toBe("bklt_from_env");
    expect(await getApiKeySource(backend)).toBe("env");
  });

  test("setApiKey stores in the keychain when available, getApiKey reads it back", async () => {
    const backend = fakeBackend();
    await setApiKey("bklt_secret", backend);
    expect(backend.stored).toBe("bklt_secret");
    expect(await getApiKey(backend)).toBe("bklt_secret");
    expect(await getApiKeySource(backend)).toBe("keychain");
  });

  test("falls back to the config file when the keychain is unavailable", async () => {
    const backend = unavailableBackend();
    await setApiKey("bklt_secret", backend);
    expect(await getApiKey(backend)).toBe("bklt_secret");
    expect(await getApiKeySource(backend)).toBe("file");
    const config = await readConfig();
    expect(config.apiKey).toBe("bklt_secret");
  });

  test("setApiKey migrates a legacy plaintext key into the keychain once it becomes available", async () => {
    // Simulate a pre-upgrade config file with a plaintext key already in it.
    const unavailable = unavailableBackend();
    await setApiKey("bklt_legacy", unavailable);
    expect((await readConfig()).apiKey).toBe("bklt_legacy");

    // Now the keychain is available (e.g. re-run after installing the
    // optional platform package) — the next setApiKey call should move
    // the key into it and strip the file.
    const nowAvailable = fakeBackend();
    await setApiKey("bklt_legacy", nowAvailable);
    expect(nowAvailable.stored).toBe("bklt_legacy");
    expect((await readConfig()).apiKey).toBeUndefined();
  });

  test("clearApiKey removes the key from both the keychain and the file", async () => {
    const backend = fakeBackend();
    await setApiKey("bklt_secret", backend);
    await clearApiKey(backend);
    expect(backend.stored).toBeNull();
    expect(await getApiKey(backend)).toBeNull();
    expect(await getApiKeySource(backend)).toBeNull();
  });

  test("clearApiKey also strips a legacy plaintext key even if the keychain has nothing", async () => {
    const unavailable = unavailableBackend();
    await setApiKey("bklt_secret", unavailable);
    await clearApiKey(unavailable);
    expect((await readConfig()).apiKey).toBeUndefined();
  });

  test("apiBase is preserved across setApiKey calls and defaults correctly", async () => {
    const backend = fakeBackend();
    await setApiKey("bklt_secret", backend);
    const config = await readConfig();
    expect(config.apiBase).toBe(DEFAULT_API_BASE);
  });
});
