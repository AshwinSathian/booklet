import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerPublishCommand } from "./commands/publish.js";
import { registerPagesCommand } from "./commands/pages.js";

declare const __CLI_VERSION__: string;

const program = new Command();

program
  .name("readable")
  .description("Publish Markdown pages from your terminal")
  .version(__CLI_VERSION__);

registerAuthCommands(program);
registerPublishCommand(program);
registerPagesCommand(program);

program.parse(process.argv);
