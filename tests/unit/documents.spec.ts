import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { cleanupPages, seedUserWithKey, useTestEnv } from "./helpers/pages";
import { sessionCookieFor, withRequestScope } from "./helpers/request-scope";
import { html } from "./helpers/render";
import { getDb } from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/db/index-specs.mjs";
import {
  addCollectionMember,
  createCollectionRecord,
  deleteCollectionRecord,
  getBacklinkPages,
  getCollectionMember,
  getPageRecord,
  removeCollectionMember,
  markPageTakenDown,
  updateCollectionRecord,
  updatePageRecord,
} from "@/lib/db";
import type { DbPage } from "@/lib/db/types";
import type { Block, Inline } from "@/lib/blocks";
import { createId } from "@/lib/id";
import { parseFrontmatter } from "@/lib/frontmatter";
import { TEMPLATES, getTemplateBySlug, templateMarkdown } from "@/lib/templates";
import { adrNumber, buildSpaceFeed, groupSpacePages } from "@/lib/space-groups";
import { getDoc } from "@/lib/storage";
import { createUser } from "@/lib/db/auth";
import { signInviteToken } from "@/lib/invite-token";
import JoinPage from "@/app/t/join/page";
import { canListPage, canViewPage } from "@/server/access";
import { deleteAccount, exportPagesZip } from "@/server/account";
import { DocHeaderStrip } from "@/components/share/DocHeaderStrip";
import { POST as v1Publish } from "@/app/api/v1/publish/route";
import { GET as v1List } from "@/app/api/v1/pages/route";
import { DELETE as v1Delete, GET as v1Get, PATCH as v1Patch } from "@/app/api/v1/pages/[id]/route";
import { POST as webPublish } from "@/app/api/publish/route";
import { PATCH as webUpdate } from "@/app/api/publish/[id]/route";
import { PATCH as webPatchMeta } from "@/app/api/pages/[id]/route";
import { DELETE as removeFromCollection, POST as addToCollection } from "@/app/api/collections/[id]/pages/route";
import { GET as markdown } from "@/app/api/pages/[id]/markdown/route";
import { GET as spaceFeed } from "@/app/t/[slug]/feed.xml/route";
import SharePage, { generateMetadata } from "@/app/p/[id]/page";
import { generateMetadata as embedMetadata } from "@/app/p/[id]/embed/page";
import { POST as claimPage } from "@/app/api/pages/[id]/claim/route";
import { POST as addMember } from "@/app/api/collections/[id]/members/route";
import { handleCreateDocument, handleGetPage, handlePublishPage, handleSearchPages } from "../../mcp-server/src/tools.js";
import { PROMPT_NAMES } from "../../mcp-server/src/mcp-server.js";
import { renderPrompt } from "../../mcp-server/src/prompts.js";
import { TEMPLATES as CLI_TEMPLATES } from "../../packages/cli/src/templates.js";

// Phase 5b: document types (5.3), published links and backlinks (5.4),
// team-only visibility (5.5), the team space home and feed (5.6), and the
// MCP workflow tools (5.7).

const ORIGIN = "http://localhost";

type Account = { userId: string; rawKey: string; cookie: string };
const accounts: Account[] = [];
const pageIds: string[] = [];
const spaceIds: string[] = [];

async function account(): Promise<Account> {
  const { userId, rawKey } = await seedUserWithKey();
  const a = { userId, rawKey, cookie: await sessionCookieFor(userId) };
  accounts.push(a);
  return a;
}

/** A team space owned by `owner`, with `members` added in the given roles. */
async function space(owner: Account, members: Array<[Account, "editor" | "viewer"]> = []) {
  const id = createId(10);
  const slug = `space-${id.toLowerCase()}`;
  spaceIds.push(id);
  await createCollectionRecord(id, owner.userId, `Space ${id}`, true);
  await updateCollectionRecord(id, { slug });
  await addCollectionMember(createId(10), id, owner.userId, null, "editor", owner.userId);
  for (const [member, role] of members) {
    await addCollectionMember(createId(10), id, member.userId, null, role, owner.userId);
  }
  return { id, slug, name: `Space ${id}` };
}

function api(a: Account, path: string, init: { method?: string; body?: unknown } = {}) {
  return new Request(`${ORIGIN}/api/v1${path}`, {
    method: init.method ?? "GET",
    headers: { authorization: `Bearer ${a.rawKey}`, "content-type": "application/json" },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function publish(a: Account, body: Record<string, unknown>) {
  const res = await v1Publish(api(a, "/publish", { method: "POST", body }));
  const json = (await res.json()) as { id?: string; code?: string; detail?: string };
  if (json.id) pageIds.push(json.id);
  return { status: res.status, ...json };
}

/** Publishes and returns the id, failing the test on anything but 201. */
async function published(a: Account, body: Record<string, unknown>): Promise<string> {
  const res = await publish(a, body);
  expect(res.status, res.detail).toBe(201);
  // Links and versions are written after the response; let them land.
  await expect.poll(async () => (await getPageRecord(res.id as string)) !== null).toBe(true);
  return res.id as string;
}

function web(cookie: string | null, path: string, init: { method?: string; body?: unknown } = {}) {
  return new Request(`${ORIGIN}${path}`, {
    method: init.method ?? "POST",
    headers: {
      host: "localhost",
      origin: ORIGIN,
      "content-type": "application/json",
      "cf-connecting-ip": `test-${crypto.randomUUID()}`,
      ...(cookie ? { cookie } : {}),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

/** Calls `fn` as a browser request carrying `cookie` (or none). */
function as<T>(cookie: string | null, fn: () => Promise<T>): Promise<T> {
  return withRequestScope(web(cookie, "/", { method: "GET" }), fn);
}

function links(blocks: Block[]): string[] {
  const out: string[] = [];
  const walk = (inl: Inline[]) => {
    for (const n of inl) {
      if (n.t === "link") out.push(n.href);
      if ("c" in n) walk(n.c);
    }
  };
  for (const b of blocks) if (b.t === "paragraph" || b.t === "heading") walk(b.inl);
  return out;
}

function text(blocks: Block[]): string {
  const flat = (inl: Inline[]): string => inl.map((n) => ("v" in n ? n.v : "c" in n ? flat(n.c) : "")).join("");
  return blocks.map((b) => (b.t === "paragraph" || b.t === "heading" ? flat(b.inl) : "")).join("\n");
}

/** Routes the MCP tools' one fetch to /api/v1 straight into the real handlers. */
async function withApi<T>(fn: () => Promise<T>): Promise<T> {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const { pathname } = new URL(req.url);
    if (pathname === "/api/v1/publish") return v1Publish(req);
    if (pathname === "/api/v1/pages") return v1List(req);
    const m = /^\/api\/v1\/pages\/([^/]+)$/.exec(pathname);
    if (m) return v1Get(req, ctx(decodeURIComponent(m[1])));
    throw new Error(`unexpected fetch: ${req.url}`);
  }) as typeof fetch;
  try {
    return await fn();
  } finally {
    globalThis.fetch = realFetch;
  }
}

test.beforeAll(async () => {
  useTestEnv();
  await ensureIndexes(await getDb());
});

test.afterAll(async () => {
  const db = await getDb();
  await cleanupPages(pageIds, accounts.map((a) => a.userId));
  await db.collection("page_links").deleteMany({ $or: [{ source_id: { $in: pageIds } }, { target_id: { $in: pageIds } }] });
  await db.collection("collections").deleteMany({ _id: { $in: spaceIds } } as never);
  await db.collection("collection_members").deleteMany({ collection_id: { $in: spaceIds } });
});

// ─── 5.3 Document types ──────────────────────────────────────────────────────

test.describe("document types", () => {
  test("frontmatter reads the typed fields, including an unquoted date", () => {
    const { meta, body } = parseFrontmatter(
      "---\ntype: ADR\nstatus: Accepted\nseverity: P1\ndate: 2026-10-10\nowners: [alice, bob]\nsupersedes: ADR-003 Polling\nspace: Platform\nvisibility: team\n---\n# Title",
    );
    expect(meta).toMatchObject({
      type: "adr",
      status: "Accepted",
      severity: "P1",
      date: "2026-10-10",
      owners: ["alice", "bob"],
      supersedes: "ADR-003 Polling",
      space: "platform",
      visibility: "team",
    });
    expect(body).toBe("# Title");
  });

  test("an unknown type is not a document type", () => {
    expect(parseFrontmatter("---\ntype: memo\n---\n# x").meta.type).toBeUndefined();
    expect(parseFrontmatter("---\ntype: { $ne: null }\n---\n# x").meta.type).toBeUndefined();
  });

  test("publishing the ADR template stores its type and shows status and date in the header strip", async () => {
    const a = await account();
    const template = getTemplateBySlug("adr");
    expect(template).toBeTruthy();
    const id = await published(a, { raw: templateMarkdown(template!, "2026-10-10") });

    const record = await getPageRecord(id);
    expect(record?.doc_type).toBe("adr");
    expect(record?.frontmatter_meta).toMatchObject({ type: "adr", status: "Proposed", date: "2026-10-10" });

    const strip = await html(DocHeaderStrip({ meta: record!.frontmatter_meta, userId: a.userId }));
    expect(strip).toContain('data-doc-type="adr"');
    expect(strip).toContain(">ADR<");
    expect(strip).toContain('data-status="Proposed"');
    expect(strip).toContain("10 October 2026");
  });

  test("a high severity is drawn in the danger colour, a low one is not", async () => {
    const strip = (severity: string) => html(DocHeaderStrip({ meta: { type: "incident", severity }, userId: null }));
    for (const high of ["P1", "sev-0", "Critical"]) expect(await strip(high)).toContain("text-danger");
    for (const low of ["P3", "Low"]) expect(await strip(low)).not.toContain("text-danger");
  });

  test("a page with no frontmatter has no header strip", () => {
    expect(DocHeaderStrip({ meta: null, userId: null })).toBeNull();
  });

  test("GET /api/v1/pages?type=adr returns only ADRs", async () => {
    const a = await account();
    const adr = await published(a, { raw: "---\ntype: adr\n---\n# ADR-001 One" });
    await published(a, { raw: "---\ntype: incident\n---\n# Incident" });
    await published(a, { raw: "# Untyped" });

    const res = await v1List(api(a, "/pages?type=adr"));
    const body = (await res.json()) as { pages: Array<{ id: string; doc_type: string | null }>; total: number };
    expect(body.pages.map((p) => p.id)).toEqual([adr]);
    expect(body.pages[0].doc_type).toBe("adr");
    expect(body.total).toBe(1);

    const all = (await (await v1List(api(a, "/pages"))).json()) as { total: number };
    expect(all.total).toBe(3);
  });

  test("an unknown ?type= is a 422, not an empty list", async () => {
    const a = await account();
    expect((await v1List(api(a, "/pages?type=memo"))).status).toBe(422);
  });

  test("the stored Markdown keeps its frontmatter, and an update changes the status shown", async () => {
    const a = await account();
    const id = await published(a, { raw: "---\ntype: adr\nstatus: Proposed\n---\n# ADR-002 Two" });
    const got = (await (await v1Get(api(a, `/pages/${id}`), ctx(id))).json()) as { raw: string; doc_type: string };
    expect(got.raw).toContain("status: Proposed");
    expect(got.doc_type).toBe("adr");

    const res = await v1Patch(
      api(a, `/pages/${id}`, { method: "PATCH", body: { raw: "---\ntype: adr\nstatus: Accepted\n---\n# ADR-002 Two, revised" } }),
      ctx(id),
    );
    expect(res.status).toBe(200);
    const record = await getPageRecord(id);
    expect(record?.frontmatter_meta?.status).toBe("Accepted");
    expect(record?.title).toBe("ADR-002 Two, revised");
  });

  test("the editor's publish and update routes store the type too", async () => {
    const a = await account();
    const req = web(a.cookie, "/api/publish", { body: { raw: "---\ntype: runbook\nstatus: Current\n---\n# Restart the queue" } });
    const res = await withRequestScope(req, () => webPublish(req));
    expect(res.status).toBe(200);
    const { id } = (await res.json()) as { id: string };
    pageIds.push(id);
    expect((await getPageRecord(id))?.doc_type).toBe("runbook");
    // The frontmatter is not rendered as content.
    expect(text((await getDoc(id))!.blocks)).not.toContain("status:");

    const update = web(a.cookie, `/api/publish/${id}`, { method: "PATCH", body: { raw: "---\ntype: runbook\nstatus: Retired\n---\n# Restart the queue" } });
    expect((await withRequestScope(update, () => webUpdate(update, ctx(id)))).status).toBe(200);
    expect((await getPageRecord(id))?.frontmatter_meta?.status).toBe("Retired");
  });

  test("all 21 editor templates open with frontmatter that parses to a status and a date", () => {
    expect(TEMPLATES).toHaveLength(21);
    for (const t of TEMPLATES) {
      const { meta, body } = parseFrontmatter(templateMarkdown(t, "2026-10-10"));
      expect(meta.status, t.name).toBeTruthy();
      expect(meta.date, t.name).toBe("2026-10-10");
      expect(meta.type, t.name).toBe(t.doc?.type);
      expect(body.startsWith("#"), t.name).toBe(true);
    }
    expect(TEMPLATES.filter((t) => t.doc).map((t) => t.doc!.type).sort()).toEqual(
      ["adr", "incident", "postmortem", "release-notes", "release-notes", "runbook"],
    );
  });

  test("the 5 MCP prompts and the 5 CLI templates emit a document type", () => {
    expect(PROMPT_NAMES).toHaveLength(5);
    for (const name of PROMPT_NAMES) {
      const { meta } = parseFrontmatter(renderPrompt(name, { title: 'A "quoted": title', date: "2026-10-10" }) ?? "");
      expect(meta.type, name).toBeTruthy();
      // The prompts that take a date use it; the rest use today's. This
      // compared against one fixed day and passed only on that day.
      expect(meta.date, name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    for (const name of ["incident_report", "release_notes"]) {
      expect(parseFrontmatter(renderPrompt(name, { title: "T", date: "2026-10-10" }) ?? "").meta.date, name).toBe("2026-10-10");
    }
    for (const [name, t] of Object.entries(CLI_TEMPLATES)) {
      const { meta } = parseFrontmatter(t.body());
      expect(meta.type, name).toBe(name);
      expect(meta.status, name).toBeTruthy();
    }
  });
});

// ─── 5.4 Published links and backlinks ───────────────────────────────────────

test.describe("published links and backlinks", () => {
  test("[[Title]] of the author's own published page becomes a link, and the target lists the source", async () => {
    const a = await account();
    const adr = await published(a, { raw: "# ADR-012 Queue retries" });
    const incident = await published(a, {
      raw: "# Queue outage\n\nSee [[ADR-012 Queue retries]], [[adr-012 queue retries|the decision]] and [[No such page]].",
    });

    const doc = await getDoc(incident);
    expect(links(doc!.blocks)).toEqual([`${ORIGIN}/p/${adr}`, `${ORIGIN}/p/${adr}`]);
    // An unresolved wikilink is plain text, as before.
    expect(text(doc!.blocks)).toContain("No such page");
    expect(JSON.stringify(doc!.blocks)).not.toContain("wikilink");

    await expect.poll(async () => (await getBacklinkPages(adr)).map((p) => p.id)).toEqual([incident]);
  });

  test("a viewer who cannot see the referencing page does not see it listed", async () => {
    const a = await account();
    const stranger = await account();
    const adr = await published(a, { raw: "# ADR-020 Listed", visibility: "public" });
    const incident = await published(a, { raw: "# Unlisted incident\n\n[[ADR-020 Listed]]" });
    await expect.poll(async () => (await getBacklinkPages(adr)).length).toBe(1);
    const [source] = await getBacklinkPages(adr);

    // Unlisted: readable by link, so never handed out in a list.
    expect(await canListPage(source, null)).toBe(false);
    expect(await canListPage(source, stranger.userId)).toBe(false);
    expect(await canListPage(source, a.userId)).toBe(true);

    await updatePageRecord(incident, { visibility: "public" });
    expect(await canListPage((await getPageRecord(incident))!, null)).toBe(true);

    // The rendered page says the same thing.
    const page = async () => html(await SharePage({ params: Promise.resolve({ id: adr }) }));
    expect(await as(null, page)).toContain("Referenced by");
    await updatePageRecord(incident, { visibility: "unlisted" });
    expect(await as(stranger.cookie, page)).not.toContain("Referenced by");
    expect(await as(a.cookie, page)).toContain("Unlisted incident");
  });

  test("a public page does not link to an unlisted one", async () => {
    const a = await account();
    await published(a, { raw: "# Private notes" });
    const pub = await published(a, { raw: "# Announcement\n\n[[Private notes]]", visibility: "public" });
    const doc = await getDoc(pub);
    expect(links(doc!.blocks)).toEqual([]);
    expect(text(doc!.blocks)).toContain("Private notes");
  });

  test("in a team space, links resolve to the space's pages, whoever wrote them", async () => {
    const owner = await account();
    const member = await account();
    const s = await space(owner, [[member, "editor"]]);
    const adr = await published(owner, { raw: "# ADR-030 Shared", space: s.slug, visibility: "team" });
    await published(member, { raw: "# ADR-030 Shared" }); // same title, outside the space

    const incident = await published(member, { raw: "# Incident\n\n[[ADR-030 Shared]]", space: s.slug, visibility: "team" });
    expect(links((await getDoc(incident))!.blocks)).toEqual([`${ORIGIN}/p/${adr}`]);

    // Outside the space, the member's page links to the member's own page,
    // never into the space.
    const personal = await published(member, { raw: "# Notes\n\n[[ADR-030 Shared]]" });
    expect(links((await getDoc(personal))!.blocks)).not.toContain(`${ORIGIN}/p/${adr}`);

    // The backlink from a team-only page is hidden from someone outside the space.
    const outsider = await account();
    await expect.poll(async () => (await getBacklinkPages(adr)).length).toBe(1);
    const [source] = await getBacklinkPages(adr);
    expect(await canListPage(source, outsider.userId)).toBe(false);
    expect(await canListPage(source, owner.userId)).toBe(true);
  });

  test("an anonymous publish resolves nothing", async () => {
    const req = web(null, "/api/publish", { body: { raw: "# Anonymous\n\n[[ADR-012 Queue retries]]" } });
    const res = await withRequestScope(req, () => webPublish(req));
    const { id } = (await res.json()) as { id: string };
    pageIds.push(id);
    expect(links((await getDoc(id))!.blocks)).toEqual([]);
  });

  test("deleting a page removes its links in both directions", async () => {
    const a = await account();
    const target = await published(a, { raw: "# Target page" });
    const source = await published(a, { raw: "# Source page\n\n[[Target page]]" });
    await expect.poll(async () => (await getBacklinkPages(target)).length).toBe(1);

    expect((await v1Delete(api(a, `/pages/${source}`, { method: "DELETE" }), ctx(source))).status).toBe(200);
    const db = await getDb();
    expect(await db.collection("page_links").countDocuments({ $or: [{ source_id: source }, { target_id: source }] })).toBe(0);
  });

  test("deleting an account removes the links of its pages", async () => {
    const a = await account();
    const target = await published(a, { raw: "# Kept target" });
    await published(a, { raw: "# Linker\n\n[[Kept target]]" });
    await expect.poll(async () => (await getBacklinkPages(target)).length).toBe(1);
    await deleteAccount(a.userId);
    expect(await (await getDb()).collection("page_links").countDocuments({ target_id: target })).toBe(0);
  });
});

// ─── 5.5 Team-only visibility ────────────────────────────────────────────────

test.describe("team-only visibility", () => {
  test("a member opens the page and everyone else gets a 404", async () => {
    const owner = await account();
    const member = await account();
    const outsider = await account();
    const s = await space(owner, [[member, "viewer"]]);
    const id = await published(owner, { raw: "# Secret incident\n\nBody.", space: s.slug, visibility: "team" });
    const page = (await getPageRecord(id))!;
    expect(page.visibility).toBe("team");
    expect(page.collection_id).toBe(s.id);

    expect(await canViewPage(page, owner.userId)).toBe(true);
    expect(await canViewPage(page, member.userId)).toBe(true);
    expect(await canViewPage(page, outsider.userId)).toBe(false);
    expect(await canViewPage(page, null)).toBe(false);

    const render = async () => html(await SharePage({ params: Promise.resolve({ id }) }));
    const metadata = () => generateMetadata({ params: Promise.resolve({ id }) });

    expect(await as(member.cookie, render)).toContain("Team only");
    expect((await as(member.cookie, metadata)).title).toContain("Secret incident");
    expect((await as(member.cookie, metadata)).robots).toMatchObject({ index: false });

    for (const cookie of [outsider.cookie, null]) {
      // notFound() is what makes the response a real 404 (see not-found.tsx).
      await expect(as(cookie, render)).rejects.toMatchObject({ digest: expect.stringContaining("404") });
      const meta = await as(cookie, metadata);
      expect(JSON.stringify(meta)).not.toContain("Secret incident");
      expect(meta.title).toContain("Not found");
    }
  });

  test("the page is never served as Markdown or as an embed, even to a member", async () => {
    const owner = await account();
    const s = await space(owner);
    const id = await published(owner, { raw: "# Team notes", space: s.slug, visibility: "team" });
    const req = web(owner.cookie, `/api/pages/${id}/markdown`, { method: "GET" });
    expect((await withRequestScope(req, () => markdown(req, ctx(id)))).status).toBe(404);
    const meta = await as(owner.cookie, () => embedMetadata({ params: Promise.resolve({ id }) }));
    expect(JSON.stringify(meta)).not.toContain("Team notes");
  });

  test("the API rejects `team` on a page outside a team space with 422", async () => {
    const a = await account();
    const created = await publish(a, { raw: "# No space", visibility: "team" });
    expect(created.status).toBe(422);
    expect(created.code).toBe("TEAM_VISIBILITY_NEEDS_SPACE");
    expect((await publish(a, { raw: "---\nvisibility: team\n---\n# No space" })).status).toBe(422);

    const id = await published(a, { raw: "# Personal" });
    const patch = await v1Patch(api(a, `/pages/${id}`, { method: "PATCH", body: { visibility: "team" } }), ctx(id));
    expect(patch.status).toBe(422);
    expect((await getPageRecord(id))?.visibility).toBe("unlisted");

    const req = web(a.cookie, `/api/pages/${id}`, { method: "PATCH", body: { visibility: "team" } });
    expect((await withRequestScope(req, () => webPatchMeta(req, ctx(id)))).status).toBe(422);

    // A folder is not a team space.
    const folder = createId(10);
    spaceIds.push(folder);
    await createCollectionRecord(folder, a.userId, `Folder ${folder}`);
    await updatePageRecord(id, { collection_id: folder });
    const again = await v1Patch(api(a, `/pages/${id}`, { method: "PATCH", body: { visibility: "team" } }), ctx(id));
    expect(again.status).toBe(422);
  });

  test("only someone who can write to a space can publish into it", async () => {
    const owner = await account();
    const editor = await account();
    const viewer = await account();
    const outsider = await account();
    const s = await space(owner, [[editor, "editor"], [viewer, "viewer"]]);
    const body = { raw: "# Into the space", space: s.slug, visibility: "team" };

    expect((await publish(editor, body)).status).toBe(201);
    expect((await publish(viewer, body)).status).toBe(403);
    // 404, not 403: an outsider learns nothing about which slugs exist.
    const refused = await publish(outsider, body);
    expect(refused.status).toBe(404);
    expect(refused.code).toBe("SPACE_NOT_FOUND");
    expect((await publish(outsider, { raw: "# x", space: { $ne: null } })).status).toBe(404);

    // Frontmatter can name the space as well.
    const viaFrontmatter = await published(editor, { raw: `---\nspace: ${s.slug}\nvisibility: team\n---\n# From a file` });
    expect((await getPageRecord(viaFrontmatter))?.collection_id).toBe(s.id);
  });

  test("the editor's publish route takes a space id and applies the same rules", async () => {
    const owner = await account();
    const outsider = await account();
    const s = await space(owner);
    const body = { raw: "# From the editor", visibility: "team", space_id: s.id };

    const ok = web(owner.cookie, "/api/publish", { body });
    const res = await withRequestScope(ok, () => webPublish(ok));
    expect(res.status).toBe(200);
    const { id } = (await res.json()) as { id: string };
    pageIds.push(id);
    expect(await getPageRecord(id)).toMatchObject({ visibility: "team", collection_id: s.id });

    const denied = web(outsider.cookie, "/api/publish", { body });
    expect((await withRequestScope(denied, () => webPublish(denied))).status).toBe(404);
    const noSpace = web(owner.cookie, "/api/publish", { body: { raw: "# x", visibility: "team" } });
    expect((await withRequestScope(noSpace, () => webPublish(noSpace))).status).toBe(422);
  });

  test("a team-only page whose space is deleted is readable by its owner alone", async () => {
    const owner = await account();
    const member = await account();
    const s = await space(owner, [[member, "editor"]]);
    const id = await published(member, { raw: "# Orphaned", space: s.slug, visibility: "team" });
    await deleteCollectionRecord(s.id, owner.userId);
    const page = (await getPageRecord(id))!;
    expect(await canViewPage(page, member.userId)).toBe(true);
    expect(await canViewPage(page, owner.userId)).toBe(false);
    expect(await canViewPage(page, null)).toBe(false);
  });

  test("a team-only page cannot be moved out of its space; a writer can move their own pages in", async () => {
    const owner = await account();
    const editor = await account();
    const viewer = await account();
    const s = await space(owner, [[editor, "editor"], [viewer, "viewer"]]);
    const teamPage = await published(editor, { raw: "# Stays put", space: s.slug, visibility: "team" });

    const out = web(editor.cookie, `/api/collections/${s.id}/pages`, { method: "DELETE", body: { pageId: teamPage } });
    expect((await withRequestScope(out, () => removeFromCollection(out, ctx(s.id)))).status).toBe(422);
    expect((await getPageRecord(teamPage))?.collection_id).toBe(s.id);

    const mine = await published(editor, { raw: "# Mine" });
    const add = web(editor.cookie, `/api/collections/${s.id}/pages`, { body: { pageId: mine } });
    expect((await withRequestScope(add, () => addToCollection(add, ctx(s.id)))).status).toBe(200);
    expect((await getPageRecord(mine))?.collection_id).toBe(s.id);

    const theirs = await published(viewer, { raw: "# Viewer's" });
    const refused = web(viewer.cookie, `/api/collections/${s.id}/pages`, { body: { pageId: theirs } });
    expect((await withRequestScope(refused, () => addToCollection(refused, ctx(s.id)))).status).toBe(403);
  });

  test("a removed member's leftover page is no window into the space", async () => {
    const owner = await account();
    const removed = await account();
    const s = await space(owner, [[removed, "editor"]]);
    const leftover = await published(removed, { raw: "# Leftover", space: s.slug });
    await removeCollectionMember(s.id, removed.userId);
    // Published after the removal: a title the removed member never saw.
    const secret = await published(owner, { raw: "# Q4 reorganisation plan", space: s.slug, visibility: "team" });

    // They cannot make the leftover page team-only, which would let it link to team-only pages.
    const toTeam = await v1Patch(api(removed, `/pages/${leftover}`, { method: "PATCH", body: { visibility: "team" } }), ctx(leftover));
    expect(toTeam.status).toBe(422);
    const viaWeb = web(removed.cookie, `/api/pages/${leftover}`, { method: "PATCH", body: { visibility: "team" } });
    expect((await withRequestScope(viaWeb, () => webPatchMeta(viaWeb, ctx(leftover)))).status).toBe(422);

    // And guessing titles through it resolves nothing in the space, by the API or the editor.
    const guess = "# Leftover\n\n[[Q4 reorganisation plan]]";
    expect((await v1Patch(api(removed, `/pages/${leftover}`, { method: "PATCH", body: { raw: guess } }), ctx(leftover))).status).toBe(200);
    expect(links((await getDoc(leftover))!.blocks)).toEqual([]);
    const update = web(removed.cookie, `/api/publish/${leftover}`, { method: "PATCH", body: { raw: guess } });
    expect((await withRequestScope(update, () => webUpdate(update, ctx(leftover)))).status).toBe(200);
    expect(JSON.stringify((await getDoc(leftover))!.blocks)).not.toContain(secret);
    expect((await getBacklinkPages(secret)).map((p) => p.id)).toEqual([]);
  });

  test("opening an invite again does not change a member's role", async () => {
    process.env.INVITE_JWT_SECRET ??= "test-only-invite-secret-do-not-use-in-prod";
    const owner = await account();
    const viewer = await account();
    const address = `viewer-${crypto.randomUUID()}@example.com`;
    await createUser(viewer.userId, address, null);
    const s = await space(owner, [[viewer, "viewer"]]);
    const token = await signInviteToken({ teamId: s.id, invitedEmail: address, invitedBy: owner.userId });
    await as(viewer.cookie, () => JoinPage({ searchParams: Promise.resolve({ token }) })).catch(() => {});
    expect((await getCollectionMember(s.id, viewer.userId))?.role).toBe("viewer");
    await (await getDb()).collection("users").deleteOne({ _id: viewer.userId } as never);
  });

  test("`?space=` lists the whole space to a member and is a 404 to anyone else", async () => {
    const owner = await account();
    const member = await account();
    const outsider = await account();
    const s = await space(owner, [[member, "viewer"]]);
    const theirs = await published(owner, { raw: "---\ntype: adr\n---\n# ADR-040 Theirs", space: s.slug, visibility: "team" });
    await published(member, { raw: "# Mine, elsewhere" });

    const res = await v1List(api(member, `/pages?space=${s.slug}&type=adr`));
    const body = (await res.json()) as { pages: Array<{ id: string; space: string | null; visibility: string }> };
    expect(body.pages).toEqual([expect.objectContaining({ id: theirs, space: s.slug, visibility: "team" })]);

    expect((await v1List(api(outsider, `/pages?space=${s.slug}`))).status).toBe(404);
    // Without `space`, a member's list is still only their own pages.
    const own = (await (await v1List(api(member, "/pages"))).json()) as { pages: Array<{ id: string }> };
    expect(own.pages.map((p) => p.id)).not.toContain(theirs);
    // And another member's page is still not theirs to read or change by id.
    expect((await v1Get(api(member, `/pages/${theirs}`), ctx(theirs))).status).toBe(403);
  });

  test("the account export includes team-only pages the user owns", async () => {
    const owner = await account();
    const s = await space(owner);
    const id = await published(owner, { raw: "# Team export", space: s.slug, visibility: "team" });
    const file = join(mkdtempSync(join(tmpdir(), "booklet-export-")), "pages.zip");
    writeFileSync(file, await exportPagesZip(owner.userId, ORIGIN));
    const md = execFileSync("unzip", ["-p", file, `${id}.md`]).toString();
    expect(md).toContain("visibility: team");
    expect(md).toContain("# Team export");
  });

  test("a takedown does not turn a team-only page into an unlisted one", async () => {
    const owner = await account();
    const s = await space(owner);
    const teamPage = await published(owner, { raw: "# Team", space: s.slug, visibility: "team" });
    const publicPage = await published(owner, { raw: "# Public", visibility: "public" });
    const at = new Date().toISOString();
    await markPageTakenDown(teamPage, at);
    await markPageTakenDown(publicPage, at);
    expect(await getPageRecord(teamPage)).toMatchObject({ visibility: "team", taken_down_at: at });
    expect(await getPageRecord(publicPage)).toMatchObject({ visibility: "unlisted", taken_down_at: at });
  });
});

// ─── 5.6 Team space home ─────────────────────────────────────────────────────

const pageRow = (over: Partial<DbPage>): DbPage => ({
  id: createId(10),
  user_id: "u",
  slug: null,
  title: null,
  visibility: "public",
  doc_type: null,
  collection_id: "c",
  team_id: null,
  view_count: 0,
  password_hash: null,
  frontmatter_meta: null,
  taken_down_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

test.describe("team space home", () => {
  test("2 ADRs, 1 incident and 1 untyped page make three groups", () => {
    const groups = groupSpacePages([
      pageRow({ title: "ADR-012 Queue retries", doc_type: "adr" }),
      pageRow({ title: "ADR-003 Polling", doc_type: "adr" }),
      pageRow({ title: "Outage", doc_type: "incident" }),
      pageRow({ title: "Team lunch" }),
    ]);
    expect(groups.map((g) => [g.key, g.pages.length])).toEqual([["incident", 1], ["adr", 2], ["other", 1]]);
    // The decision log reads in number order.
    expect(groups[1].pages.map((p) => p.title)).toEqual(["ADR-003 Polling", "ADR-012 Queue retries"]);
  });

  test("incidents sort by their own date, newest first, falling back to publish time", () => {
    const [incidents] = groupSpacePages([
      pageRow({ title: "old", doc_type: "incident", frontmatter_meta: { date: "2026-03-01" }, created_at: "2026-09-01T00:00:00.000Z" }),
      pageRow({ title: "new", doc_type: "incident", frontmatter_meta: { date: "2026-08-01" } }),
      pageRow({ title: "undated", doc_type: "incident", created_at: "2026-05-01T00:00:00.000Z" }),
    ]);
    expect(incidents.pages.map((p) => p.title)).toEqual(["new", "undated", "old"]);
  });

  test("adrNumber reads the number from a title", () => {
    expect(adrNumber("ADR-012 Queue retries")).toBe(12);
    expect(adrNumber("ADR 7: Use Postgres")).toBe(7);
    expect(adrNumber("Untitled decision")).toBeNull();
  });

  test("a space with public pages serves a well-formed Atom feed of those pages only", async () => {
    const owner = await account();
    const s = await space(owner);
    const pub = await published(owner, { raw: "---\ntype: adr\n---\n# ADR-050 A < B & \"quoted\"", space: s.slug, visibility: "public" });
    await published(owner, { raw: "# Team secret", space: s.slug, visibility: "team" });
    await published(owner, { raw: "# Unlisted draft", space: s.slug });

    const res = await spaceFeed(new Request(`${ORIGIN}/t/${s.slug}/feed.xml`), { params: Promise.resolve({ slug: s.slug }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/atom+xml");
    const xml = await res.text();
    expect(xml).not.toContain("Team secret");
    expect(xml).not.toContain("Unlisted draft");

    const doc = new JSDOM(xml, { contentType: "application/xml" }).window.document;
    expect(doc.querySelector("parsererror")).toBeNull();
    const feed = doc.documentElement;
    expect(feed.namespaceURI).toBe("http://www.w3.org/2005/Atom");
    // RFC 4287: a feed needs id, title, updated and an author; an entry needs id, title, updated.
    for (const tag of ["id", "title", "updated", "author"]) expect(feed.querySelector(`:scope > ${tag}`), tag).not.toBeNull();
    const entries = [...feed.querySelectorAll("entry")];
    expect(entries).toHaveLength(1);
    expect(entries[0].querySelector("title")?.textContent).toBe('ADR-050 A < B & "quoted"');
    expect(entries[0].querySelector("id")?.textContent).toBe(`${ORIGIN}/p/${pub}`);
    expect(entries[0].querySelector("updated")?.textContent).toMatch(/^\d{4}-\d\d-\d\dT[\d:.]+Z$/);
    expect(entries[0].querySelector("category")?.getAttribute("term")).toBe("adr");
  });

  test("a space with no public pages serves no feed, and neither does a space that does not exist", async () => {
    const owner = await account();
    const s = await space(owner);
    await published(owner, { raw: "# Team only", space: s.slug, visibility: "team" });
    const get = (slug: string) => spaceFeed(new Request(`${ORIGIN}/t/${slug}/feed.xml`), { params: Promise.resolve({ slug }) });
    expect((await get(s.slug)).status).toBe(404);
    expect((await get("no-such-space")).status).toBe(404);
  });

  test("buildSpaceFeed drops characters XML does not allow", () => {
    const xml = buildSpaceFeed({ name: "T\u0001eam", slug: "team" }, [pageRow({ title: "a\u0008b" })], ORIGIN);
    expect(new JSDOM(xml, { contentType: "application/xml" }).window.document.querySelector("parsererror")).toBeNull();
  });
});

// ─── 5.7 MCP workflow tools ──────────────────────────────────────────────────

test.describe("MCP workflow tools", () => {
  test("create_document with type adr publishes a page with the ADR frontmatter and header strip", async () => {
    const a = await account();
    const result = await withApi(() =>
      handleCreateDocument(
        { type: "adr", title: 'ADR-060 "Quoted": title', body: "## Context\n\nWhy.", status: "Proposed", owners: ["platform"] },
        a.rawKey,
        ORIGIN,
      ),
    );
    expect(result.isError).toBeFalsy();
    const { id } = result.structuredContent as { id: string; type: string };
    pageIds.push(id);

    const record = await getPageRecord(id);
    expect(record).toMatchObject({ doc_type: "adr", title: 'ADR-060 "Quoted": title', visibility: "unlisted" });
    expect(record?.frontmatter_meta).toMatchObject({ type: "adr", status: "Proposed", owners: ["platform"] });

    const got = await withApi(() => handleGetPage({ id }, a.rawKey, ORIGIN));
    expect((got.content[0] as { text: string }).text).toContain('type: "adr"');

    const strip = await html(DocHeaderStrip({ meta: record!.frontmatter_meta, userId: a.userId }));
    expect(strip).toContain('data-doc-type="adr"');
    expect(strip).toContain('data-status="Proposed"');
  });

  test("create_document into a space, and search_pages by query, type and space", async () => {
    const owner = await account();
    const member = await account();
    const s = await space(owner, [[member, "editor"]]);
    const created = await withApi(() =>
      handleCreateDocument(
        { type: "incident", title: "Checkout outage", body: "Down for 5 minutes.", space: s.slug, visibility: "team", severity: "P1" },
        owner.rawKey,
        ORIGIN,
      ),
    );
    const { id } = created.structuredContent as { id: string };
    pageIds.push(id);
    expect(await getPageRecord(id)).toMatchObject({ visibility: "team", collection_id: s.id, doc_type: "incident" });

    // A member finds a teammate's page through the space.
    const found = await withApi(() => handleSearchPages({ query: "checkout", type: "incident", space: s.slug }, member.rawKey, ORIGIN));
    expect((found.structuredContent as { pages: Array<{ id: string }> }).pages.map((p) => p.id)).toEqual([id]);
    // Not in their own pages, and not under another type.
    const own = await withApi(() => handleSearchPages({ query: "checkout" }, member.rawKey, ORIGIN));
    expect((own.structuredContent as { total: number }).total).toBe(0);
    const wrongType = await withApi(() => handleSearchPages({ type: "adr", space: s.slug }, member.rawKey, ORIGIN));
    expect((wrongType.structuredContent as { total: number }).total).toBe(0);
  });

  test("the tools say why a space was refused", async () => {
    const outsider = await account();
    const refused = await withApi(() =>
      handleCreateDocument({ type: "adr", title: "ADR-070", body: "x", space: "not-my-space", visibility: "team" }, outsider.rawKey, ORIGIN),
    );
    expect(refused.isError).toBe(true);
    expect((refused.content[0] as { text: string }).text).toContain("Team space not found");

    const noSpace = await withApi(() =>
      handleCreateDocument({ type: "adr", title: "ADR-071", body: "x", visibility: "team" }, outsider.rawKey, ORIGIN),
    );
    expect((noSpace.content[0] as { text: string }).text).toContain("only for a page in a team space");
  });
});

// ─── Found in review ─────────────────────────────────────────────────────────

test.describe("review findings", () => {
  test("publish_page merges its options into a document that already has frontmatter", async () => {
    const a = await account();
    const raw = renderPrompt("incident_report", { title: "Checkout", date: "2026-10-10" }) ?? "";
    const result = await withApi(() => handlePublishPage({ raw, title: "Custom title", visibility: "public" }, a.rawKey, ORIGIN));
    expect(result.isError).toBeFalsy();
    const { id } = result.structuredContent as { id: string };
    pageIds.push(id);
    expect(await getPageRecord(id)).toMatchObject({ doc_type: "incident", visibility: "public", title: "Custom title" });
    expect(text((await getDoc(id))!.blocks)).not.toContain("type:");

    // A title the document already sets is replaced, not declared twice.
    const twice = await withApi(() => handlePublishPage({ raw: '---\ntitle: "Old"\ntype: adr\n---\n# Body', title: "New" }, a.rawKey, ORIGIN));
    const second = (twice.structuredContent as { id: string }).id;
    pageIds.push(second);
    expect(await getPageRecord(second)).toMatchObject({ doc_type: "adr", title: "New" });
  });

  test("a page published without an account still shows its header strip, and keeps its type when claimed", async () => {
    const req = web(null, "/api/publish", { body: { raw: "---\ntype: incident\nstatus: Resolved\nseverity: P1\n---\n# Anonymous incident" } });
    const res = await withRequestScope(req, () => webPublish(req));
    const { id } = (await res.json()) as { id: string };
    pageIds.push(id);
    const page = await as(null, async () => html(await SharePage({ params: Promise.resolve({ id }) })));
    expect(page).toContain('data-doc-type="incident"');
    expect(page).toContain('data-status="Resolved"');

    const claimCookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
    const a = await account();
    const claimReq = web(`${a.cookie}; ${claimCookie}`, `/api/pages/${id}/claim`);
    expect((await withRequestScope(claimReq, () => claimPage(claimReq, ctx(id)))).status).toBe(200);
    expect(await getPageRecord(id)).toMatchObject({ doc_type: "incident", user_id: a.userId });
    expect((await getPageRecord(id))?.frontmatter_meta).toMatchObject({ status: "Resolved", severity: "P1" });
  });

  test("making a page public drops its links to pages that are not, and making it unlisted restores them", async () => {
    const a = await account();
    const target = await published(a, { raw: "# Link-only notes" });
    const source = await published(a, { raw: "# Source\n\n[[Link-only notes]]" });
    expect(links((await getDoc(source))!.blocks)).toEqual([`${ORIGIN}/p/${target}`]);
    await expect.poll(async () => (await getBacklinkPages(target)).length).toBe(1);

    const viaApi = await v1Patch(api(a, `/pages/${source}`, { method: "PATCH", body: { visibility: "public" } }), ctx(source));
    expect(viaApi.status).toBe(200);
    expect(links((await getDoc(source))!.blocks)).toEqual([]);
    expect(text((await getDoc(source))!.blocks)).toContain("Link-only notes");
    await expect.poll(async () => (await getBacklinkPages(target)).length).toBe(0);

    const back = web(a.cookie, `/api/pages/${source}`, { method: "PATCH", body: { visibility: "unlisted" } });
    expect((await withRequestScope(back, () => webPatchMeta(back, ctx(source)))).status).toBe(200);
    expect(links((await getDoc(source))!.blocks)).toEqual([`${ORIGIN}/p/${target}`]);

    const viaWeb = web(a.cookie, `/api/pages/${source}`, { method: "PATCH", body: { visibility: "public" } });
    expect((await withRequestScope(viaWeb, () => webPatchMeta(viaWeb, ctx(source)))).status).toBe(200);
    expect(links((await getDoc(source))!.blocks)).toEqual([]);
  });

  test("someone added as a viewer before they had an account joins as a viewer", async () => {
    process.env.INVITE_JWT_SECRET ??= "test-only-invite-secret-do-not-use-in-prod";
    const owner = await account();
    const invitee = await account();
    const address = `pending-${crypto.randomUUID()}@example.com`;
    const s = await space(owner);
    const add = web(owner.cookie, `/api/collections/${s.id}/members`, { body: { email: address, role: "viewer" } });
    expect((await withRequestScope(add, () => addMember(add, ctx(s.id)))).status).toBe(201);
    expect((await getCollectionMember(s.id, `pending:${address}`))?.role).toBe("viewer");

    await createUser(invitee.userId, address, null);
    const token = await signInviteToken({ teamId: s.id, invitedEmail: address, invitedBy: owner.userId });
    await as(invitee.cookie, () => JoinPage({ searchParams: Promise.resolve({ token }) })).catch(() => {});
    expect((await getCollectionMember(s.id, invitee.userId))?.role).toBe("viewer");
    expect(await getCollectionMember(s.id, `pending:${address}`)).toBeNull();
    await (await getDb()).collection("users").deleteOne({ _id: invitee.userId } as never);
  });

  test("removing one member leaves other people's invites working", async () => {
    process.env.INVITE_JWT_SECRET ??= "test-only-invite-secret-do-not-use-in-prod";
    const owner = await account();
    const leaving = await account();
    const invitee = await account();
    const address = `invitee-${crypto.randomUUID()}@example.com`;
    await createUser(invitee.userId, address, null);
    const s = await space(owner, [[leaving, "editor"]]);
    const token = await signInviteToken({ teamId: s.id, invitedEmail: address, invitedBy: owner.userId });

    await removeCollectionMember(s.id, leaving.userId);
    await as(invitee.cookie, () => JoinPage({ searchParams: Promise.resolve({ token }) })).catch(() => {});
    expect(await getCollectionMember(s.id, invitee.userId)).not.toBeNull();
    await (await getDb()).collection("users").deleteOne({ _id: invitee.userId } as never);
  });

  test("an oversized document is a 413 before anything else is looked at", async () => {
    const a = await account();
    const res = await publish(a, { raw: `---\nspace: no-such-space\n---\n${"x".repeat(200_001)}` });
    expect(res.status).toBe(413);
  });

  test("a removed member can take their own page out of the space", async () => {
    const owner = await account();
    const removed = await account();
    const s = await space(owner, [[removed, "editor"]]);
    const mine = await published(removed, { raw: "# Taking this with me", space: s.slug });
    await removeCollectionMember(s.id, removed.userId);

    const out = web(removed.cookie, `/api/collections/${s.id}/pages`, { method: "DELETE", body: { pageId: mine } });
    expect((await withRequestScope(out, () => removeFromCollection(out, ctx(s.id)))).status).toBe(200);
    expect((await getPageRecord(mine))?.collection_id).toBeNull();

    // Someone else's page is still not theirs to remove.
    const theirs = await published(owner, { raw: "# Owner's", space: s.slug });
    const nope = web(removed.cookie, `/api/collections/${s.id}/pages`, { method: "DELETE", body: { pageId: theirs } });
    expect((await withRequestScope(nope, () => removeFromCollection(nope, ctx(s.id)))).status).toBe(403);
  });
});
