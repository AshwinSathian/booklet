import { getPageReactions, incrementReaction, decrementReaction } from "@/lib/db/reactions";
import { getPageRecord } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const { pageId } = await params;
  if (!pageId?.trim()) {
    return NextResponse.json({ error: "Missing pageId" }, { status: 400 });
  }

  try {
    const counts = await getPageReactions(pageId);
    return NextResponse.json({ counts });
  } catch {
    return NextResponse.json({ counts: {} });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const { pageId } = await params;
  if (!pageId?.trim()) {
    return NextResponse.json({ error: "Missing pageId" }, { status: 400 });
  }

  const ip = getClientIp(req);
  const rl = await checkRateLimit(`reaction__${ip}`, 30).catch(() => null);
  if (rl) return rl;

  let body: { emoji?: string; action?: "add" | "remove" } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { emoji, action = "add" } = body;
  if (!emoji) {
    return NextResponse.json({ error: "Missing emoji" }, { status: 400 });
  }

  // Verify the page exists and is public
  const record = await getPageRecord(pageId);
  if (!record || record.visibility !== "public") {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  try {
    const count = action === "remove"
      ? await decrementReaction(pageId, emoji)
      : await incrementReaction(pageId, emoji);
    return NextResponse.json({ emoji, count });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
