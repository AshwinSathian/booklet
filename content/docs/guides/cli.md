---
title: CLI
description: Publish, update, list and pull pages from a terminal or a script with booklet-cli.
order: 2
---

`booklet-cli` is an npm package. Run it with `npx`, or install it and use the `booklet` command. It needs Node.js 22 or later.

```bash
npx booklet-cli publish README.md      # no install
npm install -g booklet-cli             # or install, then: booklet publish README.md
```

## Sign in

For a script or CI, set the key in the environment:

```bash
export BOOKLET_API_KEY=bklt_your_key
```

On your own machine, `booklet login` opens the browser, asks you to approve, and saves a key for later runs. `booklet login --key bklt_your_key` saves a key you already have. `booklet whoami` shows which key is active, and `booklet logout` removes the saved one.

## Publish

```bash
booklet publish docs/runbook.md
booklet publish docs/runbook.md --slug payments-runbook
booklet publish docs/runbook.md --visibility public
cat notes.md | booklet publish -
```

A new page is unlisted. `--visibility` takes `unlisted`, `public` or `team`; `team` needs `--space`.

## Update a page in place

```bash
booklet publish docs/runbook.md --update Ab3k91QxZp
```

The link stays the same and the previous content is kept as a version. `--watch` republishes each time the file is saved, which is useful while you write:

```bash
booklet publish INCIDENT.md --update Ab3k91QxZp --watch
```

## Publish into a team space

```bash
booklet publish adr/0012-queue-retries.md --space payments
booklet publish adr/0012-queue-retries.md --space payments --visibility team
```

`--space` is the slug in `/t/<slug>`. With `--visibility team`, only members of the space can open the page.

## Start from a template

```bash
booklet new incident        # writes incident.md
booklet new adr -o adr/0013-cache.md
```

The templates are `incident`, `postmortem`, `adr`, `rfc`, `runbook` and `release-notes`. Each starts with the frontmatter that drives the page's header strip.

## List, pull, move, delete

```bash
booklet pages list --type adr --space payments
booklet pull Ab3k91QxZp -o runbook.md
booklet pages move Ab3k91QxZp --space payments
booklet pages delete Ab3k91QxZp --yes
```

## In scripts

`--json` prints the result as JSON on stdout and errors as JSON on stderr. Exit codes are fixed: see [CLI commands](/docs/reference/cli).

```bash
set -o pipefail
URL=$(booklet --json publish CHANGELOG.md | jq -er .url)
```

With `--json` an error goes to stderr and nothing to stdout. `pipefail` and `jq -e` make the line fail in that case, instead of leaving `URL` empty.
