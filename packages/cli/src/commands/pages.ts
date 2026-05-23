import { Command } from "commander";
import { apiRequest } from "../api.js";
import { success, error, info, bold, dim, gray } from "../fmt.js";
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
    .description("Print the URL of a page")
    .action(async (id: string) => {
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
    });

  pages
    .command("delete <id>")
    .description("Delete a page by ID")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (id: string, opts: { yes?: boolean }) => {
      if (!opts.yes) {
        const ok = await confirm(`Delete page ${bold(id)}?`);
        if (!ok) {
          info("Aborted.");
          return;
        }
      }

      const res = await apiRequest<{ ok: boolean }>(`/api/v1/pages/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        error(`Delete failed: ${res.error}`);
        process.exit(1);
      }

      success(`Deleted page ${id}`);
    });
}
