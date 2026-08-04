import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerPublishCommand } from "./commands/publish.js";
import { registerPagesCommand } from "./commands/pages.js";
import { registerCompletionCommand } from "./commands/completion.js";
import { BookletApiError } from "./api.js";
import { error, setNoColor } from "./fmt.js";

declare const __CLI_VERSION__: string;

const REPO_URL = "https://github.com/AshwinSathian/booklet";

const program = new Command();

program
  .name("booklet")
  .description("Publish Markdown pages from your terminal")
  .version(__CLI_VERSION__)
  .option("--no-color", "Disable colored output")
  // Without this, Commander calls process.exit() itself for its own usage
  // errors and --help/--version — the catch block below never runs for
  // those, they'd just exit before parseAsync's promise ever rejects.
  .exitOverride();

program.addHelpText(
  "after",
  `
Examples:
  $ booklet login                       Authenticate via your browser
  $ booklet publish README.md           Publish a Markdown file
  $ echo "# Hi" | booklet publish -     Publish from stdin
  $ booklet pages list                  List your published pages

Docs & source: ${REPO_URL}`,
);

program.hook("preAction", (thisCommand) => {
  setNoColor(thisCommand.opts().color === false);
});

registerAuthCommands(program);
registerPublishCommand(program);
registerPagesCommand(program);
registerCompletionCommand(program);

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    // Commander's own usage errors (unknown command/option, missing
    // argument) already print their own message and throw — nothing
    // further to add for those. Anything else here is either an expected
    // BookletApiError that slipped past a command's own try/catch, or a
    // genuine bug.
    if (err instanceof BookletApiError) {
      error(err.message);
      process.exit(1);
    }
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      typeof err.code === "string" &&
      err.code.startsWith("commander.") &&
      "exitCode" in err &&
      typeof err.exitCode === "number"
    ) {
      // Commander already printed its own message (or, for --help/
      // --version, the output the user asked for) — just exit with the
      // code Commander itself decided on (0 for help/version, 1 for
      // usage errors).
      process.exit(err.exitCode);
    }
    error(err instanceof Error ? err.message : String(err));
    console.error(`\nThis looks like a bug. Please report it: ${REPO_URL}/issues`);
    process.exit(1);
  }
}

main();
