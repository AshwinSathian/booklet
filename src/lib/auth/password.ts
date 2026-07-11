/**
 * User account password hashing — argon2id via the `argon2` package (native
 * bindings, OWASP-recommended default KDF for new applications). This is
 * deliberately a different primitive from src/lib/password.ts's
 * PBKDF2-SHA256, which hashes page-unlock passwords (lower-stakes, protects
 * read-access to a single published document, an existing unrelated design
 * this module does not touch). Account passwords protect real user data
 * (pages, API keys, webhooks) and warrant argon2id's memory-hardness.
 *
 * Library defaults (argon2id, m=65536 KiB, t=3, p=4) already exceed OWASP's
 * baseline recommendation — not overridden here.
 */

import argon2 from "argon2";

export async function hashUserPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function verifyUserPassword(password: string, stored: string): Promise<boolean> {
  try {
    return await argon2.verify(stored, password);
  } catch {
    // Malformed/foreign hash (e.g. a stale format) — treat as mismatch, not a crash.
    return false;
  }
}
