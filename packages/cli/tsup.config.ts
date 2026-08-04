import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

export default defineConfig({
  entry: ["src/index.ts"],
  // CJS is correct for a CLI binary: native require() works for all deps including
  // CJS packages like commander. ESM + noExternal breaks because bundled CJS code
  // calls require("events") which throws in ESM context without a real require shim.
  format: ["cjs"],
  target: "node18",
  platform: "node",
  outDir: "dist",
  clean: true,
  bundle: true,
  splitting: false,
  minify: false,
  sourcemap: false,
  dts: false,
  // Bundle pure-JS deps into the output for a single-file CLI. @napi-rs/keyring
  // is a native (napi/Rust) binding — it ships a .node file per platform and
  // cannot be bundled into one JS file, so it stays a real npm dependency
  // (external) and is installed normally alongside its platform-specific
  // optionalDependencies, the same pattern esbuild/sharp use. Everything else
  // still bundles, so this is no longer a literal zero-runtime-dependency
  // package, but it is still a single JS entrypoint plus one native addon.
  noExternal: ["commander", "booklet-api-client", "zod"],
  external: ["@napi-rs/keyring"],
  banner: {
    js: "#!/usr/bin/env node",
  },
  define: {
    __CLI_VERSION__: JSON.stringify(version),
  },
});
