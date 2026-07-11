import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  // Dual CJS+ESM: packages/cli and packages/github-action are CJS-built,
  // mcp-server and the Next.js app resolve ESM. Both need to import this.
  format: ["cjs", "esm"],
  target: "node18",
  platform: "node",
  outDir: "dist",
  clean: true,
  bundle: true,
  splitting: false,
  minify: false,
  sourcemap: false,
  dts: true,
});
