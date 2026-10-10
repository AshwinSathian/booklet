import { buildOpenApi } from "booklet-api-client";
import pkg from "../../../../../packages/shared/package.json";

// The document is the same for every caller, so it is built once at build time.
export const dynamic = "force-static";

export function GET() {
  return Response.json(buildOpenApi(pkg.version), {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" },
  });
}
