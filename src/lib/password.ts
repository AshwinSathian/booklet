// OWASP currently recommends >=600,000 PBKDF2-SHA256 iterations. The
// iteration count is encoded in the stored hash (`iterations:salt:hash`)
// rather than hardcoded at verify time — bumping this constant must not
// invalidate every password already set on an existing protected page, so
// old hashes keep verifying at whatever count they were created with while
// every new hashPassword() call uses the current, higher one.
const ITERATIONS = 600_000;
const LEGACY_ITERATIONS = 100_000; // pre-migration hashes with no count encoded
const KEY_LENGTH = 32;
const ALGO = "SHA-256";

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuf(hex: string): ArrayBuffer {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return arr.buffer as ArrayBuffer;
}

async function deriveHex(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations, hash: ALGO },
    keyMaterial,
    KEY_LENGTH * 8,
  );
  return bufToHex(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hashHex = await deriveHex(password, salt, ITERATIONS);
  return `${ITERATIONS}:${bufToHex(salt.buffer as ArrayBuffer)}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  let iterations: number;
  let saltHex: string;
  let hashHex: string;
  if (parts.length === 3) {
    [iterations, saltHex, hashHex] = [Number(parts[0]), parts[1], parts[2]];
  } else if (parts.length === 2) {
    // Pre-migration format: no iteration count encoded, always LEGACY_ITERATIONS.
    iterations = LEGACY_ITERATIONS;
    [saltHex, hashHex] = parts;
  } else {
    return false;
  }
  if (!Number.isInteger(iterations) || iterations <= 0 || !saltHex || !hashHex) return false;

  const salt = new Uint8Array(hexToBuf(saltHex));
  const computed = await deriveHex(password, salt, iterations);

  // Constant-time compare
  if (computed.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ hashHex.charCodeAt(i);
  }
  return diff === 0;
}
