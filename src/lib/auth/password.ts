/**
 * User account password hashing: argon2id in pure JavaScript
 * (@noble/hashes), because neither the native `argon2` package nor
 * hash-wasm can run in a Worker. hash-wasm compiles its WebAssembly from
 * bytes at run time, which Workers forbid ("Wasm code generation disallowed
 * by embedder"); spike result S4.
 *
 * Parameters and the PHC string format are the native package's defaults
 * (m=65536 KiB, t=3, p=4, 32-byte hash, 16-byte salt), so hashes created
 * before the move verify unchanged.
 */

import { argon2id } from "@noble/hashes/argon2.js";

const PARAMS = { m: 65536, t: 3, p: 4, dkLen: 32 };

function toB64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/=+$/, "");
}

function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export async function hashUserPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = argon2id(password, salt, PARAMS);
  return `$argon2id$v=19$m=${PARAMS.m},t=${PARAMS.t},p=${PARAMS.p}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyUserPassword(password: string, stored: string): Promise<boolean> {
  try {
    const m = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(stored);
    if (!m) return false;
    const want = fromB64(m[5]);
    // A stored hash must never be able to ask for more memory than the
    // isolate has: anything above the current parameters is refused.
    const [mem, t, p] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (mem > PARAMS.m || t > 10 || p > 16) return false;
    const got = argon2id(password, fromB64(m[4]), { m: mem, t, p, dkLen: want.length });
    let diff = got.length ^ want.length;
    for (let i = 0; i < got.length && i < want.length; i++) diff |= got[i] ^ want[i];
    return diff === 0;
  } catch {
    // Malformed/foreign hash (e.g. a stale format) — treat as mismatch, not a crash.
    return false;
  }
}
