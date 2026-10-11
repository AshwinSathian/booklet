// Booklet's fallback, for when the origin behind the tunnel cannot be reached.
//
// Every request goes to the origin as it came. The Worker answers in the
// origin's place only when there is no origin to answer:
//
//   - the fetch throws, or
//   - Cloudflare answers 520 to 530 (530 with error 1033 is "the tunnel has
//     no connection"), or
//   - a 502, 503 or 504 comes back without the Content-Security-Policy
//     header that Booklet's own middleware puts on every page and API
//     response. That is cloudflared or Cloudflare speaking, not the app.
//
// A 5xx the app itself sent (it carries that header) is passed through: it
// is the app's answer and may say something this page cannot.
//
// The body of a request is never read here and a request is never sent
// twice, so a POST that half-arrived is not replayed.

const RETRY_AFTER_SECONDS = 120;

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="60">
<title>Booklet is not reachable right now</title>
<style>
:root{color-scheme:light dark}
body{margin:0;min-height:100vh;display:flex;align-items:center;background:#fbfaf7;color:#16150f;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.6}
main{max-width:34rem;margin:0 auto;padding:3rem 1.5rem}
.mark{display:flex;align-items:center;gap:.6rem;margin-bottom:2.5rem;font:600 1.0625rem Georgia,"Times New Roman",serif}
h1{margin:0 0 .75rem;font:500 2rem/1.15 Georgia,"Times New Roman",serif;letter-spacing:-.02em}
p{margin:0 0 1rem;color:#45433b}
.small{font-size:.875rem;color:#6b685e}
@media (prefers-color-scheme:dark){body{background:#121110;color:#f4f1ea}p{color:#c9c5ba}.small{color:#9c988c}}
</style>
</head>
<body>
<main>
<div class="mark">
<svg width="28" height="28" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="112" fill="#16150f"/><path d="M138.7 138.7C138.7 121 153 106.700 170.7 106.700H324.300L373.300 155.700V373.300C373.300 390.900 359 405.300 341.300 405.300H170.700C153 405.300 138.700 390.900 138.700 373.300V138.700Z" fill="#fbfaf7"/><rect x="185.600" y="196.800" width="147.200" height="48" rx="8" fill="#ffd84d"/><rect x="185.600" y="276.800" width="98.100" height="24" rx="12" fill="#16150f" fill-opacity=".32"/></svg>
Booklet
</div>
<h1>Booklet is not reachable right now</h1>
<p>Booklet cannot serve this page at the moment.</p>
<p>This page tries again every minute, or you can reload it.</p>
<p class="small">Booklet is in public beta. If you were writing in the editor, your draft is in your browser as of your last pause in typing.</p>
</main>
</body>
</html>
`;

const HEADERS = {
  "cache-control": "no-store",
  "retry-after": String(RETRY_AFTER_SECONDS),
  "x-robots-tag": "noindex",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-booklet-fallback": "1",
};

function fallback(request) {
  const wantsPage = (request.method === "GET" || request.method === "HEAD") && (request.headers.get("accept") ?? "").includes("text/html");
  if (wantsPage) {
    return new Response(request.method === "HEAD" ? null : PAGE, { status: 503, headers: { ...HEADERS, "content-type": "text/html; charset=utf-8" } });
  }
  // The shape the API uses for every error (RFC 9457).
  const problem = { type: "about:blank", title: "Service Unavailable", status: 503, detail: "Booklet is not reachable right now. Try again in a few minutes." };
  return new Response(request.method === "HEAD" ? null : JSON.stringify(problem), { status: 503, headers: { ...HEADERS, "content-type": "application/problem+json" } });
}

/** True when this response was not written by Booklet: the origin was not there to write one. */
export function originIsDown(response) {
  if (response.status >= 520 && response.status <= 530) return true;
  if (response.status === 502 || response.status === 503 || response.status === 504) return !response.headers.has("content-security-policy");
  return false;
}

const worker = {
  async fetch(request, env, ctx) {
    // If this Worker itself fails, the request goes to the origin as if the Worker were not there.
    ctx?.passThroughOnException?.();
    // ORIGIN is set only on the preview copy, to point it at a host that is down.
    const target = env.ORIGIN ? new Request(new URL(new URL(request.url).pathname + new URL(request.url).search, env.ORIGIN), request) : request;
    let response;
    try {
      response = await fetch(target);
    } catch {
      return fallback(request);
    }
    return originIsDown(response) ? fallback(request) : response;
  },
};

export default worker;
