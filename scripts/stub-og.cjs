/**
 * Replaces next/dist/server/og/image-response.js with a stub that has no
 * @vercel/og dependency. This prevents the WASM files (resvg.wasm, yoga.wasm)
 * from being bundled into the Cloudflare Worker, which would exceed the 3 MiB
 * free-tier limit.
 *
 * Root cause: the standalone NFT tracer picks up the dynamic import inside
 * Next.js's ImageResponse, which causes patchVercelOgLibrary (OpenNext) to
 * set useOg=true and include index.edge.js + ~1.4 MB of WASM in the bundle.
 *
 * We don't use ImageResponse anywhere in this project, so stubbing it is safe.
 */
const fs = require("fs");
const path = require("path");

const target = path.join(
  __dirname,
  "../node_modules/next/dist/server/og/image-response.js"
);

const stub = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
Object.defineProperty(exports, "ImageResponse", {
  enumerable: true,
  get: function () { return ImageResponse; },
});
class ImageResponse extends Response {
  constructor() {
    throw new Error("ImageResponse is not available in this environment");
  }
}
`;

if (fs.existsSync(target)) {
  fs.writeFileSync(target, stub);
  console.log("✓ Stubbed next/dist/server/og/image-response.js (no @vercel/og WASM)");
} else {
  console.warn("⚠ Could not find image-response.js to stub — path:", target);
}
