#!/usr/bin/env node
/**
 * One-time migration for the deploy that introduced anonymous page expiry:
 * anonymous pages published before it get expires_at = now + 90 days.
 *
 *   MONGODB_URI=… node scripts/backfill-anonymous-expiry.mjs --dry-run
 *   MONGODB_URI=… node scripts/backfill-anonymous-expiry.mjs
 *
 * Idempotent: a document that already has expires_at is left alone, so a
 * second run stamps nothing. Logic and its safety rules live in
 * src/lib/db/expiry.mjs (shared with the app, covered by
 * tests/unit/anonymous-expiry.spec.ts).
 */
import { MongoClient } from "mongodb";
import { backfillAnonymousExpiry } from "../src/lib/db/expiry.mjs";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set.");
  process.exit(1);
}
const dryRun = process.argv.includes("--dry-run");

const client = await new MongoClient(uri).connect();
try {
  // Same hardcoded database name as src/lib/mongodb.ts.
  const stamped = await backfillAnonymousExpiry(client.db("booklet"), { dryRun });
  console.log(`${dryRun ? "Would stamp" : "Stamped"} ${stamped} anonymous document(s) with expires_at = now + 90 days.`);
} finally {
  await client.close();
}
