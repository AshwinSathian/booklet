import { llmsFullTxt } from "@/lib/llms";

export const runtime = "nodejs";

export function GET() {
  return new Response(llmsFullTxt(), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
