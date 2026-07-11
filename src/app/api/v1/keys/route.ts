import { createApiKey, getApiKeysByUser } from "@/lib/db";
import { generateRawKey, hashApiKey } from "@/lib/api-key";
import { createId } from "@/lib/id";
import { getSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_KEYS_PER_USER = 10;

export async function GET() {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = await getApiKeysByUser(userId);
  return NextResponse.json({
    keys: keys.map((k) => ({
      id: k.id,
      label: k.label,
      created_at: k.created_at,
      last_used_at: k.last_used_at,
    })),
  });
}

export async function POST(req: Request) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let label: string | null = null;
  try {
    const body = (await req.json()) as { label?: string };
    label = body.label?.trim().slice(0, 80) || null;
  } catch {
    // label is optional; ignore parse errors
  }

  const existing = await getApiKeysByUser(userId);
  if (existing.length >= MAX_KEYS_PER_USER) {
    return NextResponse.json(
      { error: `Maximum of ${MAX_KEYS_PER_USER} API keys per account.` },
      { status: 422 },
    );
  }

  const raw = generateRawKey();
  const keyHash = await hashApiKey(raw);
  const id = createId(16);

  await createApiKey(id, userId, keyHash, label);

  return NextResponse.json({ id, label, key: raw }, { status: 201 });
}
