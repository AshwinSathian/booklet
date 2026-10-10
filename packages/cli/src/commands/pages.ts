import { Command } from "commander";
import { DOC_TYPES, type DocType } from "booklet-api-client";
import { requireClient } from "../api.js";
import { CliError, EXIT, toCliError } from "../errors.js";
import { success, info, bold, dim, gray, openUrl, print, emit, isJson, table } from "../fmt.js";
import { createInterface } from "readline";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

async function confirm(question: string): Promise<boolean> {
  // The prompt goes to stderr: under --json, stdout carries only the result.
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (ans) => {
      rl.close();
      resolve(ans.trim().toLowerCase() === "y");
    });
  });
}

export function registerPagesCommand(program: Command) {
  const pages = program
    .command("pages")
    .description("Manage your Booklet pages");

  pages
    .command("list")
    .description("List all your pages")
    .option("--query <text>", "Only show pages whose title contains this text")
    .option("--tag <tag>", "Only show pages with this exact frontmatter tag")
    .option("--type <type>", `Only show this document type (${DOC_TYPES.join(", ")})`)
    .option("--space <slug>", "List a team space you belong to (every member's pages) instead of your own pages")
    .action(async (opts: { query?: string; tag?: string; type?: string; space?: string }) => {
      if (opts.type !== undefined && !(DOC_TYPES as readonly string[]).includes(opts.type)) {
        throw new CliError(`--type must be one of: ${DOC_TYPES.join(", ")}.`, EXIT.USAGE);
      }
      const items = await (await requireClient()).listAllPages({
        query: opts.query,
        tag: opts.tag,
        type: opts.type as DocType | undefined,
        space: opts.space,
      });

      if (isJson()) {
        emit(items);
        return;
      }

      if (items.length === 0) {
        info(
          opts.query || opts.tag || opts.type || opts.space
            ? "No pages matched that filter."
            : "No pages yet. Run `booklet publish <file>` to create one.",
        );
        return;
      }

      print();
      table(
        ["Title", "ID / Slug", "Type", "Visibility", "Views", "Updated"],
        items.map((p) => [
          p.title ?? dim("Untitled"),
          p.slug ?? gray(p.id),
          p.doc_type ?? "",
          p.visibility,
          p.view_count,
          formatDate(p.updated_at),
        ]),
      );
      print();
      info(`${items.length} page${items.length === 1 ? "" : "s"}`);
    });

  pages
    .command("open <id>")
    .description("Open a page in your browser (use --print to just print the URL)")
    .option("--print", "Print the URL instead of opening a browser")
    .action(async (id: string, opts: { print?: boolean }) => {
      // GET /pages/:id accepts a page ID or a custom slug.
      const { raw: _raw, etag: _etag, ...page } = await (await requireClient()).getPage(id);

      print(bold(page.url));
      emit(page);
      if (!opts.print && !isJson()) {
        openUrl(page.url);
      }
    });

  pages
    .command("delete <id>")
    .description("Delete a page by ID or slug")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (id: string, opts: { yes?: boolean }) => {
      const client = await requireClient();

      // Resolves a slug to the real page ID (DELETE does not accept slugs),
      // and gives the title and URL for the confirmation prompt.
      const page = await client.getPage(id);

      if (!opts.yes) {
        if (!process.stdin.isTTY) {
          throw new CliError("Refusing to delete without confirmation. Pass --yes when not running in a terminal.", EXIT.USAGE);
        }
        const ok = await confirm(`Permanently delete "${page.title ?? "Untitled"}" ${dim(`(${page.url})`)}?`);
        if (!ok) {
          info("Aborted.");
          emit({ deleted: false, id: page.id });
          return;
        }
      }

      await client.deletePage(page.id).catch((e) => {
        throw toCliError(e, "Delete failed");
      });

      success(`Deleted page ${page.id}`);
      emit({ deleted: true, id: page.id });
    });
}
