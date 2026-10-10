import { NextResponse } from "next/server";

// The token, registration, revocation and metadata endpoints are called by
// OAuth clients, some of them browser-based (MCP Inspector, web IDEs). They
// carry no cookies and need no ambient authority, so any origin may call
// them.
export const OAUTH_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" };

export function oauthJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { ...OAUTH_CORS, ...NO_STORE } });
}

/** `{ error, error_description }`, the error shape of RFC 6749 section 5.2. */
export function oauthError(error: string, description: string, status = 400): NextResponse {
  return oauthJson({ error, error_description: description }, status);
}

export function preflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: OAUTH_CORS });
}

/** Reads an application/x-www-form-urlencoded body into a plain object; null if it is not one. */
export async function readForm(req: Request): Promise<Record<string, string> | null> {
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/x-www-form-urlencoded")) return null;
  const text = await req.text();
  if (text.length > 10_000) return null;
  return Object.fromEntries(new URLSearchParams(text));
}
