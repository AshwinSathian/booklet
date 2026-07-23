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
  // Bundle all deps into the output — zero runtime deps, single file
  noExternal: ["commander", "booklet-api-client", "zod"],
  banner: {
    js: "#!/usr/bin/env node",
  },
  define: {
    __CLI_VERSION__: JSON.stringify(version),
  },
});
