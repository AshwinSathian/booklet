import { Command } from "commander";
import { getClient, apiErrorMessage, NOT_AUTHENTICATED_ERROR } from "../api.js";
import { success, error, info, bold, dim, gray, openUrl } from "../fmt.js";
import { table } from "../fmt.js";
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
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
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
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const client = await getClient();
      if (!client) {
        error(NOT_AUTHENTICATED_ERROR);
        process.exit(1);
      }

      let items;
      try {
        items = (await client.listPages()).pages;
      } catch (e) {
        error(apiErrorMessage(e));
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(items, null, 2));
        return;
      }

      if (items.length === 0) {
        info("No pages yet. Run `booklet publish <file>` to create one.");
        return;
      }

      console.log();
      table(
        ["Title", "ID / Slug", "Visibility", "Views", "Updated"],
        items.map((p) => [
          p.title ?? dim("Untitled"),
          p.slug ?? gray(p.id),
          p.visibility,
          p.view_count,
          formatDate(p.updated_at),
        ]),
      );
      console.log();
      info(`${items.length} page${items.length === 1 ? "" : "s"}`);
    });

  pages
    .command("open <id>")
    .description("Open a page in your browser (use --print to just print the URL)")
    .option("--print", "Print the URL instead of opening a browser")
    .action(async (id: string, opts: { print?: boolean }) => {
      const client = await getClient();
      if (!client) {
        error(NOT_AUTHENTICATED_ERROR);
        process.exit(1);
      }

      let pages;
      try {
        pages = (await client.listPages()).pages;
      } catch (e) {
        error(apiErrorMessage(e));
        process.exit(1);
      }
      const page = pages.find((p) => p.id === id || p.slug === id);
      if (!page) {
        error(`Page not found: ${id}`);
        process.exit(1);
      }
      console.log(bold(page.url));
      if (!opts.print) {
        openUrl(page.url);
      }
    });

  pages
    .command("delete <id>")
    .description("Delete a page by ID or slug")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (id: string, opts: { yes?: boolean }) => {
      const client = await getClient();
      if (!client) {
        error(NOT_AUTHENTICATED_ERROR);
        process.exit(1);
      }

      // Resolve the real page ID (DELETE endpoint does not accept slugs).
      // This fetch also gives us the title and URL for the confirmation prompt.
      const page = await client
        .listPages()
        .then(({ pages }) => pages.find((p) => p.id === id || p.slug === id))
        .catch(() => null);

      // Canonical ID to pass to the DELETE endpoint
      const pageId = page?.id ?? id;

      if (!opts.yes) {
        const label = page
          ? `"${page.title ?? "Untitled"}" ${dim(`(${page.url})`)}`
          : bold(id);

        const ok = await confirm(`Permanently delete ${label}?`);
        if (!ok) {
          info("Aborted.");
          return;
        }
      }

      try {
        await client.deletePage(pageId);
      } catch (e) {
        error(`Delete failed: ${apiErrorMessage(e)}`);
        process.exit(1);
      }

      success(`Deleted page ${pageId}`);
    });
}
