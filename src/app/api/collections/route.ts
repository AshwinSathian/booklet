import {
  createCollectionRecord,
  getCollectionsByUser,
} from "@/lib/db";
import { createId } from "@/lib/id";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function cleanName(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const collections = await getCollectionsByUser(userId);
  return NextResponse.json({ collections });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: unknown };
  try {
    body = (await req.json()) as { name?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = cleanName(body.name);
  if (name.length < 1 || name.length > 80) {
    return NextResponse.json({ error: "Collection name must be 1-80 characters." }, { status: 422 });
  }

  const id = createId(10);
  try {
    await createCollectionRecord(id, userId, name);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("E11000")) {
      return NextResponse.json({ error: "Collection name already exists." }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({
    collection: {
      id,
      user_id: userId,
      name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  }, { status: 201 });
}
