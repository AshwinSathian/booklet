---
title: Release notes when a GitHub release is published
nav: Release notes on release
description: A workflow that publishes CHANGELOG.md when you publish a release, and keeps one link for all of them.
order: 2
---

**You end up with** one page of release notes that is brought up to date each time you publish a GitHub release.

**You need** a Booklet API key and a repository with a `CHANGELOG.md`.

## Steps

1. Add the key to the repository as a secret named `BOOKLET_API_KEY` (Settings, Secrets and variables, Actions).
2. Mark the changelog as release notes. At the top of `CHANGELOG.md`:

```markdown
---
type: release-notes
title: Acme API release notes
---
```

3. Add `.github/workflows/release-notes.yml`:

```yaml
name: Release notes
on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Publish to Booklet
        env:
          BOOKLET_API_KEY: ${{ secrets.BOOKLET_API_KEY }}
          PAGE_ID: ${{ vars.BOOKLET_PAGE_ID }}
        run: |
          if [ -n "$PAGE_ID" ]; then
            npx booklet-cli publish CHANGELOG.md --update "$PAGE_ID"
          else
            npx booklet-cli publish CHANGELOG.md --visibility public
          fi
```

4. Publish a release. The job log ends with the page's URL.
5. Copy the ID from the end of that URL into a repository variable named `BOOKLET_PAGE_ID` (Settings, Secrets and variables, Actions, Variables).

From the next release on, the same page is updated.

## Check it worked

The job log prints the URL. Open it: the header strip says Release notes. After the second release, the page's version history under [My pages](/my-pages) has two versions.

## If it does not

- **Exit code 3.** The key is missing or wrong. Check the secret's name.
- **A new page on every release.** `BOOKLET_PAGE_ID` is not set, or was added as a secret. It has to be a variable: the workflow reads `vars.BOOKLET_PAGE_ID`.
- **To trigger on a tag push instead**, replace the `on:` block with `on: { push: { tags: ["v*"] } }`.
