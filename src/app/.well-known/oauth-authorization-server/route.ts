import { oauthServerMetadata } from "booklet-api-client";
import { getSiteOrigin } from "@/lib/site-url";
import { OAUTH_CORS, preflight } from "@/lib/oauth/http";

export const runtime = "nodejs";

/** RFC 8414 authorization server metadata. */
export function GET(req: Request) {
  return Response.json(oauthServerMetadata(getSiteOrigin(req)), {
    headers: { ...OAUTH_CORS, "Cache-Control": "public, max-age=3600" },
  });
}

export const OPTIONS = preflight;
