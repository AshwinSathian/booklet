#!/usr/bin/env node
import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerPublishCommand } from "./commands/publish.js";
import { registerPagesCommand } from "./commands/pages.js";

const program = new Command();

program
  .name("readable")
  .description("Publish Markdown pages from your terminal")
  .version("0.1.0");

registerAuthCommands(program);
registerPublishCommand(program);
registerPagesCommand(program);

program.parse(process.argv);
