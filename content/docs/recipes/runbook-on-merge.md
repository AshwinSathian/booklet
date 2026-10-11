---
title: A runbook republished on merge
nav: Runbook on merge
description: Keep a runbook in the repository and update its published page whenever the file changes on the main branch.
order: 4
---

**You end up with** a runbook whose link never changes and whose text matches the main branch.

**You need** an API key and a runbook in the repository, here `docs/runbooks/payments.md`.

## Steps

1. Publish it once by hand and note the ID at the end of the URL:

```bash
export BOOKLET_API_KEY=bklt_your_key
npx booklet-cli publish docs/runbooks/payments.md --slug payments-runbook
```

2. In the repository settings, add the key as the secret `BOOKLET_API_KEY` and the page ID as the variable `RUNBOOK_PAGE_ID`.
3. Add `.github/workflows/runbook.yml`:

```yaml
name: Publish runbook
on:
  push:
    branches: [main]
    paths: [docs/runbooks/payments.md]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Update the page
        env:
          BOOKLET_API_KEY: ${{ secrets.BOOKLET_API_KEY }}
        run: npx booklet-cli publish docs/runbooks/payments.md --update "${{ vars.RUNBOOK_PAGE_ID }}"
```

4. Merge a change to the runbook.

## Check it worked

The job log prints the same URL as before. The page shows the new text, and its version history has one more version. Because the update is by page ID, running the job again changes nothing.

## If it does not

- **Exit code 4.** `RUNBOOK_PAGE_ID` is empty or names a page that was deleted.
- **Exit code 3.** The key belongs to an account that does not own the page.
- **The job never runs.** The `paths` filter does not match the file that changed.
