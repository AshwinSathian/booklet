import { logError } from "@/lib/logger";
import { getClientIp } from "@/lib/request-ip";

/**
 * Cloudflare Turnstile, on the three forms a script can abuse without an
 * account: anonymous publish, signup and the report form. It is on only
 * when both keys are set; with either missing every check passes, so an
 * install without Turnstile behaves as it did before.
 */
export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * True when Turnstile is off, or `token` is a solved challenge. Fails
 * closed: if Cloudflare cannot be reached the request is refused, since a
 * check that passes during an outage is one an attacker can wait for.
 */
export async function verifyTurnstile(req: Request, token: unknown): Promise<boolean> {
  if (!turnstileEnabled()) return true;
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  try {
    const res = await fetch(process.env.TURNSTILE_VERIFY_URL || VERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY!,
        response: token,
        remoteip: getClientIp(req.headers),
      }),
      signal: AbortSignal.timeout(5000),
    });
    return ((await res.json()) as { success?: unknown }).success === true;
  } catch (err) {
    logError("turnstile", "Siteverify request failed", err);
    return false;
  }
}

export const TURNSTILE_FAILED = "Could not confirm you are not a robot. Reload the page and try again.";
