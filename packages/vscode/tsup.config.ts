import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/extension.ts"],
  format: ["cjs"],
  target: "node18",
  platform: "node",
  outDir: "dist",
  clean: true,
  bundle: true,
  splitting: false,
  minify: false,
  // vscode.d.ts has no runtime module — the Extension Host injects the real
  // "vscode" module at load time, so it must stay external, never bundled.
  external: ["vscode"],
  noExternal: ["readable-api-client", "zod"],
  sourcemap: true,
  dts: false,
});
