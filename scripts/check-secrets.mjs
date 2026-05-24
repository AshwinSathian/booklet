/**
 * Pre-deploy guard: verifies all required Cloudflare Worker secrets exist
 * before wrangler build/deploy runs. Fails loudly so the deploy is aborted
 * rather than silently shipping a broken worker.
 *
 * Usage (called automatically by `npm run deploy`):
 *   node scripts/check-secrets.mjs
 *
 * Required secrets (set once via `wrangler secret put <NAME>`):
 *   MONGODB_URI       — MongoDB Atlas connection string
 *   CLERK_SECRET_KEY  — Clerk backend secret key (sk_live_...)
 */

import { execSync } from "node:child_process";

const REQUIRED_SECRETS = ["MONGODB_URI", "CLERK_SECRET_KEY"];

function listSecrets() {
  try {
    const out = execSync("npx wrangler secret list --format json 2>/dev/null", {
      encoding: "utf8",
    });
    const parsed = JSON.parse(out);
    return parsed.map((s) => s.name);
  } catch {
    // wrangler not authenticated or no internet — skip check, let wrangler deploy fail naturally
    console.warn("⚠  Could not reach Cloudflare to verify secrets — proceeding anyway.");
    return null;
  }
}

const present = listSecrets();

if (present !== null) {
  const missing = REQUIRED_SECRETS.filter((s) => !present.includes(s));

  if (missing.length > 0) {
    console.error("");
    console.error("✗  Missing Cloudflare Worker secrets:");
    for (const name of missing) {
      console.error(`     ${name}`);
    }
    console.error("");
    console.error("   Set each one with:");
    console.error("     printf '%s' '<value>' | npx wrangler secret put <NAME>");
    console.error("");
    process.exit(1);
  }

  console.log(`✓  All required secrets present (${REQUIRED_SECRETS.join(", ")})`);
}
