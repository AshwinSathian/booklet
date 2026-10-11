import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerPublishCommand } from "./commands/publish.js";
import { registerPagesCommand } from "./commands/pages.js";
import { registerCompletionCommand } from "./commands/completion.js";
import { registerPullCommand } from "./commands/pull.js";
import { registerNewCommand } from "./commands/new.js";
import { CliError, EXIT, EXIT_CODES_HELP, toCliError } from "./errors.js";
import { BookletApiError } from "./api.js";
import { error, isJson, setJson, setNoColor } from "./fmt.js";

declare const __CLI_VERSION__: string;

const REPO_URL = "https://github.com/AshwinSathian/booklet";

const program = new Command();

program
  .name("booklet")
  .description("Publish Markdown pages from your terminal")
  .version(__CLI_VERSION__)
  .option("--no-color", "Disable colored output")
  .option("--json", "Print the result as JSON on stdout, and errors as JSON on stderr")
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
  $ booklet pull <id> -o page.md        Download a page's Markdown
  $ booklet new adr                     Start from a template

${EXIT_CODES_HELP}

Docs & source: ${REPO_URL}`,
);

program.hook("preAction", (thisCommand) => {
  setNoColor(thisCommand.opts().color === false);
  setJson(thisCommand.opts().json === true);
});

registerAuthCommands(program);
registerPublishCommand(program);
registerPullCommand(program);
registerNewCommand(program);
registerPagesCommand(program);
registerCompletionCommand(program);

/** Reports a failure and exits with its code. Under --json the report is one JSON object on stderr. */
function exitWith(err: CliError): never {
  if (isJson()) {
    console.error(JSON.stringify({ error: err.message, exit_code: err.exitCode, ...(err.status ? { status: err.status } : {}) }));
  } else {
    error(err.message);
  }
  process.exit(err.exitCode);
}

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    if (err instanceof CliError || err instanceof BookletApiError) {
      exitWith(toCliError(err));
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
      // --version, the output the user asked for). It exits 0 for those
      // and non-zero for a usage error, which is exit code 2 here.
      process.exit(err.exitCode === 0 ? EXIT.OK : EXIT.USAGE);
    }
    error(err instanceof Error ? err.message : String(err));
    console.error(`\nThis looks like a bug. Report it at ${REPO_URL}/issues`);
    process.exit(EXIT.FAILURE);
  }
}

main();
