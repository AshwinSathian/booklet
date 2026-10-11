import { Command } from "commander";
import { mkdir, writeFile } from "fs/promises";
import { dirname } from "path";
import { CliError, EXIT } from "../errors.js";
import { TEMPLATES } from "../templates.js";
import { success, info, emit } from "../fmt.js";

const NAMES = Object.keys(TEMPLATES);

export function registerNewCommand(program: Command) {
  program
    .command("new <template>")
    .description(`Write a template file to edit and publish (${NAMES.join(", ")})`)
    .option("-o, --output <file>", "File to write. Default: <template>.md")
    .option("--force", "Overwrite the file if it exists")
    .addHelpText("after", `\nTemplates:\n${NAMES.map((n) => `  ${n.padEnd(15)}${TEMPLATES[n].description}`).join("\n")}`)
    .action(async (template: string, opts: { output?: string; force?: boolean }) => {
      // hasOwn: "constructor" and friends are not templates.
      const entry = Object.hasOwn(TEMPLATES, template) ? TEMPLATES[template] : undefined;
      if (!entry) {
        throw new CliError(`Unknown template "${template}". Choose one of: ${NAMES.join(", ")}.`, EXIT.USAGE);
      }

      const file = opts.output ?? `${template}.md`;
      try {
        // `-o adr/0012.md` in a repository with no adr/ yet: make the folder.
        await mkdir(dirname(file), { recursive: true });
        // "wx" fails if the file exists, so nothing is overwritten by accident.
        await writeFile(file, entry.body(), { encoding: "utf8", flag: opts.force ? "w" : "wx" });
      } catch (e) {
        if (e && typeof e === "object" && "code" in e && e.code === "EEXIST") {
          throw new CliError(`"${file}" already exists. Use --force to overwrite it, or -o to pick another name.`);
        }
        throw new CliError(`Cannot write "${file}": ${e instanceof Error ? e.message : String(e)}`);
      }

      success(`Wrote ${file}`);
      info(`Edit it, then run \`booklet publish ${file}\`.`);
      emit({ template, file });
    });
}
