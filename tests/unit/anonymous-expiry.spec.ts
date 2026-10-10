import { test, expect } from "@playwright/test";
import { sessionCookieFor, withRequestScope } from "./helpers/request-scope";
import { cleanupPages, seedDoc, throughMiddleware, useTestEnv } from "./helpers/pages";
import { getDb } from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/db/index-specs.mjs";
import { backfillAnonymousExpiry } from "@/lib/db/expiry.mjs";
import { purgeExpiredAnonymousDocs } from "@/lib/db/purge";
import { createPageRecord, getPageRecord } from "@/lib/db";
import { getDoc, getDocState } from "@/lib/storage";
import { ANONYMOUS_PAGE_TTL_DAYS, claimCookieName, hashClaimToken } from "@/lib/anonymous-claim";
import { getGoneReason } from "@/server/page-gone";
import { POST as webPublish } from "@/app/api/publish/route";
import { POST as claimPage } from "@/app/api/pages/[id]/claim/route";

// Pages published without an account are kept for 90 days unless their
// author signs in and claims them. Before this they were stored forever
// with no owner and no way to remove them.

const DAY = 86_400_000;
const db = () => getDb();
const ids: string[] = [];
const userIds: string[] = [];

test.beforeAll(async () => {
  useTestEnv();
  await ensureIndexes(await getDb());
});

test.afterAll(async () => {
  await cleanupPages(ids, userIds);
});

/** Runs `fn` with the clock moved forward, restoring it afterwards. */
async function atDaysFromNow<T>(days: number, fn: () => Promise<T>): Promise<T> {
  const realNow = Date.now;
  Date.now = () => realNow() + days * DAY;
  try {
    return await fn();
  } finally {
    Date.now = realNow;
  }
}

async function publish(cookie?: string) {
  const req = new Request("http://localhost/api/publish", {
    method: "POST",
    headers: {
      ...(cookie ? { cookie } : {}),
      "content-type": "application/json",
      "cf-connecting-ip": `test-${crypto.randomUUID()}`,
    },
    body: JSON.stringify({ raw: "# Anonymous note\n\nBody." }),
  });
  const res = await withRequestScope(req, () => webPublish(req));
  expect(res.status).toBe(200);
  const { id } = (await res.json()) as { id: string };
  ids.push(id);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const claimToken = new RegExp(`${claimCookieName(id)}=([^;]+)`).exec(setCookie)?.[1] ?? null;
  return { id, setCookie, claimToken };
}

async function claim(id: string, cookies: string[], headers: Record<string, string> = {}) {
  const req = new Request(`http://localhost/api/pages/${id}/claim`, {
    method: "POST",
    headers: { cookie: cookies.join("; "), ...headers },
  });
  return withRequestScope(req, () => claimPage(req, { params: Promise.resolve({ id }) }));
}

async function newUser() {
  const userId = `testuser${crypto.randomUUID()}`;
  userIds.push(userId);
  return { userId, session: await sessionCookieFor(userId) };
}

test.describe("anonymous publish", () => {
  test("sets expires_at 90 days out and hands the publisher a claim cookie", async () => {
    const before = Date.now();
    const { id, setCookie, claimToken } = await publish();
    const state = await getDocState(id);

    const ttl = state!.expiresAt!.getTime() - before;
    expect(ANONYMOUS_PAGE_TTL_DAYS).toBe(90);
    expect(ttl).toBeGreaterThanOrEqual(90 * DAY);
    expect(ttl).toBeLessThan(90 * DAY + 60_000);

    expect(claimToken).toBeTruthy();
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
    // Only a hash of the token is stored.
    expect(state!.claimTokenHash).toBe(await hashClaimToken(claimToken!));
    expect(state!.claimTokenHash).not.toBe(claimToken);
    expect(await getPageRecord(id)).toBeNull();
  });

  test("a signed-in publish never expires and gets no claim cookie", async () => {
    const { session } = await newUser();
    const { id, claimToken } = await publish(session);
    expect((await getDocState(id))?.expiresAt).toBeNull();
    expect(claimToken).toBeNull();
  });
});

test.describe("expiry", () => {
  test("91 days on, an unclaimed anonymous page is 410 and a claimed one is 200", async () => {
    const unclaimed = await publish();
    const claimed = await publish();
    const { session } = await newUser();
    expect((await claim(claimed.id, [session, `${claimCookieName(claimed.id)}=${claimed.claimToken}`])).status).toBe(200);

    await atDaysFromNow(91, async () => {
      for (const suffix of ["", "/embed"]) {
        const gone = await throughMiddleware(`/p/${unclaimed.id}${suffix}`);
        expect(gone.status).toBe(410);
        expect(await gone.text()).not.toContain("Anonymous note");
        expect((await throughMiddleware(`/p/${claimed.id}${suffix}`)).status).toBe(200);
      }
    });
  });

  test("in the 30 days after expiry the author's browser still reaches the page, to claim it", async () => {
    const { id, claimToken } = await publish();
    const claimCookie = `${claimCookieName(id)}=${claimToken}`;

    await atDaysFromNow(95, async () => {
      // Created inside the shifted clock: a session minted today would have
      // expired by then.
      const { session } = await newUser();
      expect((await throughMiddleware(`/p/${id}`)).status).toBe(410);
      // The middleware only sees that a claim cookie is present; the page
      // itself verifies it before showing anything.
      expect((await throughMiddleware(`/p/${id}`, claimCookie)).status).toBe(200);
      expect((await claim(id, [session, claimCookie])).status).toBe(200);
      expect((await throughMiddleware(`/p/${id}`)).status).toBe(200);
    });
  });

  test("89 days on, an unclaimed anonymous page is still served", async () => {
    const { id } = await publish();
    await atDaysFromNow(89, async () => {
      expect((await throughMiddleware(`/p/${id}`)).status).toBe(200);
    });
  });

  test("a page with an owner never expires, even with a stale expires_at", async () => {
    const { userId } = await newUser();
    const id = await seedDoc("# Owned", { expiresAt: new Date(Date.now() - DAY), claimTokenHash: "x" });
    ids.push(id);
    expect(await getGoneReason(id)).toBe("expired");
    await createPageRecord(id, userId, "Owned");
    expect(await getGoneReason(id)).toBeNull();
  });
});

test.describe("POST /api/pages/:id/claim", () => {
  test("creates an unlisted page record for the signed-in user and clears the expiry", async () => {
    const { id, claimToken } = await publish();
    const { userId, session } = await newUser();

    const res = await claim(id, [session, `${claimCookieName(id)}=${claimToken}`]);
    expect(res.status).toBe(200);

    const record = await getPageRecord(id);
    expect(record).toMatchObject({ user_id: userId, visibility: "unlisted", title: "Anonymous note" });
    expect(await getDocState(id)).toMatchObject({ expiresAt: null, claimTokenHash: null });
    // The claim cookie is spent.
    expect(res.headers.get("set-cookie") ?? "").toMatch(new RegExp(`${claimCookieName(id)}=;`));
  });

  test("is 401 without a session", async () => {
    const { id, claimToken } = await publish();
    expect((await claim(id, [`${claimCookieName(id)}=${claimToken}`])).status).toBe(401);
    expect(await getPageRecord(id)).toBeNull();
  });

  test("is 403 without the publisher's claim cookie, or with the wrong one", async () => {
    const { id } = await publish();
    const other = await publish();
    const { session } = await newUser();
    expect((await claim(id, [session])).status).toBe(403);
    expect((await claim(id, [session, `${claimCookieName(id)}=${other.claimToken}`])).status).toBe(403);
    expect(await getPageRecord(id)).toBeNull();
    expect((await getDocState(id))?.expiresAt).not.toBeNull();
  });

  test("is 403 for a cross-origin request", async () => {
    const { id, claimToken } = await publish();
    const { session } = await newUser();
    const res = await claim(id, [session, `${claimCookieName(id)}=${claimToken}`], {
      origin: "https://evil.example",
      host: "localhost",
    });
    expect(res.status).toBe(403);
    expect(await getPageRecord(id)).toBeNull();
  });

  test("cannot be claimed twice", async () => {
    const { id, claimToken } = await publish();
    const first = await newUser();
    const second = await newUser();
    const cookie = `${claimCookieName(id)}=${claimToken}`;
    expect((await claim(id, [first.session, cookie])).status).toBe(200);
    expect((await claim(id, [second.session, cookie])).status).toBe(409);
    expect((await getPageRecord(id))?.user_id).toBe(first.userId);
  });

  test("is 404 for a page that does not exist", async () => {
    const { session } = await newUser();
    expect((await claim("nopage0000", [session, `${claimCookieName("nopage0000")}=x`])).status).toBe(404);
  });
});

test.describe("daily purge", () => {
  const stale = (daysPastExpiry: number) => ({
    expiresAt: new Date(Date.now() - daysPastExpiry * DAY),
    claimTokenHash: "x",
  });

  test("deletes an unclaimed document 30 days past expiry and nothing else", async () => {
    const { userId } = await newUser();
    const purged = await seedDoc("# old", stale(31));
    const inGrace = await seedDoc("# grace", stale(29));
    const claimedLate = await seedDoc("# owned", stale(31));
    const owned = await seedDoc("# never expires");
    ids.push(purged, inGrace, claimedLate, owned);
    await createPageRecord(claimedLate, userId, "owned");
    await createPageRecord(owned, userId, "owned");

    await db().then((d) => d.collection("page_versions").insertOne({ page_id: purged, version_number: 1 } as never));
    await purgeExpiredAnonymousDocs();

    expect(await db().then((d) => d.collection("page_versions").countDocuments({ page_id: purged }))).toBe(0);

    expect(await getDoc(purged)).toBeNull();
    expect(await getDoc(inGrace)).not.toBeNull();
    expect(await getDoc(claimedLate)).not.toBeNull();
    expect(await getDoc(owned)).not.toBeNull();
  });
});

test.describe("one-time backfill for pages published before expiry existed", () => {
  test("stamps only old ownerless documents, and is idempotent", async () => {
    const { userId } = await newUser();
    const db = await getDb();
    const legacyAnon = await seedDoc("# legacy anonymous");
    const legacyOwned = await seedDoc("# legacy owned");
    const fresh = await seedDoc("# published a moment ago");
    ids.push(legacyAnon, legacyOwned, fresh);
    await createPageRecord(legacyOwned, userId, "owned");
    const old = new Date(Date.now() - 2 * DAY).toISOString();
    await db
      .collection("docs")
      .updateMany({ _id: { $in: [legacyAnon, legacyOwned] } } as never, { $set: { "doc.createdAt": old } });

    const before = Date.now();
    await backfillAnonymousExpiry(db);

    const stamped = (await getDocState(legacyAnon))!.expiresAt!;
    expect(stamped.getTime() - before).toBeGreaterThanOrEqual(90 * DAY);
    expect(stamped.getTime() - before).toBeLessThan(90 * DAY + 60_000);
    expect((await getDocState(legacyOwned))?.expiresAt).toBeNull();
    // A signed-in publish writes the doc before its pages record; a doc that
    // new must not be mistaken for an anonymous one.
    expect((await getDocState(fresh))?.expiresAt).toBeNull();

    await backfillAnonymousExpiry(db);
    expect((await getDocState(legacyAnon))!.expiresAt!.getTime()).toBe(stamped.getTime());
  });
});
