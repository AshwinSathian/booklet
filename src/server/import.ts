/**
 * "Import from URL": fetches one public Markdown file from GitHub into a
 * draft. It is the only place the server makes a GET to a URL a visitor
 * typed, so it is narrow on purpose:
 *
 *  - Only `raw.githubusercontent.com`, over https, on the default port. A
 *    `github.com/<owner>/<repo>/blob/<ref>/<path>` link is rewritten to its
 *    raw URL here; github.com itself is never fetched.
 *  - The host is resolved once through the SSRF guard and the connection is
 *    pinned to that checked address, as for webhooks (see pinnedLookup).
 *  - A redirect is followed only to the same host, and is checked again.
 *  - The body is cut off at MAX_BYTES while it streams, and a document over
 *    the editor's character limit is refused, not shortened.
 *
 * It returns text for a draft. Nothing is published here; a draft that is
 * later published goes through buildDocument like any other.
 */

import https from "node:https";
import http from "node:http";
import { STORAGE } from "@/lib/constants";
import { bareHostname, pinnedLookup, resolveHostForDelivery, type HostResolveResult } from "@/lib/ssrf-guard";
import { ServiceError } from "./errors";

const RAW_HOST = "raw.githubusercontent.com";
const MARKDOWN_PATH = /\.(md|markdown|mdx)$/i;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;
/** A character is at most 4 bytes of UTF-8, so no document within the character limit is larger. */
const MAX_BYTES = STORAGE.maxInputChars * 4;

const refuse = (message: string, status = 422) => new ServiceError("IMPORT_REFUSED", message, status);

/** The raw.githubusercontent.com URL for a GitHub file link, or a 422. */
export function toRawGithubUrl(input: unknown): URL {
  let url: URL;
  try {
    url = new URL(typeof input === "string" ? input.trim() : "");
  } catch {
    throw refuse("Enter the full URL of a Markdown file on GitHub.");
  }
  if (url.protocol !== "https:" || url.port || url.username || url.password) {
    throw refuse("Only https://github.com and https://raw.githubusercontent.com links can be imported.");
  }

  let path: string;
  if (url.hostname === "github.com") {
    // /<owner>/<repo>/blob/<ref>/<path...>
    const [owner, repo, kind, ...rest] = url.pathname.split("/").filter(Boolean);
    if (kind !== "blob" || !owner || !repo || rest.length < 2) {
      throw refuse("Use a link to a file, like https://github.com/owner/repo/blob/main/README.md.");
    }
    path = `/${owner}/${repo}/${rest.join("/")}`;
  } else if (url.hostname === RAW_HOST) {
    path = url.pathname;
  } else {
    throw refuse("Only https://github.com and https://raw.githubusercontent.com links can be imported.");
  }
  if (!MARKDOWN_PATH.test(path)) throw refuse("That link is not a Markdown file (.md, .markdown or .mdx).");

  // Query and fragment are dropped: a `?token=` for a private file is not
  // something to send on, and nothing else is meaningful to the raw host.
  return new URL(`https://${RAW_HOST}${path}`);
}

type PinnedResponse = { status: number; location: string | null; contentType: string; body: Buffer; truncated: boolean };

/** GET `url` with the TCP connection pinned to an address that already passed the SSRF guard. Never follows a redirect. */
export function pinnedGet(url: URL, address: string, family: 4 | 6, maxBytes = MAX_BYTES): Promise<PinnedResponse> {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === "https:";
    const req = (isHttps ? https : http).request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: { Host: url.host, Accept: "text/plain, text/markdown, text/*;q=0.9", "User-Agent": "Booklet-Import" },
        timeout: TIMEOUT_MS,
        lookup: pinnedLookup(address, family),
        ...(isHttps ? { servername: url.hostname } : {}),
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        const finish = (truncated: boolean) =>
          resolve({
            status: res.statusCode ?? 0,
            location: typeof res.headers.location === "string" ? res.headers.location : null,
            contentType: String(res.headers["content-type"] ?? ""),
            body: Buffer.concat(chunks),
            truncated,
          });
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            // Stop reading: the answer is "too large" whatever follows.
            finish(true);
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => finish(false));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

export type ImportDeps = {
  resolve: (hostname: string) => Promise<HostResolveResult>;
  get: (url: URL, address: string, family: 4 | 6) => Promise<PinnedResponse>;
};
const DEFAULT_DEPS: ImportDeps = { resolve: resolveHostForDelivery, get: pinnedGet };

const TOO_LARGE = () =>
  refuse(`That file is over the ${STORAGE.maxInputChars.toLocaleString("en-US")}-character limit for one document.`, 413);

/** The Markdown at a GitHub file URL, for a new draft. Throws a ServiceError the route hands to toErrorResponse. */
export async function importMarkdownFromUrl(
  input: unknown,
  deps: ImportDeps = DEFAULT_DEPS,
): Promise<{ raw: string; title: string; source_url: string }> {
  let url = toRawGithubUrl(input);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const resolved = await deps.resolve(bareHostname(url));
    if (!resolved.safe || resolved.addresses.length === 0) {
      throw refuse("That address cannot be imported from.");
    }
    const { address, family } = resolved.addresses[0];

    let res: PinnedResponse;
    try {
      res = await deps.get(url, address, family);
    } catch {
      throw refuse("GitHub did not answer. Try again in a moment.", 502);
    }

    if (res.status >= 300 && res.status < 400) {
      let next: URL | null = null;
      try {
        next = res.location ? new URL(res.location, url) : null;
      } catch {
        next = null;
      }
      if (!next || next.protocol !== "https:" || next.host !== url.host) {
        throw refuse("That link redirects somewhere else, so it was not imported.");
      }
      url = next;
      continue;
    }
    if (res.status === 404) throw refuse("No public file at that URL. Files in private repositories cannot be imported.", 404);
    if (res.status !== 200) throw refuse("GitHub did not return the file. Try again in a moment.", 502);
    if (res.truncated) throw TOO_LARGE();
    if (!/^text\//i.test(res.contentType)) throw refuse("That link is not a text file.");

    // `fatal`: a binary file with a .md name is refused instead of imported as mojibake.
    let raw: string;
    try {
      raw = new TextDecoder("utf-8", { fatal: true }).decode(res.body).replace(/^\uFEFF/, "");
    } catch {
      throw refuse("That file is not UTF-8 text.");
    }
    if (raw.length > STORAGE.maxInputChars) throw TOO_LARGE();
    if (!raw.trim()) throw refuse("That file is empty.");

    const file = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    return { raw, title: file.replace(MARKDOWN_PATH, "") || "Imported document", source_url: url.toString() };
  }
  throw refuse("That link redirects too many times.");
}
