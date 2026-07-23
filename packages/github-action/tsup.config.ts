import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  // CJS bundle: GitHub's node20 action runner does `node dist/main.js`
  // directly with no install step — dist/ is committed as-is (see
  // .gitignore's exception for packages/github-action/dist/), so every
  // dependency (@actions/core, booklet-api-client, zod) must be inlined
  // here rather than resolved from node_modules at runtime.
  format: ["cjs"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  bundle: true,
  splitting: false,
  minify: false,
  sourcemap: false,
  dts: false,
  noExternal: ["@actions/core", "booklet-api-client", "zod"],
});
