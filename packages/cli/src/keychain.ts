import { AsyncEntry } from "@napi-rs/keyring";

const SERVICE = "booklet-cli";
const ACCOUNT = "default";

// Reads time out fast so a wedged keyring daemon (or a headless Linux box
// with no Secret Service running) never hangs a routine command — every
// command that needs auth calls getApiKey(), which reads the keychain.
// Writes during `login`/`logout` do not get a timeout: macOS may show a
// one-time Keychain access prompt for an unsigned binary, and that
// legitimately needs to wait on the user, not time out mid-prompt.
const READ_TIMEOUT_MS = 3000;

export type KeychainBackend = {
  get(): Promise<string | null>;
  set(key: string): Promise<boolean>;
  clear(): Promise<void>;
};

/**
 * Real OS keychain backend (macOS Keychain, Windows Credential Manager,
 * Linux Secret Service via @napi-rs/keyring). Every method swallows its
 * own errors — "no backend available" and "nothing stored" are both
 * ordinary, expected outcomes here, never a hard failure. config.ts is
 * responsible for falling back to the file-based store when get()/set()
 * report unavailability.
 */
export const osKeychain: KeychainBackend = {
  async get() {
    try {
      const entry = new AsyncEntry(SERVICE, ACCOUNT);
      const value = await entry.getPassword(AbortSignal.timeout(READ_TIMEOUT_MS));
      return value ?? null;
    } catch {
      return null;
    }
  },

  async set(key: string) {
    try {
      const entry = new AsyncEntry(SERVICE, ACCOUNT);
      await entry.setPassword(key);
      return true;
    } catch {
      return false;
    }
  },

  async clear() {
    try {
      const entry = new AsyncEntry(SERVICE, ACCOUNT);
      await entry.deleteCredential();
    } catch {
      /* nothing stored, or no backend available — either way, nothing to do */
    }
  },
};
