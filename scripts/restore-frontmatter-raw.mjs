#!/usr/bin/env node
/**
 * One-time migration for the deploy that made the stored Markdown keep its
 * frontmatter (roadmap Phase 5b).
 *
 * Before it, POST /api/v1/publish stored a page's Markdown without the
 * frontmatter and kept the fields only on the page record
 * (`pages.frontmatter_meta`). From this deploy on, updating a page takes
 * its title, type and frontmatter fields from the submitted Markdown. So
 * for those older pages the first edit would drop their tags, author and
 * description. This writes the frontmatter back into the stored Markdown.
 *
 *   MONGODB_URI=… node scripts/restore-frontmatter-raw.mjs --dry-run
 *   MONGODB_URI=… node scripts/restore-frontmatter-raw.mjs
 *
 * Take a mongodump first. Idempotent: a document whose Markdown already
 * opens with a frontmatter block is left alone, so a second run changes
 * nothing. The rendered blocks are not touched.
 */
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set.");
  process.exit(1);
}
const dryRun = process.argv.includes("--dry-run");

const client = await new MongoClient(uri).connect();
try {
  // Same hardcoded database name as src/lib/mongodb.ts.
  const db = client.db("booklet");
  let restored = 0;
  for await (const page of db.collection("pages").find({ frontmatter_meta: { $ne: null } })) {
    const meta = page.frontmatter_meta;
    if (!meta || typeof meta !== "object" || Object.keys(meta).length === 0) continue;
    const record = await db.collection("docs").findOne({ _id: page._id });
    const raw = record?.doc?.raw;
    if (typeof raw !== "string" || raw.trimStart().startsWith("---")) continue;
    // JSON values are valid YAML, as in packages/shared/src/frontmatter.ts.
    const block = Object.entries(meta)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join("\n");
    restored += 1;
    if (!dryRun) {
      await db.collection("docs").updateOne({ _id: page._id }, { $set: { "doc.raw": `---\n${block}\n---\n\n${raw}` } });
    }
  }
  console.log(`${dryRun ? "Would restore" : "Restored"} frontmatter in the Markdown of ${restored} page(s).`);
} finally {
  await client.close();
}
