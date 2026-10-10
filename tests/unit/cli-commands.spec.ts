import { test, expect } from "@playwright/test";
import { execFile, execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Every CLI command, run as a real child process against a stub API:
// the --json shape on stdout and the exit code.

const CLI_DIR = resolve(__dirname, "../../packages/cli");
const BIN = join(CLI_DIR, "dist/index.js");
const KEY = "bklt_" + "a".repeat(40);

const PAGE = {
  id: "Ab3k91QxZp",
  title: "Release Notes",
  slug: "release-notes",
  visibility: "unlisted",
  view_count: 3,
  url: "https://example.test/p/release-notes",
  created_at: "2026-04-29T10:00:00.000Z",
  updated_at: "2026-04-29T12:00:00.000Z",
};

const problem = (status: number, detail: string) => ({ type: "about:blank", title: "x", status, detail, error: detail });

let server: Server;
let base: string;
let home: string;
/** Requests the stub saw, as "METHOD path". */
let seen: string[] = [];
/** How many more requests get a 429 before the stub answers normally. */
let rateLimitNext = 0;

test.beforeAll(async () => {
  execFileSync("npx", ["tsup"], { cwd: CLI_DIR, stdio: "ignore" });
  home = mkdtempSync(join(tmpdir(), "booklet-cli-spec-"));

  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://stub");
    seen.push(`${req.method} ${url.pathname}${url.search}`);
    const send = (status: number, body: unknown, headers: Record<string, string> = {}) => {
      res.writeHead(status, { "Content-Type": status >= 400 ? "application/problem+json" : "application/json", ...headers });
      res.end(JSON.stringify(body));
    };
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (rateLimitNext > 0) {
        rateLimitNext--;
        return send(429, problem(429, "Too many requests."), { "Retry-After": "1" });
      }
      if (req.headers.authorization !== `Bearer ${KEY}`) return send(401, problem(401, "Unauthorized"));

      if (url.pathname === "/api/v1/pages" && req.method === "GET") {
        // Two pages of results, to prove the CLI follows next_cursor.
        const second = url.searchParams.get("cursor") === "c2";
        return send(200, {
          pages: [second ? { ...PAGE, id: "SecondPage", slug: null } : PAGE],
          total: 2,
          limit: 100,
          offset: 0,
          next_cursor: second ? null : "c2",
        });
      }
      if (url.pathname === "/api/v1/publish" && req.method === "POST") {
        return send(201, { id: "NewPage001", url: "https://example.test/p/NewPage001" });
      }
      const m = /^\/api\/v1\/pages\/([^/]+)$/.exec(url.pathname);
      if (m) {
        if (m[1] === "missing") return send(404, problem(404, "Page not found"));
        if (req.method === "GET") return send(200, { ...PAGE, raw: "# Release Notes\n\nBody.\n" }, { ETag: '"abc"' });
        if (req.method === "PATCH") return send(200, { id: m[1], url: `https://example.test/p/${JSON.parse(body).slug ?? m[1]}` });
        if (req.method === "DELETE") return send(200, { ok: true });
      }
      send(500, problem(500, "stub: unhandled route"));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

test.afterAll(() => server.close());
test.beforeEach(() => {
  seen = [];
  rateLimitNext = 0;
});

// The stub is shared state (seen, rateLimitNext), so these run in order.
test.describe.configure({ mode: "serial" });

type Run = { code: number; stdout: string; stderr: string; json: () => unknown };

function cli(args: string[], opts: { key?: string | null; stdin?: string; cwd?: string } = {}): Promise<Run> {
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "",
    HOME: home,
    NO_COLOR: "1",
    BOOKLET_NO_KEYCHAIN: "1",
    BOOKLET_API_URL: base,
  };
  if (opts.key !== null) env.BOOKLET_API_KEY = opts.key ?? KEY;
  return new Promise((done) => {
    const child = execFile(process.execPath, [BIN, ...args], { env: env as NodeJS.ProcessEnv, cwd: opts.cwd ?? home }, (err, stdout, stderr) => {
      const code = err ? (typeof err.code === "number" ? err.code : 1) : 0;
      done({ code, stdout, stderr, json: () => JSON.parse(stdout) });
    });
    child.stdin?.end(opts.stdin ?? "");
  });
}

test("publish --json: {id, url, updated}, exit 0", async () => {
  const r = await cli(["publish", "-", "--json"], { stdin: "# Hello" });
  expect(r.code).toBe(0);
  expect(r.json()).toEqual({ id: "NewPage001", url: "https://example.test/p/NewPage001", updated: false });
});

test("publish --update and --slug --json", async () => {
  const updated = await cli(["publish", "-", "--update", "Ab3k91QxZp", "--json"], { stdin: "# Hello" });
  expect(updated.code).toBe(0);
  expect(updated.json()).toMatchObject({ id: "Ab3k91QxZp", updated: true });

  const slugged = await cli(["publish", "-", "--slug", "my-slug", "--json"], { stdin: "# Hello" });
  expect(slugged.json()).toEqual({ id: "NewPage001", url: "https://example.test/p/my-slug", updated: false });
});

test("pages list --json follows next_cursor and prints an array", async () => {
  const r = await cli(["pages", "list", "--json"]);
  expect(r.code).toBe(0);
  const pages = r.json() as { id: string }[];
  expect(pages.map((p) => p.id)).toEqual(["Ab3k91QxZp", "SecondPage"]);
  expect(seen.filter((s) => s.startsWith("GET /api/v1/pages?"))).toHaveLength(2);
});

test("--json works before the subcommand too", async () => {
  const r = await cli(["--json", "pages", "list"]);
  expect(Array.isArray(r.json())).toBe(true);
});

test("pages open --json prints the page and does not need a browser", async () => {
  const r = await cli(["pages", "open", "release-notes", "--json"]);
  expect(r.code).toBe(0);
  expect(r.json()).toEqual(PAGE);
});

test("pages delete --yes --json; without --yes off a terminal it is a usage error", async () => {
  const ok = await cli(["pages", "delete", "release-notes", "--yes", "--json"]);
  expect(ok.code).toBe(0);
  expect(ok.json()).toEqual({ deleted: true, id: "Ab3k91QxZp" });
  expect(seen).toContain("DELETE /api/v1/pages/Ab3k91QxZp");

  seen = [];
  const refused = await cli(["pages", "delete", "release-notes", "--json"]);
  expect(refused.code).toBe(2);
  expect(seen.some((s) => s.startsWith("DELETE"))).toBe(false);
});

test("pull writes Markdown to stdout, to -o <file>, or the page as --json", async () => {
  const out = await cli(["pull", "Ab3k91QxZp"]);
  expect(out.code).toBe(0);
  expect(out.stdout).toBe("# Release Notes\n\nBody.\n");

  const file = join(home, "pulled.md");
  const toFile = await cli(["pull", "Ab3k91QxZp", "-o", file, "--json"]);
  expect(toFile.json()).toEqual({ id: "Ab3k91QxZp", url: PAGE.url, file });
  expect(readFileSync(file, "utf8")).toBe("# Release Notes\n\nBody.\n");

  const asJson = await cli(["pull", "Ab3k91QxZp", "--json"]);
  expect(asJson.json()).toMatchObject({ id: "Ab3k91QxZp", raw: "# Release Notes\n\nBody.\n" });
});

test("new writes a template, refuses to overwrite, and rejects an unknown name", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "booklet-cli-new-"));
  const r = await cli(["new", "adr", "--json"], { cwd, key: null }); // needs no credentials
  expect(r.code).toBe(0);
  expect(r.json()).toEqual({ template: "adr", file: "adr.md" });
  expect(readFileSync(join(cwd, "adr.md"), "utf8")).toContain("## Decision");

  writeFileSync(join(cwd, "adr.md"), "mine");
  const again = await cli(["new", "adr", "--json"], { cwd });
  expect(again.code).toBe(1);
  expect(readFileSync(join(cwd, "adr.md"), "utf8")).toBe("mine");

  const unknown = await cli(["new", "nope"], { cwd });
  expect(unknown.code).toBe(2);
  expect(existsSync(join(cwd, "nope.md"))).toBe(false);

  for (const name of ["incident", "rfc", "runbook", "release-notes"]) {
    expect((await cli(["new", name, "--json"], { cwd })).code, name).toBe(0);
  }
});

test("whoami, login --key and logout --json", async () => {
  const who = await cli(["whoami", "--json"]);
  expect(who.json()).toMatchObject({ authenticated: true, base, source: "BOOKLET_API_KEY (env)" });
  expect(who.stdout).not.toContain(KEY);

  const anon = await cli(["whoami", "--json"], { key: null });
  expect(anon.code).toBe(0);
  expect(anon.json()).toEqual({ authenticated: false });

  const login = await cli(["login", "--key", KEY, "--api-url", base, "--json"], { key: null });
  expect(login.code).toBe(0);
  expect(login.json()).toEqual({ authenticated: true, base, pages: 2 });
  // The saved key now works without the environment variable.
  expect((await cli(["pages", "list", "--json"], { key: null })).code).toBe(0);

  const logout = await cli(["logout", "--json"], { key: null });
  expect(logout.json()).toEqual({ logged_out: true });
  expect((await cli(["pages", "list", "--json"], { key: null })).code).toBe(3);

  const badLogin = await cli(["login", "--key", "bklt_" + "b".repeat(40), "--api-url", base, "--json"], { key: null });
  expect(badLogin.code).toBe(3);
});

test("completion --json", async () => {
  const r = await cli(["completion", "zsh", "--json"]);
  expect(r.json()).toMatchObject({ shell: "zsh" });
  expect((await cli(["completion", "tcsh"])).code).toBe(2);
});

test.describe("exit codes", () => {
  test("2 for a usage error, 0 for --help, and --help lists the codes", async () => {
    expect((await cli(["no-such-command"])).code).toBe(2);
    expect((await cli(["publish", "--no-such-flag"])).code).toBe(2);
    expect((await cli(["pull"])).code).toBe(2);
    const help = await cli(["--help"]);
    expect(help.code).toBe(0);
    for (const line of ["0  success", "2  usage error", "3  not authenticated", "4  page not found", "5  rate limited"]) {
      expect(help.stdout).toContain(line);
    }
  });

  test("3 when not authenticated or the key is rejected; the error is JSON on stderr", async () => {
    const none = await cli(["pages", "list", "--json"], { key: null });
    expect(none.code).toBe(3);
    expect(none.stdout).toBe("");
    expect(JSON.parse(none.stderr)).toMatchObject({ exit_code: 3 });

    const bad = await cli(["pages", "list", "--json"], { key: "bklt_" + "z".repeat(40) });
    expect(bad.code).toBe(3);
    expect(JSON.parse(bad.stderr)).toEqual({ error: "Unauthorized", exit_code: 3, status: 401 });
  });

  test("4 when the page does not exist", async () => {
    for (const args of [["pull", "missing"], ["pages", "open", "missing", "--print"], ["pages", "delete", "missing", "--yes"]]) {
      expect((await cli(args)).code, args.join(" ")).toBe(4);
    }
  });

  test("1 for other failures", async () => {
    expect((await cli(["publish", join(home, "does-not-exist.md")])).code).toBe(1);
  });

  test("a 429 is retried once after Retry-After; a second 429 exits 5", async () => {
    rateLimitNext = 1;
    const started = Date.now();
    const retried = await cli(["publish", "-", "--json"], { stdin: "# Hello" });
    expect(retried.code).toBe(0);
    expect(Date.now() - started).toBeGreaterThanOrEqual(1000);
    expect(seen.filter((s) => s === "POST /api/v1/publish")).toHaveLength(2);

    seen = [];
    rateLimitNext = 2;
    const limited = await cli(["publish", "-", "--json"], { stdin: "# Hello" });
    expect(limited.code).toBe(5);
    expect(seen.filter((s) => s === "POST /api/v1/publish")).toHaveLength(2); // once, not forever
    expect(JSON.parse(limited.stderr)).toMatchObject({ exit_code: 5, status: 429 });
  });
});
