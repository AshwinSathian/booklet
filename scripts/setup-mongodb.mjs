/**
 * One-time setup script: creates all MongoDB collections and indexes.
 * Run once against a fresh Atlas cluster:
 *
 *   MONGODB_URI="mongodb+srv://..." node scripts/setup-mongodb.mjs
 */

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required.");
  process.exit(1);
}

const client = new MongoClient(uri);

async function main() {
  await client.connect();
  const db = client.db("readable");

  // --- users ---
  await db.collection("users").createIndex({ _id: 1 }); // already primary; explicit for clarity

  // --- pages ---
  await db.collection("pages").createIndex({ user_id: 1, created_at: -1 });
  await db.collection("pages").createIndex(
    { slug: 1 },
    { unique: true, sparse: true }, // slug is optional; unique when present
  );

  // --- api_keys ---
  await db.collection("api_keys").createIndex({ user_id: 1, created_at: -1 });
  await db.collection("api_keys").createIndex({ key_hash: 1 }, { unique: true });

  // --- docs ---
  // TTL index: MongoDB automatically deletes docs when expiresAt is reached.
  // Permanent docs (owned pages) have no expiresAt field, so the TTL index ignores them.
  await db.collection("docs").createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, sparse: true },
  );

  // --- rate_limits ---
  // Bucket keys expire ~2 minutes after creation.
  await db.collection("rate_limits").createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 },
  );

  console.log("MongoDB indexes created successfully.");
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
