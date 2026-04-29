/**
 * Stubs @vercel/og files to prevent ~1.5 MB of WASM from being bundled into
 * the Cloudflare Worker (which would exceed the 3 MiB free-tier limit).
 *
 * Root cause: OpenNext's patchTurbopackRuntime plugin unconditionally patches
 * the Turbopack runtime to add:
 *   case "next/dist/compiled/@vercel/og/index.node.js":
 *     $RAW = await import("next/dist/compiled/@vercel/og/index.edge.js");
 *
 * This happens for every Turbopack app regardless of whether ImageResponse is
 * used. index.edge.js has static ESM imports for resvg.wasm (1346 KB) and
 * yoga.wasm (87 KB) — wrangler bundles those as WASM modules, pushing the
 * gzipped Worker over the 3 MiB free-tier limit.
 *
 * Fix: replace index.edge.js with a no-WASM stub, and replace the WASM files
 * with minimal 8-byte valid WASM binaries. The Turbopack patch still runs and
 * imports the stub, but no WASM is bundled.
 *
 * We don't use ImageResponse in this project, so these stubs are safe.
 */
const fs = require("fs");
const path = require("path");

const ogDir = path.join(
  __dirname,
  "../node_modules/next/dist/compiled/@vercel/og"
);

// Stub index.edge.js — replaces 797 KB JS + 1432 KB WASM with a tiny no-op
const edgeStub = `// @vercel/og stub — WASM removed to stay under CF Workers 3 MiB limit
export class ImageResponse extends Response {
  constructor() {
    throw new Error("ImageResponse is not available in this environment");
  }
}
export default { ImageResponse };
`;

// Minimal valid WebAssembly binary: magic (\\0asm) + version (1)
// 8 bytes vs 1346 KB / 87 KB originals
const emptyWasm = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

const stubs = [
  { file: "index.edge.js", content: edgeStub, type: "text" },
  { file: "resvg.wasm", content: emptyWasm, type: "binary" },
  { file: "yoga.wasm", content: emptyWasm, type: "binary" },
];

let ok = true;
for (const { file, content, type } of stubs) {
  const target = path.join(ogDir, file);
  if (!fs.existsSync(target)) {
    console.warn(`⚠  Could not find ${file} to stub — path: ${target}`);
    ok = false;
    continue;
  }
  if (type === "binary") {
    fs.writeFileSync(target, content);
  } else {
    fs.writeFileSync(target, content, "utf8");
  }
  console.log(`✓  Stubbed @vercel/og/${file}`);
}

if (ok) {
  console.log("✓  @vercel/og stubs applied — WASM excluded from CF Worker bundle");
}
