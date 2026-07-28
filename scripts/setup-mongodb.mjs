/**
 * Standalone index-setup script. Indexes are now also created automatically
 * at server startup (see src/instrumentation.ts), so running this script by
 * hand is optional in most environments — but it's still useful to run
 * explicitly against a fresh Atlas cluster before the first request, so
 * that request doesn't pay the index-build cost.
 *
 * Both this script and the startup hook delegate to the single shared index
 * list in src/lib/db/index-specs.mjs so they can never drift apart.
 *
 *   MONGODB_URI="mongodb+srv://..." node scripts/setup-mongodb.mjs
 */

import { MongoClient } from "mongodb";
import { ensureIndexes } from "../src/lib/db/index-specs.mjs";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required.");
  process.exit(1);
}

const client = new MongoClient(uri);

async function main() {
  await client.connect();
  const db = client.db("booklet");

  await ensureIndexes(db);

  console.log("MongoDB indexes created successfully.");
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
