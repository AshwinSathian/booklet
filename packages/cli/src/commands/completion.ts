import { Command } from "commander";

// Hand-rolled, not generated from Commander's command tree at runtime —
// the CLI's surface (5 top-level commands, one subcommand group with 3
// subcommands, ~15 flags total) is small and stable enough that a
// generator would be more machinery than the problem needs. Update this
// list if commands/flags change.
const TOP_LEVEL = ["login", "logout", "whoami", "publish", "pages", "completion", "help"];
const PAGES_SUBCOMMANDS = ["list", "open", "delete"];

const BASH_SCRIPT = `_booklet_completions() {
  local cur prev words cword
  _init_completion || return

  local top_level="${TOP_LEVEL.join(" ")}"
  local pages_sub="${PAGES_SUBCOMMANDS.join(" ")}"

  if [[ \${cword} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "\${top_level}" -- "\${cur}") )
    return
  fi

  if [[ \${words[1]} == "pages" && \${cword} -eq 2 ]]; then
    COMPREPLY=( $(compgen -W "\${pages_sub}" -- "\${cur}") )
    return
  fi
}
complete -F _booklet_completions booklet
`;

const ZSH_SCRIPT = `#compdef booklet

_booklet() {
  local -a top_level pages_sub
  top_level=(${TOP_LEVEL.join(" ")})
  pages_sub=(${PAGES_SUBCOMMANDS.join(" ")})

  if (( CURRENT == 2 )); then
    _describe "command" top_level
    return
  fi

  if [[ \${words[2]} == "pages" && CURRENT -eq 3 ]]; then
    _describe "pages subcommand" pages_sub
    return
  fi
}

_booklet
`;

const FISH_SCRIPT = `set -l top_level ${TOP_LEVEL.join(" ")}
set -l pages_sub ${PAGES_SUBCOMMANDS.join(" ")}

complete -c booklet -n "not __fish_seen_subcommand_from $top_level" -a "$top_level"
complete -c booklet -n "__fish_seen_subcommand_from pages" -a "$pages_sub"
`;

export function registerCompletionCommand(program: Command) {
  program
    .command("completion <shell>")
    .description("Print a shell completion script (bash, zsh, or fish)")
    .action((shell: string) => {
      switch (shell) {
        case "bash":
          console.log(BASH_SCRIPT);
          break;
        case "zsh":
          console.log(ZSH_SCRIPT);
          break;
        case "fish":
          console.log(FISH_SCRIPT);
          break;
        default:
          console.error(`Unsupported shell: ${shell}. Supported: bash, zsh, fish.`);
          process.exit(1);
      }
    });
}
