import { getPageReactions, addReactionForSession, removeReactionForSession } from "@/lib/db/reactions";
import { getPageRecord } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { hashSession } from "@/lib/session-hash";
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

  const ip = getClientIp(req.headers);
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
    // Dedupe per session — mirrors the analytics_events session_hash
    // pattern (see src/lib/session-hash.ts) so repeated add clicks from the
    // same visitor don't keep incrementing, and so a spammed "remove"
    // can't grief a count the session never contributed to. Legitimate
    // toggle-on/toggle-off (add, then remove, then add again) still works —
    // see addReactionForSession/removeReactionForSession in
    // src/lib/db/reactions.ts for the per-session state this relies on.
    const sessionHash = await hashSession(ip, req.headers.get("user-agent") ?? "");
    const count = action === "remove"
      ? await removeReactionForSession(pageId, emoji, sessionHash)
      : await addReactionForSession(pageId, emoji, sessionHash);
    return NextResponse.json({ emoji, count });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
