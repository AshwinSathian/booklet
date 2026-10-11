import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { toErrorResponse, problem } from "@/server/errors";
import { importMarkdownFromUrl } from "@/server/import";

export const runtime = "nodejs";

/**
 * The editor's "Import from URL". Returns the file's Markdown for a new
 * local draft; it stores and publishes nothing. Open to signed-out visitors
 * like the rest of the editor, so the limit is per address. A page on
 * another site cannot call it from a visitor's browser (the Origin check);
 * a script can, and gets what raw.githubusercontent.com serves anyone.
 */
export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) return problem(403, "Forbidden");

  const limited = await checkRateLimit(`import_url__ip__${getClientIp(req.headers)}`, 10);
  if (limited) return limited;

  let body: { url?: unknown };
  try {
    body = (await req.json()) as { url?: unknown };
  } catch {
    return problem(400, "Invalid JSON");
  }

  try {
    return NextResponse.json(await importMarkdownFromUrl(body?.url));
  } catch (e) {
    return toErrorResponse(e);
  }
}
