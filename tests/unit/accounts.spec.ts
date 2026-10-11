import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { useTestEnv } from "./helpers/pages";
import { sessionCookieFor, withRequestScope } from "./helpers/request-scope";
import { getDb } from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/db/index-specs.mjs";
import { createApiKey, createPageRecord, getPageRecord, updatePageRecord } from "@/lib/db";
import { createUser, findSessionByHash, getIdentitiesByUser, getUserByEmail, getUserById, markEmailVerified, setUserEmail } from "@/lib/db/auth";
import { generateRawKey, hashApiKey } from "@/lib/api-key";
import { hashUserPassword } from "@/lib/auth/password";
import { hashSessionToken } from "@/lib/auth/session-token";
import { createId } from "@/lib/id";
import { metadataFetcher } from "@/lib/oauth/clients";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { parseToBlocks } from "@/lib/parse";
import { getDoc, putDoc } from "@/lib/storage";
import { zipTextFiles } from "@/lib/zip";
import {
  disconnectApp,
  exchangeAuthorizationCode,
  issueAuthorizationCode,
  listConnectedApps,
  oauthResource,
  verifyAccessToken,
} from "@/lib/oauth/server";
import { deleteAccount, exportPagesZip } from "@/server/account";
import { countSignInMethods, linkIdentity, resolveSsoUser, SsoLinkError } from "@/server/sso";
import { sendVerification } from "@/server/verification";
import { createHash } from "node:crypto";
import { POST as v1Publish } from "@/app/api/v1/publish/route";
import { PATCH as v1Patch } from "@/app/api/v1/pages/[id]/route";
import { POST as webPublish } from "@/app/api/publish/route";
import { POST as createKey } from "@/app/api/v1/keys/route";
import { POST as verifyEmail } from "@/app/api/auth/verify-email/route";
import { POST as changeEmail } from "@/app/api/account/email/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as report } from "@/app/api/reports/route";
import { DELETE as disconnectProvider } from "@/app/api/auth/sso/[provider]/route";
import { POST as removeAccount } from "@/app/api/account/delete/route";
import { POST as createWebhookRoute } from "@/app/api/webhooks/route";
import { POST as resendDelivery } from "@/app/api/webhooks/[id]/deliveries/[deliveryId]/resend/route";
import { POST as registerPasskey } from "@/app/api/auth/passkey/register/route";
import { PATCH as patchPageMeta } from "@/app/api/pages/[id]/route";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { markDocTakenDown } from "@/lib/storage";
import { markPageTakenDown } from "@/lib/db";
import { handleCreateDocument } from "../../mcp-server/src/tools.js";
import { createCollectionRecord, getCollectionMember, removeCollectionMember, updateCollectionRecord } from "@/lib/db";
import { signInviteToken } from "@/lib/invite-token";
import JoinPage from "@/app/t/join/page";

// Phase 5a: email verification, provider sign-in linking, Turnstile, and the
// account page's export, delete and connected-apps actions.
//
// Serial, because several tests switch features on through process.env and
// a worker's environment is shared by every spec it runs.
test.describe.configure({ mode: "serial" });

const ORIGIN = "http://localhost";
const userIds: string[] = [];
const pageIds: string[] = [];
const ip = () => ({ "cf-connecting-ip": `2001:db8::${crypto.randomUUID().slice(0, 4)}:${crypto.randomUUID().slice(0, 4)}` });
const email = () => `acct-${crypto.randomUUID()}@example.com`;

async function newUser(opts: { verified?: boolean; password?: string } = {}) {
  const user = await createUser(
    createId(20),
    email(),
    opts.password ? await hashUserPassword(opts.password) : null,
    null,
    opts.verified ? new Date().toISOString() : null,
  );
  userIds.push(user.id);
  const rawKey = generateRawKey();
  await createApiKey(createId(10), user.id, await hashApiKey(rawKey), "test");
  return { user, rawKey, cookie: await sessionCookieFor(user.id) };
}

function publishWithKey(rawKey: string, raw = "# Hello\n\nBody.") {
  return v1Publish(
    new Request(`${ORIGIN}/api/v1/publish`, {
      method: "POST",
      headers: { authorization: `Bearer ${rawKey}`, "content-type": "application/json" },
      body: JSON.stringify({ raw }),
    }),
  );
}

function withSession(cookie: string | null, url: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  return new Request(`${ORIGIN}${url}`, {
    method: init.method ?? "POST",
    headers: { host: "localhost", origin: ORIGIN, "content-type": "application/json", ...(cookie ? { cookie } : {}), ...ip(), ...init.headers },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

async function seedPage(userId: string, raw: string, title: string, slug: string | null = null) {
  const id = createId(10);
  pageIds.push(id);
  await putDoc(id, { v: 1, createdAt: new Date().toISOString(), settings: DEFAULT_SETTINGS, blocks: parseToBlocks(raw), raw });
  await createPageRecord(id, userId, title, null, null);
  if (slug) await updatePageRecord(id, { slug });
  return id;
}

// Outbound HTTP is replaced for the whole file: Resend (captures the mail it
// was asked to send) and Turnstile siteverify (passes the token "solved").
const realFetch = globalThis.fetch;
const sentMail: Array<{ to: string; html: string }> = [];

test.beforeAll(async () => {
  useTestEnv();
  process.env.SESSION_TOKEN_PEPPER ??= "test-only-pepper-do-not-use-in-prod";
  process.env.PASSWORD_RESET_TOKEN_PEPPER ??= "test-only-pepper-do-not-use-in-prod";
  await ensureIndexes(await getDb());
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith("https://api.resend.com/")) {
      const body = JSON.parse(String(init?.body ?? (input instanceof Request ? await input.text() : "{}")));
      sentMail.push({ to: [body.to].flat()[0], html: body.html });
      return Response.json({ id: "mail_1" });
    }
    if (url.startsWith("https://challenges.cloudflare.com/")) {
      return Response.json({ success: new URLSearchParams(String(init?.body)).get("response") === "solved" });
    }
    return realFetch(input, init);
  }) as typeof fetch;
});

test.afterAll(async () => {
  globalThis.fetch = realFetch;
  for (const k of ["RESEND_API_KEY", "TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"]) delete process.env[k];
  const db = await getDb();
  const mine = { user_id: { $in: userIds } };
  await db.collection("users").deleteMany({ _id: { $in: userIds } } as never);
  for (const c of ["api_keys", "sessions", "pages", "user_identities", "passkeys", "email_verification_tokens", "oauth_tokens", "oauth_codes"]) {
    await db.collection(c).deleteMany(mine);
  }
  await db.collection("docs").deleteMany({ _id: { $in: pageIds } } as never);
  await db.collection("pages").deleteMany({ _id: { $in: pageIds } } as never);
});

/** Presses "Confirm email" with `token`, signed in as `cookie` (or signed out). */
function confirm(cookie: string | null, token: string) {
  const req = withSession(cookie, "/api/auth/verify-email", { body: { token } });
  return withRequestScope(req, () => verifyEmail(req));
}

/** The verification link's token, read out of the mail "sent" to `to`. */
async function tokenMailedTo(to: string): Promise<string> {
  await expect.poll(() => sentMail.some((m) => m.to === to)).toBe(true);
  const html = sentMail.findLast((m) => m.to === to)!.html;
  return decodeURIComponent(/verify-email\?token=([^"&]+)/.exec(html)![1]);
}

test.describe("email verification", () => {
  test.beforeAll(() => {
    process.env.RESEND_API_KEY = "re_test";
  });
  test.afterAll(() => {
    delete process.env.RESEND_API_KEY;
  });

  test("an unverified account gets 403 on publish through an API key, and 201 once verified", async () => {
    const { user, rawKey, cookie } = await newUser();

    const refused = await publishWithKey(rawKey);
    expect(refused.status).toBe(403);
    expect(refused.headers.get("content-type")).toContain("application/problem+json");
    expect((await refused.json()).code).toBe("EMAIL_UNVERIFIED");

    await sendVerification(user, ORIGIN);
    const token = await tokenMailedTo(user.email!);
    const res = await confirm(cookie, token);
    expect(res.status).toBe(200);
    expect((await getUserById(user.id))?.email_verified_at).toBeTruthy();

    const ok = await publishWithKey(rawKey);
    expect(ok.status).toBe(201);
    pageIds.push((await ok.json()).id);
  });

  test("a verification link works once, and not after a newer link replaced it", async () => {
    const { user, cookie } = await newUser();
    await sendVerification(user, ORIGIN);
    const first = await tokenMailedTo(user.email!);
    sentMail.length = 0;
    await sendVerification(user, ORIGIN);
    const second = await tokenMailedTo(user.email!);

    expect((await confirm(cookie, first)).status).toBe(400);
    expect((await confirm(cookie, second)).status).toBe(200);
    expect((await confirm(cookie, second)).status).toBe(400);
  });

  test("the link alone confirms nothing: it needs the session of the account it was sent for", async () => {
    // Someone registered an address they do not own. Its owner gets the
    // mail and presses the button, signed out or signed in as themselves.
    // Neither may verify an account whose password the first person chose.
    const { user } = await newUser({ password: "attacker-chosen" });
    const other = await newUser({ verified: true });

    await sendVerification(user, ORIGIN);
    const token = await tokenMailedTo(user.email!);
    expect((await confirm(null, token)).status).toBe(401);
    expect((await getUserById(user.id))?.email_verified_at).toBeFalsy();
    // Signed out, the token was not spent.
    expect((await confirm(other.cookie, token)).status).toBe(400);
    expect((await getUserById(user.id))?.email_verified_at).toBeFalsy();
  });

  test("an unverified account cannot publish from the editor, update a page, or create an API key", async () => {
    const { user, rawKey, cookie } = await newUser();

    const web = withSession(cookie, "/api/publish", { body: { raw: "# Hi\n\nBody." } });
    const webRes = await withRequestScope(web, () => webPublish(web));
    // Refused, and not published as an anonymous page instead.
    expect(webRes.status).toBe(403);

    const id = await seedPage(user.id, "# Old\n\nBody.", "Old");
    const patch = await v1Patch(
      new Request(`${ORIGIN}/api/v1/pages/${id}`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${rawKey}`, "content-type": "application/json" },
        body: JSON.stringify({ raw: "# New\n\nBody." }),
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(patch.status).toBe(403);
    expect((await getDoc(id))?.raw).toContain("# Old");

    const key = withSession(cookie, "/api/v1/keys", { body: { label: "x" } });
    expect((await withRequestScope(key, () => createKey(key))).status).toBe(403);

    // Nor anything else that would outlast the address's owner taking the
    // account over, or that changes how a page is published.
    const hook = withSession(cookie, "/api/webhooks", { body: { url: "https://example.com/hook", events: ["page.published"] } });
    expect((await withRequestScope(hook, () => createWebhookRoute(hook))).status).toBe(403);
    // The gate is checked before the delivery is looked up, so the ids need not exist.
    const resend = withSession(cookie, "/api/webhooks/w/deliveries/d/resend");
    expect(
      (await withRequestScope(resend, () => resendDelivery(resend, { params: Promise.resolve({ id: "w", deliveryId: "d" }) }))).status,
    ).toBe(403);
    const passkey = withSession(cookie, "/api/auth/passkey/register", { body: {} });
    expect((await withRequestScope(passkey, () => registerPasskey(passkey))).status).toBe(403);
    const meta = withSession(cookie, `/api/pages/${id}`, { method: "PATCH", body: { visibility: "public" } });
    expect((await withRequestScope(meta, () => patchPageMeta(meta, { params: Promise.resolve({ id }) }))).status).toBe(403);
    expect((await getPageRecord(id))?.visibility).toBe("unlisted");

    const who = withSession(cookie, "/api/auth/me", { method: "GET" });
    expect((await (await withRequestScope(who, () => me())).json()).emailVerified).toBe(false);
  });

  test("the MCP create_document tool tells an unverified account what to do", async () => {
    const { rawKey } = await newUser();
    // The tool reaches the API over fetch; this file's fetch stub lets the
    // call through to the real publish handler.
    const before = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => v1Publish(new Request(input, init))) as typeof fetch;
    try {
      const result = await handleCreateDocument({ type: "adr", title: "ADR-001", body: "Context." }, rawKey, ORIGIN);
      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain("Confirm your email address first");
    } finally {
      globalThis.fetch = before;
    }
  });

  test("a team invite admits only the confirmed owner of the invited address, and not after a removal", async () => {
    process.env.INVITE_JWT_SECRET ??= "test-only-invite-secret-do-not-use-in-prod";
    const owner = await newUser();
    const invited = await newUser();
    const other = await newUser();
    await getDb().then((db) => db.collection("users").updateOne({ _id: other.user.id } as never, { $set: { email_verified_at: new Date().toISOString() } }));
    const teamId = createId(10);
    await createCollectionRecord(teamId, owner.user.id, `Team ${teamId}`, true);
    await updateCollectionRecord(teamId, { slug: `team-${teamId.toLowerCase()}` });
    const token = await signInviteToken({ teamId, invitedEmail: invited.user.email!, invitedBy: owner.user.id });
    const isMember = async (userId: string) => (await getCollectionMember(teamId, userId)) !== null;
    const open = (cookie: string) => {
      const req = withSession(cookie, "/t/join", { method: "GET" });
      return withRequestScope(req, () => JoinPage({ searchParams: Promise.resolve({ token }) }));
    };
    try {
      // Someone else holding the link.
      await open(other.cookie);
      expect(await isMember(other.user.id)).toBe(false);

      // The invited address, registered but not confirmed: anyone could have signed up with it.
      await open(invited.cookie);
      expect(await isMember(invited.user.id)).toBe(false);

      await getDb().then((db) => db.collection("users").updateOne({ _id: invited.user.id } as never, { $set: { email_verified_at: new Date().toISOString() } }));
      await expect(open(invited.cookie)).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
      expect(await isMember(invited.user.id)).toBe(true);

      // Removed by the owner: the link they joined by does not let them back in.
      await removeCollectionMember(teamId, invited.user.id);
      await open(invited.cookie);
      expect(await isMember(invited.user.id)).toBe(false);
    } finally {
      const db = await getDb();
      await db.collection("collections").deleteOne({ _id: teamId } as never);
      await db.collection("collection_members").deleteMany({ collection_id: teamId });
    }
  });

  test("with no mail configured, verification is not enforced", async () => {
    delete process.env.RESEND_API_KEY;
    try {
      const { rawKey } = await newUser();
      const res = await publishWithKey(rawKey);
      expect(res.status).toBe(201);
      pageIds.push((await res.json()).id);
    } finally {
      process.env.RESEND_API_KEY = "re_test";
    }
  });
});

test.describe("provider sign-in linking", () => {
  const profile = (address: string) => ({ providerUserId: `gh-${crypto.randomUUID()}`, email: address });

  test("a new person gets a verified account with no password, and the same identity signs in the same user", async () => {
    const p = profile(email());
    const userId = await resolveSsoUser("github", p);
    userIds.push(userId);
    const user = await getUserById(userId);
    expect(user?.email).toBe(p.email);
    expect(user?.password_hash).toBeNull();
    expect(user?.email_verified_at).toBeTruthy();
    expect(await resolveSsoUser("github", p)).toBe(userId);
    expect(await getIdentitiesByUser(userId)).toHaveLength(1);
  });

  test("links to a verified account with the same email and keeps its password", async () => {
    const { user } = await newUser({ verified: true, password: "correct horse battery" });
    expect(await resolveSsoUser("google", profile(user.email!))).toBe(user.id);
    expect((await getUserById(user.id))?.password_hash).toBeTruthy();
  });

  test("a provider sign-in is not linked to an account whose address was never verified", async () => {
    // Someone registered an address they do not own and set a password.
    // Then the address's owner arrives through a provider. Linking would
    // give the first person the owner's account.
    const { user } = await newUser({ password: "attacker-chosen" });

    await expect(resolveSsoUser("github", profile(user.email!))).rejects.toThrow("email_unverified");

    const after = await getUserById(user.id);
    expect(after?.password_hash).toBeTruthy();
    expect(after?.email_verified_at).toBeFalsy();
    expect(await getIdentitiesByUser(user.id)).toHaveLength(0);
  });

  test("where verification is enforced, an unverified account can connect only a provider account with its own address", async () => {
    process.env.RESEND_API_KEY = "re_test";
    try {
      const { user } = await newUser({ password: "password-d" });
      await expect(linkIdentity(user.id, "github", profile(email()))).rejects.toThrow("email_unverified");
      expect(await getIdentitiesByUser(user.id)).toHaveLength(0);

      await linkIdentity(user.id, "github", profile(user.email!));
      expect((await getUserById(user.id))?.email_verified_at).toBeTruthy();
    } finally {
      delete process.env.RESEND_API_KEY;
    }
  });

  test("an identity that signs in one account cannot be connected to another", async () => {
    const a = await newUser({ verified: true, password: "password-a" });
    const b = await newUser({ verified: true, password: "password-b" });
    const p = profile(a.user.email!);
    await linkIdentity(a.user.id, "github", p);
    await expect(linkIdentity(b.user.id, "github", p)).rejects.toBeInstanceOf(SsoLinkError);
    // Connecting a provider account with a different address does not verify this account's address.
    const c = await newUser({ password: "password-c" });
    await linkIdentity(c.user.id, "google", profile(email()));
    expect((await getUserById(c.user.id))?.email_verified_at).toBeFalsy();
  });

  test("the last sign-in method cannot be disconnected", async () => {
    const p = profile(email());
    const userId = await resolveSsoUser("github", p);
    userIds.push(userId);
    const cookie = await sessionCookieFor(userId);
    expect(await countSignInMethods(userId)).toBe(1);

    const req = withSession(cookie, "/api/auth/sso/github", { method: "DELETE" });
    const res = await withRequestScope(req, () => disconnectProvider(req, { params: Promise.resolve({ provider: "github" }) }));
    expect(res.status).toBe(409);
    expect(await getIdentitiesByUser(userId)).toHaveLength(1);
  });
});

test.describe("Turnstile", () => {
  test.beforeAll(() => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site";
  });
  test.afterAll(() => {
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  });

  const anonymousPublish = (body: Record<string, unknown>) => {
    const req = withSession(null, "/api/publish", { body: { raw: "# Anonymous\n\nBody.", ...body } });
    return withRequestScope(req, () => webPublish(req));
  };

  test("anonymous publish without a token, or with an unsolved one, returns 403", async () => {
    expect((await anonymousPublish({})).status).toBe(403);
    expect((await anonymousPublish({ turnstile_token: "unsolved" })).status).toBe(403);
  });

  test("anonymous publish with a solved token succeeds", async () => {
    const res = await anonymousPublish({ turnstile_token: "solved" });
    expect(res.status).toBe(200);
    pageIds.push((await res.json()).id);
  });

  test("the deploy checks' token passes when it is set and long enough, and only as an exact match", async () => {
    const secret = "b".repeat(64);
    try {
      // Not set: it is an ordinary unsolved token.
      expect((await anonymousPublish({ turnstile_token: secret })).status).toBe(403);
      process.env.TURNSTILE_BYPASS_TOKEN = secret;
      expect((await anonymousPublish({ turnstile_token: secret.slice(1) })).status).toBe(403);
      const res = await anonymousPublish({ turnstile_token: secret });
      expect(res.status).toBe(200);
      pageIds.push((await res.json()).id);
      // Too short to be a secret: ignored.
      process.env.TURNSTILE_BYPASS_TOKEN = "short";
      expect((await anonymousPublish({ turnstile_token: "short" })).status).toBe(403);
    } finally {
      delete process.env.TURNSTILE_BYPASS_TOKEN;
    }
  });

  test("a signed-in publish needs no token", async () => {
    const { cookie } = await newUser({ verified: true });
    const req = withSession(cookie, "/api/publish", { body: { raw: "# Mine\n\nBody." } });
    const res = await withRequestScope(req, () => webPublish(req));
    expect(res.status).toBe(200);
    pageIds.push((await res.json()).id);
  });

  test("the report form needs a token", async () => {
    const { user } = await newUser({ verified: true });
    const id = await seedPage(user.id, "# Reported\n\nBody.", "Reported");
    const send = (extra: Record<string, unknown>) => report(withSession(null, "/api/reports", { body: { page_id: id, reason: "spam", ...extra } }));
    expect((await send({})).status).toBe(403);
    expect((await send({ turnstile_token: "solved" })).status).toBe(201);
    await (await getDb()).collection("reports").deleteMany({ page_id: id });
  });
});

function zipFile(zip: Buffer): string {
  const file = join(mkdtempSync(join(tmpdir(), "booklet-zip-")), "pages.zip");
  writeFileSync(file, zip);
  return file;
}

test.describe("account page actions", () => {
  test("forgot-password also mails an account that has no password", async () => {
    process.env.RESEND_API_KEY = "re_test";
    try {
      const userId = await resolveSsoUser("google", { providerUserId: `g-${crypto.randomUUID()}`, email: email() });
      userIds.push(userId);
      const address = (await getUserById(userId))!.email!;
      const req = withSession(null, "/api/auth/forgot-password", { body: { email: address } });
      expect((await forgotPassword(req)).status).toBe(200);
      await expect.poll(() => sentMail.some((m) => m.to === address && m.html.includes("reset-password?token="))).toBe(true);
    } finally {
      delete process.env.RESEND_API_KEY;
      await (await getDb()).collection("password_reset_tokens").deleteMany({ user_id: { $in: userIds } });
    }
  });

  test("the ZIP writer produces an archive unzip can read", () => {
    const dir = mkdtempSync(join(tmpdir(), "booklet-zip-"));
    const file = join(dir, "out.zip");
    writeFileSync(file, zipTextFiles([{ name: "a.md", content: "# A\n\nüñí ✓\n" }, { name: "b.md", content: "x".repeat(5000) }]));
    expect(execFileSync("unzip", ["-p", file, "a.md"]).toString()).toBe("# A\n\nüñí ✓\n");
    expect(execFileSync("unzip", ["-p", file, "b.md"]).toString()).toHaveLength(5000);
    // -t verifies every entry's CRC.
    expect(execFileSync("unzip", ["-t", file]).toString()).toContain("No errors detected");
  });

  test("the export has one .md per owned page, with frontmatter, and nobody else's pages", async () => {
    const { user } = await newUser({ verified: true });
    const other = await newUser({ verified: true });
    const slug = `export-${createId(8).toLowerCase()}`;
    const a = await seedPage(user.id, "---\ntitle: Ignored\n---\n\n# First\n\nAlpha body.", "First", slug);
    const b = await seedPage(user.id, "# Second\n\nBeta body.", "Second");
    await seedPage(other.user.id, "# Theirs\n\nGamma.", "Theirs");

    const dir = mkdtempSync(join(tmpdir(), "booklet-export-"));
    const file = join(dir, "pages.zip");
    writeFileSync(file, await exportPagesZip(user.id, "https://booklet.example"));

    const names = execFileSync("unzip", ["-Z1", file]).toString().trim().split("\n").sort();
    expect(names).toEqual([`${slug}-${a}.md`, `${b}.md`].sort());

    const first = execFileSync("unzip", ["-p", file, `${slug}-${a}.md`]).toString();
    expect(first.startsWith("---\n")).toBe(true);
    expect(first).toContain("title: First");
    expect(first).toContain(`slug: ${slug}`);
    expect(first).toContain("visibility: unlisted");
    expect(first).toContain(`url: https://booklet.example/p/${slug}`);
    expect(first).toContain("# First\n\nAlpha body.");
    // The frontmatter the page was published with is replaced, not repeated.
    expect(first.match(/^---$/gm)).toHaveLength(2);
    expect(first).not.toContain("Ignored");
  });

  test("deleting an account needs its password, then removes its pages, credentials and user row", async () => {
    const { user, rawKey, cookie } = await newUser({ verified: true, password: "delete-me-please" });
    const other = await newUser({ verified: true });
    const mine = await seedPage(user.id, "# Mine\n\nBody.", "Mine");
    const theirs = await seedPage(other.user.id, "# Theirs\n\nBody.", "Theirs");
    // A page an admin took down: deleting the account must not delete it.
    const frozen = await seedPage(user.id, "# Frozen\n\nBody.", "Frozen");
    const at = new Date().toISOString();
    await markDocTakenDown(frozen, at);
    await markPageTakenDown(frozen, at);
    expect(execFileSync("unzip", ["-Z1", zipFile(await exportPagesZip(user.id, ORIGIN))]).toString()).not.toContain(frozen);

    const wrong = withSession(cookie, "/api/account/delete", { body: { password: "not-it" } });
    expect((await withRequestScope(wrong, () => removeAccount(wrong))).status).toBe(403);
    expect(await getUserById(user.id)).not.toBeNull();

    // The route itself also clears the session cookie, which a unit request
    // scope cannot do, so the deletion is driven through the service here
    // and through the browser in tests/e2e/accounts.spec.ts.
    await deleteAccount(user.id);

    expect(await getUserById(user.id)).toBeNull();
    expect(await getUserByEmail(user.email!)).toBeNull();
    expect(await getPageRecord(mine)).toBeNull();
    expect(await getDoc(mine)).toBeNull();
    expect(await getPageRecord(theirs)).not.toBeNull();
    expect((await getPageRecord(frozen))?.taken_down_at).toBe(at);
    expect(await getDoc(frozen)).not.toBeNull();
    expect((await publishWithKey(rawKey)).status).toBe(401);
    expect(await findSessionByHash(await hashSessionToken(cookie.split("=")[1]))).toBeNull();
  });

  test("a connected app is listed, and stops working when disconnected", async () => {
    const { user } = await newUser({ verified: true });
    // The app is a metadata-document client; its document's host is stood in for.
    const clientId = `https://app-${crypto.randomUUID()}.example/client.json`;
    const client = { client_id: clientId, client_name: "Test Assistant", redirect_uris: ["https://app.example/cb"] };
    const realFetch = metadataFetcher.fetch;
    metadataFetcher.fetch = async (url) => (url.href === clientId ? client : null);
    const verifier = `verifier-${crypto.randomUUID()}-${crypto.randomUUID()}`.slice(0, 64);
    const code = await issueAuthorizationCode(
      {
        client,
        redirectUri: "https://app.example/cb",
        scope: ["pages:read"],
        resource: oauthResource(),
        state: undefined,
        codeChallenge: createHash("sha256").update(verifier).digest("base64url"),
      },
      user.id,
    );
    const tokens = await exchangeAuthorizationCode({ code, client_id: clientId, redirect_uri: "https://app.example/cb", code_verifier: verifier });

    expect(await listConnectedApps(user.id)).toEqual([{ clientId, name: "Test Assistant", scope: ["pages:read"] }]);
    expect(await verifyAccessToken(tokens.access_token)).not.toBeNull();

    await disconnectApp(user.id, clientId);

    expect(await listConnectedApps(user.id)).toEqual([]);
    expect(await verifyAccessToken(tokens.access_token)).toBeNull();
    metadataFetcher.fetch = realFetch;
  });
});

// ─── Changing an account's email address ─────────────────────────────────────

test.describe("change email", () => {
  test.beforeAll(() => {
    process.env.RESEND_API_KEY = "re_test";
  });
  test.afterAll(() => {
    delete process.env.RESEND_API_KEY;
  });

  const ask = (cookie: string | null, body: Record<string, unknown>, headers?: Record<string, string>) => {
    const req = withSession(cookie, "/api/account/email", { body, ...(headers ? { headers } : {}) });
    return withRequestScope(req, () => changeEmail(req));
  };
  const fresh = () => `moved-${crypto.randomUUID()}@example.test`;

  test("the address changes only when the link sent to the new one is confirmed from the account's session", async () => {
    const { user, cookie } = await newUser({ verified: true, password: "correct horse battery" });
    const other = await newUser({ verified: true, password: "correct horse battery" });
    const next = fresh();

    // Refusals, on another account: the route allows five tries a minute.
    expect((await ask(other.cookie, { email: next, password: "wrong" })).status).toBe(403);
    expect((await ask(other.cookie, { email: next })).status).toBe(403);
    expect((await ask(null, { email: next, password: "correct horse battery" })).status).toBe(401);
    expect((await ask(other.cookie, { email: "not an address", password: "correct horse battery" })).status).toBe(400);
    expect((await ask(other.cookie, { email: other.user.email, password: "correct horse battery" })).status).toBe(400);

    const asked = await ask(cookie, { email: next.toUpperCase(), password: "correct horse battery" });
    expect(await asked.json()).toEqual({ ok: true, changed: false });
    // Nothing has moved yet.
    expect((await getUserById(user.id))?.email).toBe(user.email);

    const token = await tokenMailedTo(next);
    // Someone else's session, and no session, do nothing with the link... and it is spent.
    expect((await confirm(other.cookie, token)).status).toBe(400);
    expect((await getUserById(user.id))?.email).toBe(user.email);

    // The account's own session and its own link: the account moves.
    const third = await newUser({ verified: true, password: "correct horse battery" });
    const target = fresh();
    await ask(third.cookie, { email: target, password: "correct horse battery" });
    const done = await confirm(third.cookie, await tokenMailedTo(target));
    expect(await done.json()).toEqual({ ok: true, changed: true, email: target });
    const moved = await getUserById(third.user.id);
    expect(moved?.email).toBe(target);
    expect(moved?.email_verified_at).toBeTruthy();
    // The address it left is told.
    await expect.poll(() => sentMail.some((m) => m.to === third.user.email)).toBe(true);
  });

  test("an address that is another account's gets the same answer and no mail, and cannot be taken by a race", async () => {
    const { user, cookie } = await newUser({ verified: true, password: "correct horse battery" });
    const holder = await newUser({ verified: true });
    sentMail.length = 0;

    const asked = await ask(cookie, { email: holder.user.email, password: "correct horse battery" });
    expect(asked.status).toBe(200);
    expect(await asked.json()).toEqual({ ok: true, changed: false });
    expect(sentMail.filter((m) => m.to === holder.user.email)).toEqual([]);

    // The address was free when the link went out and is taken when it is opened.
    const late = await newUser({ verified: true, password: "correct horse battery" });
    const next = fresh();
    await ask(late.cookie, { email: next, password: "correct horse battery" });
    const token = await tokenMailedTo(next);
    const racer = await createUser(createId(20), next, null, null, new Date().toISOString());
    userIds.push(racer.id);
    const lost = await confirm(late.cookie, token);
    expect(lost.status).toBe(409);
    expect((await getUserById(late.user.id))?.email).toBe(late.user.email);
    expect((await getUserById(user.id))?.email).toBe(user.email);
  });

  test("an account with no password changes its address with its session alone; a cross-origin request never does", async () => {
    const { user, cookie } = await newUser({ verified: true });
    const next = fresh();
    expect((await ask(cookie, { email: next }, { origin: "https://evil.example" })).status).toBe(403);
    expect((await ask(cookie, { email: next })).status).toBe(200);
    expect((await confirm(cookie, await tokenMailedTo(next))).status).toBe(200);
    expect((await getUserById(user.id))?.email).toBe(next);
  });

  test("an account that never confirmed its address changes it at once, stays unverified, and no mail goes out", async () => {
    // A typo at signup: the link went somewhere unreadable.
    const { user, cookie } = await newUser({ password: "correct horse battery" });
    const next = fresh();
    sentMail.length = 0;
    expect(await (await ask(cookie, { email: next, password: "correct horse battery" })).json()).toEqual({ ok: true, changed: true });
    const moved = await getUserById(user.id);
    expect(moved?.email).toBe(next);
    expect(moved?.email_verified_at).toBeFalsy();
    expect(sentMail).toEqual([]);
  });

  test("a change kills password-reset links mailed to the old address, and a second link in a minute is refused", async () => {
    const { user, cookie } = await newUser({ verified: true, password: "correct horse battery" });
    const db = await getDb();
    await db.collection("password_reset_tokens").insertOne({ _id: createId(20), user_id: user.id, token_hash: `h-${crypto.randomUUID()}`, expires_at: new Date(Date.now() + 600_000) } as never);
    const next = fresh();
    expect((await ask(cookie, { email: next, password: "correct horse battery" })).status).toBe(200);
    expect((await ask(cookie, { email: fresh(), password: "correct horse battery" })).status).toBe(429);
    expect((await confirm(cookie, await tokenMailedTo(next))).status).toBe(200);
    expect(await db.collection("password_reset_tokens").countDocuments({ user_id: user.id })).toBe(0);
  });

  test("a proof of one address never verifies another: a reset link sent before a change", async () => {
    // What a password reset does when an address change lands while it hashes the new password.
    const { user } = await newUser({ password: "correct horse battery" });
    const proven = user.email;
    const next = fresh();
    expect(await setUserEmail(user.id, next, false)).toBe(true);
    await markEmailVerified(user.id, proven);
    expect((await getUserById(user.id))?.email_verified_at).toBeFalsy();
    await markEmailVerified(user.id, next);
    expect((await getUserById(user.id))?.email_verified_at).toBeTruthy();
  });

  test("with no mail configured the address changes at once, and a taken one is refused", async () => {
    delete process.env.RESEND_API_KEY;
    try {
      const { user, cookie } = await newUser({ password: "correct horse battery" });
      const holder = await newUser();
      expect((await ask(cookie, { email: holder.user.email, password: "correct horse battery" })).status).toBe(409);
      const next = fresh();
      expect(await (await ask(cookie, { email: next, password: "correct horse battery" })).json()).toEqual({ ok: true, changed: true });
      const moved = await getUserById(user.id);
      expect(moved?.email).toBe(next);
      // Nobody proved it, so it is not marked verified (a provider sign-in must not link to it).
      expect(moved?.email_verified_at).toBeFalsy();
    } finally {
      process.env.RESEND_API_KEY = "re_test";
    }
  });
});
