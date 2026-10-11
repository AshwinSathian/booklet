---
title: GitHub Action
description: Publish a Markdown file from a GitHub workflow, and update the same page on later runs.
order: 3
---

There are two ways to publish from a workflow. Both need an API key stored as a repository secret named `BOOKLET_API_KEY` (repository Settings, Secrets and variables, Actions).

## With the CLI

This is the version our own tests run.

```yaml
name: Publish to Booklet
on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Publish
        env:
          BOOKLET_API_KEY: ${{ secrets.BOOKLET_API_KEY }}
          PAGE_ID: ${{ vars.BOOKLET_PAGE_ID }}
        run: |
          if [ -n "$PAGE_ID" ]; then
            npx booklet-cli publish CHANGELOG.md --update "$PAGE_ID"
          else
            npx booklet-cli publish CHANGELOG.md --slug release-notes
          fi
```

The first run creates the page and prints its URL in the job log. Copy the ID at the end of that URL into a repository **variable** named `BOOKLET_PAGE_ID`, and every later run updates that page.

Without the variable, every run publishes a new page. The slug `release-notes` already belongs to the first one, so the new page is published without it and the CLI says so in the log.

## With the publish-to-booklet action

A separate action wraps the same API with typed inputs and a `url` output. It lives in its own repository and is not run in our tests; the usage below is copied from the example workflow in Booklet's repository.

```yaml
      - name: Publish
        id: publish
        uses: AshwinSathian/publish-to-booklet@v2
        with:
          file: CHANGELOG.md
          api-key: ${{ secrets.BOOKLET_API_KEY }}
          page-id: ${{ vars.BOOKLET_PAGE_ID }}
          visibility: public
      - run: echo "Published at ${{ steps.publish.outputs.url }}"
```

## Re-runs

A job that is run again should not publish a second page. Updating by page ID is safe to repeat. If you create pages with `curl`, send an `Idempotency-Key` header: see [Safe retries](/docs/reference/api#safe-retries).

## Triggers

`release: published` fits release notes. For a runbook or an ADR kept in the repository, publish when the file changes on the main branch:

```yaml
on:
  push:
    branches: [main]
    paths: [docs/runbooks/payments.md]
```

[Republish a runbook on merge](/docs/recipes/runbook-on-merge) is the full recipe.
