import { getPageRecord } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { signUnlockToken } from "@/lib/unlock-token";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Cookie name: booklet_unlock_<pageId>
// Path: /p/ — covers both /p/<id> and /p/<slug> access patterns.
// Expires 8 hours from unlock.
const UNLOCK_TTL = 8 * 60 * 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Strict rate limit: 5 attempts per minute per page+IP to prevent brute-force.
  const ip = getClientIp(req.headers);
  const rl = await checkRateLimit(`unlock__${id}__${ip}`, 5).catch(() => null);
  if (rl) return rl;

  let password: string | undefined;
  try {
    const body = (await req.json()) as { password?: string };
    password = body.password;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  const page = await getPageRecord(id).catch(() => null);
  if (!page || !page.password_hash) {
    // Return 401 (not 404) — don't reveal whether the page exists but is unprotected.
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const ok = await verifyPassword(password, page.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  // Cookie value is an HMAC over pageId + the page's *current* password_hash
  // — unguessable, and automatically invalidated if the password is ever
  // changed (password_hash changes, so old tokens stop verifying). See
  // src/lib/unlock-token.ts.
  const token = await signUnlockToken(id, page.password_hash);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(`booklet_unlock_${id}`, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: UNLOCK_TTL,
    // /p/ covers both /p/<id> and /p/<slug> — cookie name already scopes to the page.
    path: "/p/",
  });
  return res;
}
