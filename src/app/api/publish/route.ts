import type { PublishedDoc } from "@/lib/blocks";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { BLOCKS, ROUTES } from "@/lib/constants";
import { createId } from "@/lib/id";
import { putDoc } from "@/lib/storage";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PublishPayload = {
  blocks: PublishedDoc["blocks"];
  settings?: PublishedDoc["settings"];
};

export async function POST(req: Request) {
  let payload: PublishPayload | null = null;

  try {
    payload = (await req.json()) as PublishPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload?.blocks?.length) {
    return NextResponse.json({ error: "Nothing to publish" }, { status: 400 });
  }

  const id = createId(10);
  const doc: PublishedDoc = {
    v: BLOCKS.version,
    createdAt: new Date().toISOString(),
    settings: payload.settings ?? DEFAULT_SETTINGS,
    blocks: payload.blocks,
  };

  try {
    await putDoc(id, doc);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Publish failed" },
      { status: 500 },
    );
  }

  // Build absolute URL at runtime
  const url = new URL(req.url);
  url.pathname = ROUTES.publish(id);
  url.search = "";
  url.hash = "";

  return NextResponse.json({ id, url: url.toString() });
}
