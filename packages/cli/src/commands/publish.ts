import { Command } from "commander";
import { readFile, watch } from "fs/promises";
import { requireClient } from "../api.js";
import { CliError, EXIT, toCliError } from "../errors.js";
import { success, info, warn, bold, dim, print, emit, openUrl } from "../fmt.js";

async function readInput(filePath: string): Promise<string> {
  if (filePath === "-") {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  return readFile(filePath, "utf8");
}

type Visibility = "public" | "unlisted";
type PublishResult = { id: string; url: string; updated: boolean; warning?: string };

/** Publishes or updates, and returns what happened. Throws CliError on failure. */
async function doPublish(
  raw: string,
  opts: { update?: string; slug?: string; visibility?: Visibility },
): Promise<PublishResult> {
  const client = await requireClient();

  if (opts.update) {
    // PATCH existing page — content + optional metadata in one call
    const result = await client
      .updatePage(opts.update, {
        raw,
        ...(opts.slug ? { slug: opts.slug } : {}),
        ...(opts.visibility ? { visibility: opts.visibility } : {}),
      })
      .catch((e) => {
        throw toCliError(e, "Update failed");
      });
    return { id: result.id, url: result.url, updated: true };
  }

  // POST new page. Visibility goes in the same request; frontmatter in the
  // document is applied server-side.
  const { id, url } = await client
    .publishPage(raw, opts.visibility ? { visibility: opts.visibility } : undefined)
    .catch((e) => {
      throw toCliError(e, "Publish failed");
    });

  // A slug from the command line needs a second request. If it fails the
  // page is still published, so that is a warning and not a failure.
  if (opts.slug) {
    try {
      const patched = await client.updatePage(id, { slug: opts.slug });
      return { id, url: patched.url, updated: false };
    } catch (e) {
      return { id, url, updated: false, warning: `Published, but the slug was not set: ${toCliError(e).message}` };
    }
  }

  return { id, url, updated: false };
}

export function registerPublishCommand(program: Command) {
  program
    .command("publish [file]")
    .description("Publish a Markdown file (use - for stdin)")
    .option("--slug <slug>", "Set a custom URL slug")
    .option("--visibility <v>", "unlisted (link only, not indexed) or public (listed on Explore). Default: unlisted")
    .option("--update <id>", "Update an existing page by ID instead of creating new")
    .option("--watch", "Watch file for changes and re-publish automatically")
    .option("--open", "Open the published page in your browser after success")
    .action(async (file: string | undefined, opts: {
      slug?: string;
      visibility?: string;
      update?: string;
      watch?: boolean;
      open?: boolean;
    }) => {
      const filePath = file ?? "-";

      if (opts.watch && filePath === "-") {
        throw new CliError("--watch cannot be used with stdin.", EXIT.USAGE);
      }
      if (opts.visibility !== undefined && opts.visibility !== "public" && opts.visibility !== "unlisted") {
        throw new CliError(`--visibility must be "public" or "unlisted", not "${opts.visibility}".`, EXIT.USAGE);
      }
      const publishOpts = { update: opts.update, slug: opts.slug, visibility: opts.visibility as Visibility | undefined };

      let raw: string;
      try {
        raw = await readInput(filePath);
      } catch (e) {
        throw new CliError(`Cannot read "${filePath}": ${e instanceof Error ? e.message : String(e)}`);
      }

      const result = await doPublish(raw, publishOpts);
      if (result.warning) warn(result.warning);
      success(`${result.updated ? "Updated" : "Published"}: ${bold(result.url)}`);
      if (!result.updated) print(dim(`  ID: ${result.id}`));
      emit(result);
      if (opts.open) openUrl(result.url);

      if (!opts.watch) return;

      const pageId = opts.update ?? result.id;
      info(`Watching ${bold(filePath)} for changes… (Ctrl+C to stop)`);
      print();

      try {
        const watcher = watch(filePath);
        for await (const event of watcher) {
          if (event.eventType !== "change") continue;
          // Small debounce to let the editor finish writing
          await new Promise((r) => setTimeout(r, 80));
          try {
            const updated = await readFile(filePath, "utf8");
            const again = await doPublish(updated, { ...publishOpts, update: pageId });
            info(`Updated → ${bold(again.url)}`);
          } catch (e) {
            // One failed save must not end the watch.
            warn(toCliError(e).message);
          }
        }
      } catch (e) {
        throw new CliError(`Watch failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
}
