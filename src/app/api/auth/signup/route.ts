import { NextResponse } from "next/server";
import { createUser, getUserByEmail } from "@/lib/db/auth";
import { createId } from "@/lib/id";
import { createSession } from "@/lib/auth/session";
import { hashUserPassword } from "@/lib/auth/password";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { SignupSchema } from "@/lib/auth/schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const ip = getClientIp(req.headers);
  const rl = await checkRateLimit(`signup__ip__${ip}`, 5);
  if (rl) return rl;

  const parsed = SignupSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  if (await getUserByEmail(email)) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await hashUserPassword(password);
  const user = await createUser(createId(20), email, passwordHash);
  await createSession(user.id);

  return NextResponse.json({ ok: true, email: user.email }, { status: 201 });
}
