import { Command } from "commander";
import { apiRequest } from "../api.js";
import { success, error, info, bold, dim, gray, openUrl } from "../fmt.js";
import { table } from "../fmt.js";
import { createInterface } from "readline";

type PageItem = {
  id: string;
  title: string | null;
  slug: string | null;
  visibility: string;
  view_count: number;
  url: string;
  created_at: string;
  updated_at: string;
};

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
    .description("Manage your Readable pages");

  pages
    .command("list")
    .description("List all your pages")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const res = await apiRequest<{ pages: PageItem[] }>("/api/v1/pages");

      if (!res.ok) {
        error(res.error);
        process.exit(1);
      }

      const items = res.data.pages;

      if (opts.json) {
        console.log(JSON.stringify(items, null, 2));
        return;
      }

      if (items.length === 0) {
        info("No pages yet. Run `readable publish <file>` to create one.");
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
      const res = await apiRequest<{ pages: PageItem[] }>("/api/v1/pages");
      if (!res.ok) {
        error(res.error);
        process.exit(1);
      }
      const page = res.data.pages.find((p) => p.id === id || p.slug === id);
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
      // Resolve the real page ID (DELETE endpoint does not accept slugs).
      // This fetch also gives us the title and URL for the confirmation prompt.
      const listRes = await apiRequest<{ pages: PageItem[] }>("/api/v1/pages");
      const page = listRes.ok
        ? listRes.data.pages.find((p) => p.id === id || p.slug === id)
        : null;

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

      const res = await apiRequest<{ ok: boolean }>(`/api/v1/pages/${pageId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        error(`Delete failed: ${res.error}`);
        process.exit(1);
      }

      success(`Deleted page ${pageId}`);
    });
}
