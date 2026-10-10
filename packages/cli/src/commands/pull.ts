import { Command } from "commander";
import { writeFile } from "fs/promises";
import { requireClient } from "../api.js";
import { CliError } from "../errors.js";
import { success, emit, isJson } from "../fmt.js";

export function registerPullCommand(program: Command) {
  program
    .command("pull <id>")
    .description("Download a page's Markdown by ID or slug (stdout, or -o <file>)")
    .option("-o, --output <file>", "Write the Markdown to this file instead of stdout")
    .action(async (id: string, opts: { output?: string }) => {
      const page = await (await requireClient()).getPage(id);
      if (page.raw === null) {
        throw new CliError(`Page ${id} has no stored Markdown source.`);
      }

      if (opts.output) {
        try {
          await writeFile(opts.output, page.raw, "utf8");
        } catch (e) {
          throw new CliError(`Cannot write "${opts.output}": ${e instanceof Error ? e.message : String(e)}`);
        }
        success(`Wrote ${opts.output}`);
        emit({ id: page.id, url: page.url, file: opts.output });
        return;
      }

      // Without -o, stdout carries the document: the page object under
      // --json, otherwise the Markdown exactly as stored.
      if (isJson()) emit(page);
      else process.stdout.write(page.raw);
    });
}
