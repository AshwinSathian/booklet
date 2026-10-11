import { unverifiedResponse } from "@/server/verification";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createApiKey, deleteApiKey, getApiKeysByUser } from "@/lib/db";
import { generateRawKey, hashApiKey } from "@/lib/api-key";
import { createId } from "@/lib/id";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { problem } from "@/server/errors";

export const runtime = "nodejs";

const MAX_KEYS_PER_USER = 10;
const CLI_KEY_LABEL = "booklet-cli";

function isValidPort(v: unknown): v is string {
  if (typeof v !== "string" || !v) return false;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1024 && n <= 65535;
}

// State must be exactly 40 hex chars (20 random bytes from the CLI)
function isValidState(v: unknown): v is string {
  return typeof v === "string" && /^[a-f0-9]{40}$/.test(v);
}

// Mints an API key and hands the caller a localhost callback URL to carry it
// to the CLI's loopback server. Deliberately a POST that only fires on an
// explicit user click (see CliAuthorizeConfirm) rather than a bare page
// GET — the previous version created and shipped a live key the instant
// anyone (or any hidden <img>/cross-site navigation) loaded /cli-auth with a
// port+state pair, with no user gesture and nothing to distinguish a
// self-initiated `booklet login` from a link on someone else's page.
export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return problem(403, "Invalid request origin");
  }

  const session = await getSession();
  if (!session) {
    return problem(401, "Not signed in");
  }

  const ip = getClientIp(req.headers);
  const rl = await checkRateLimit(`cli-authorize__ip__${ip}`, 10);
  if (rl) return rl;

  const body = await req.json().catch(() => null);
  const port = body && typeof body === "object" ? (body as Record<string, unknown>).port : undefined;
  const state = body && typeof body === "object" ? (body as Record<string, unknown>).state : undefined;

  if (!isValidPort(port) || !isValidState(state)) {
    return problem(400, "Invalid request");
  }

  const { userId } = session;
  const unverified = await unverifiedResponse(userId);
  if (unverified) return unverified;
  const existing = await getApiKeysByUser(userId);
  if (existing.length >= MAX_KEYS_PER_USER) {
    return problem(409, `You have ${MAX_KEYS_PER_USER} API keys — the maximum allowed. Delete an unused key first.`);
  }

  try {
    const raw = generateRawKey();
    const keyHash = await hashApiKey(raw);
    const id = createId(16);
    await createApiKey(id, userId, keyHash, CLI_KEY_LABEL);

    // Re-count after inserting and compensate if this pushed the user over
    // the limit — see the same pattern in v1/keys/route.ts.
    const after = await getApiKeysByUser(userId);
    if (after.length > MAX_KEYS_PER_USER) {
      await deleteApiKey(id, userId);
      return problem(409, `You have ${MAX_KEYS_PER_USER} API keys — the maximum allowed. Delete an unused key first.`);
    }

    // 127.0.0.1 is exempt from HSTS (RFC 6797 §8.3) so HTTP is safe here.
    const callbackUrl =
      `http://127.0.0.1:${port}/callback` +
      `?key=${encodeURIComponent(raw)}` +
      `&state=${encodeURIComponent(state)}`;

    return NextResponse.json({ ok: true, callbackUrl }, { status: 200 });
  } catch {
    return problem(500, "The API key was not created. Try again.");
  }
}
