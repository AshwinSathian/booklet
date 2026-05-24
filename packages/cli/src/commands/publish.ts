import { Command } from "commander";
import { readFile, watch } from "fs/promises";
import { apiRequest } from "../api.js";
import { success, error, info, warn, bold, dim, openUrl } from "../fmt.js";

type PublishResult = { id: string; url: string };
type PatchResult = { id: string; url: string; updated_at?: string };

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

async function doPublish(
  raw: string,
  opts: {
    update?: string;
    slug?: string;
    visibility?: string;
    open?: boolean;
  },
  isWatch = false,
): Promise<{ id: string; url: string } | null> {
  if (opts.update) {
    // PATCH existing page — content + optional metadata in one call
    const patchBody: Record<string, unknown> = { raw };
    if (opts.slug) patchBody.slug = opts.slug;
    if (opts.visibility) patchBody.visibility = opts.visibility;

    const res = await apiRequest<PatchResult>(`/api/v1/pages/${opts.update}`, {
      method: "PATCH",
      body: patchBody,
    });

    if (!res.ok) {
      error(`Update failed: ${res.error}`);
      return null;
    }

    if (isWatch) {
      info(`Updated → ${bold(res.data.url)}`);
    } else {
      success(`Updated: ${bold(res.data.url)}`);
    }
    if (opts.open && !isWatch) openUrl(res.data.url);
    return res.data;
  }

  // POST new page — only send raw content. The server applies frontmatter and
  // DEFAULT_SETTINGS. Sending settings here would corrupt DocSettings with
  // non-layout fields (visibility is not a DocSettings key).
  const res = await apiRequest<PublishResult>("/api/v1/publish", {
    method: "POST",
    body: { raw },
  });

  if (!res.ok) {
    error(`Publish failed: ${res.error}`);
    return null;
  }

  const { id, url } = res.data;

  // Apply CLI-specified metadata (slug / visibility) via a separate PATCH.
  // Frontmatter in the document is handled server-side during the POST.
  if (opts.slug || (opts.visibility && opts.visibility !== "public")) {
    const metaPatch: Record<string, unknown> = {};
    if (opts.slug) metaPatch.slug = opts.slug;
    if (opts.visibility) metaPatch.visibility = opts.visibility;

    const patchRes = await apiRequest<PatchResult>(`/api/v1/pages/${id}`, {
      method: "PATCH",
      body: metaPatch,
    });

    if (!patchRes.ok) {
      warn(`Published but metadata patch failed: ${patchRes.error}`);
      success(`Published: ${bold(url)}`);
      console.log(dim(`  ID: ${id}`));
      if (opts.open) openUrl(url);
      return { id, url };
    }

    const finalUrl = patchRes.data.url;
    success(`Published: ${bold(finalUrl)}`);
    console.log(dim(`  ID: ${id}`));
    if (opts.open) openUrl(finalUrl);
    return { id, url: finalUrl };
  }

  success(`Published: ${bold(url)}`);
  console.log(dim(`  ID: ${id}`));
  if (opts.open) openUrl(url);
  return { id, url };
}

export function registerPublishCommand(program: Command) {
  program
    .command("publish [file]")
    .description("Publish a Markdown file (use - for stdin)")
    .option("--slug <slug>", "Set a custom URL slug")
    .option("--visibility <v>", "public or unlisted (default: public)")
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
        error("--watch cannot be used with stdin.");
        process.exit(1);
      }

      let raw: string;
      try {
        raw = await readInput(filePath);
      } catch (e) {
        error(`Cannot read "${filePath}": ${e instanceof Error ? e.message : String(e)}`);
        process.exit(1);
      }

      const result = await doPublish(raw, opts);
      if (!result) process.exit(1);

      if (!opts.watch) return;

      const pageId = opts.update ?? result.id;
      info(`Watching ${bold(filePath)} for changes… (Ctrl+C to stop)`);
      console.log();

      try {
        const watcher = watch(filePath);
        for await (const event of watcher) {
          if (event.eventType !== "change") continue;
          // Small debounce to let the editor finish writing
          await new Promise((r) => setTimeout(r, 80));
          try {
            const updated = await readFile(filePath, "utf8");
            await doPublish(updated, { ...opts, update: pageId }, true);
          } catch (readErr) {
            warn(`Read error: ${readErr instanceof Error ? readErr.message : String(readErr)}`);
          }
        }
      } catch (e) {
        error(`Watch failed: ${e instanceof Error ? e.message : String(e)}`);
        process.exit(1);
      }
    });
}
