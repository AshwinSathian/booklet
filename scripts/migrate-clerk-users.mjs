#!/usr/bin/env node
/**
 * One-time (rerunnable) migration off Clerk — see PLAN-backend-auth-migration.md.
 *
 * Creates a local `users` row for every Clerk user, preserving the Clerk
 * user ID as the new row's `_id`. Clerk IDs are already opaque random
 * strings with no external meaning once Clerk is gone, so keeping them
 * avoids remapping the `user_id` foreign key across six collections
 * (pages, collections, collection_members, api_keys, webhooks, drafts).
 *
 * For every user that doesn't yet have a password set, prints a one-time
 * /claim link (30-day TTL) to stdout for the admin to share manually — the
 * same "signed link, no email sent" pattern already used for team invites
 * (src/lib/invite-token.ts). Never reissues a link for an account that
 * already has a password (prevents this tool from becoming a password-reset
 * backdoor on a second run).
 *
 * Idempotent: safe to re-run. Upserts by `_id`, never touches an existing
 * `password_hash`.
 *
 * Requires env vars: MONGODB_URI, CLERK_SECRET_KEY (Clerk Backend API —
 * only needed for this one-time migration; safe to revoke once every user
 * has claimed), CLAIM_TOKEN_SECRET. Optional: SITE_URL (defaults to
 * NEXT_PUBLIC_SITE_URL, then a hardcoded production fallback) for the
 * printed links.
 *
 * Usage: node scripts/migrate-clerk-users.mjs
 */

import { MongoClient } from "mongodb";
import { SignJWT } from "jose";

const MONGODB_URI = process.env.MONGODB_URI;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const CLAIM_TOKEN_SECRET = process.env.CLAIM_TOKEN_SECRET;
const SITE_URL =
  process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://booklet.ashwinsathian.com";
const CLAIM_TTL_SECONDS = 30 * 24 * 60 * 60;
const CLERK_PAGE_SIZE = 100;

for (const [name, value] of Object.entries({ MONGODB_URI, CLERK_SECRET_KEY, CLAIM_TOKEN_SECRET })) {
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
}

async function fetchAllClerkUsers() {
  const users = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(`https://api.clerk.com/v1/users?limit=${CLERK_PAGE_SIZE}&offset=${offset}`, {
      headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
    });
    if (!res.ok) {
      throw new Error(`Clerk API error ${res.status}: ${await res.text()}`);
    }
    const page = await res.json();
    users.push(...page);
    if (page.length < CLERK_PAGE_SIZE) break;
    offset += CLERK_PAGE_SIZE;
  }
  return users;
}

function primaryEmail(clerkUser) {
  const addrs = clerkUser.email_addresses ?? [];
  const primary = addrs.find((e) => e.id === clerkUser.primary_email_address_id);
  return (primary ?? addrs[0])?.email_address ?? null;
}

function displayName(clerkUser) {
  if (clerkUser.first_name && clerkUser.last_name) return `${clerkUser.first_name} ${clerkUser.last_name}`;
  if (clerkUser.first_name) return clerkUser.first_name;
  if (clerkUser.username) return clerkUser.username;
  return null;
}

async function signClaimToken(userId) {
  const secret = new TextEncoder().encode(CLAIM_TOKEN_SECRET);
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${CLAIM_TTL_SECONDS}s`)
    .setIssuedAt()
    .sign(secret);
}

async function main() {
  const clerkUsers = await fetchAllClerkUsers();
  console.log(`Fetched ${clerkUsers.length} users from Clerk.`);

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const users = client.db("booklet").collection("users");

  let created = 0;
  let alreadyClaimed = 0;
  let linksIssued = 0;
  let skipped = 0;

  for (const cu of clerkUsers) {
    const email = primaryEmail(cu);
    if (!email) {
      console.warn(`Skipping Clerk user ${cu.id} — no email address on file.`);
      skipped += 1;
      continue;
    }

    const existing = await users.findOne({ _id: cu.id });

    if (!existing) {
      await users.insertOne({
        _id: cu.id,
        email: email.toLowerCase(),
        password_hash: null,
        display_name: displayName(cu),
        plan: "free",
        created_at: cu.created_at ? new Date(cu.created_at).toISOString() : new Date().toISOString(),
      });
      created += 1;
    } else if (!existing.email || !existing.display_name) {
      // Backfill a doc that predates this migration (e.g. was upserted by
      // the old Clerk-era ensureDbUser with a null email) — never touches
      // password_hash.
      await users.updateOne(
        { _id: cu.id },
        { $set: { email: existing.email ?? email.toLowerCase(), display_name: existing.display_name ?? displayName(cu) } },
      );
    }

    const passwordHash = existing?.password_hash ?? null;
    if (passwordHash) {
      alreadyClaimed += 1;
      continue;
    }

    const token = await signClaimToken(cu.id);
    console.log(`${email}\t${SITE_URL}/claim?token=${token}`);
    linksIssued += 1;
  }

  await client.close();

  console.log("");
  console.log(
    `Done. ${created} new user rows created, ${alreadyClaimed} already claimed, ${linksIssued} claim links issued, ${skipped} skipped (no email).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
