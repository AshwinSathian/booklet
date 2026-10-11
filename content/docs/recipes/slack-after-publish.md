---
title: A Slack message with the link after a workflow publishes
nav: Slack message after publish
description: Post the page's link to a Slack channel from the same workflow that published it.
order: 5
---

**You end up with** a message in a Slack channel, with the page's link, each time a workflow publishes.

**You need** a workflow that publishes with the CLI ([GitHub Action](/docs/guides/github-action)) and a Slack incoming webhook URL, stored as the secret `SLACK_WEBHOOK_URL`.

## Why not a Booklet webhook

A Booklet webhook sends a fixed JSON body (`event`, `page_id`, `page_url`, `title`, `published_at`). A Slack incoming webhook accepts only its own format, with a `text` field, and rejects anything else. Pointing one at the other does not work. A Booklet webhook fits when you run the receiver yourself: see [Webhooks](/docs/guides/webhooks).

## Steps

Capture the URL the CLI prints, then post it. Booklet's tests run the CLI command. They do not run the workflow as a whole or the request to Slack.

```yaml
      - name: Publish
        id: publish
        env:
          BOOKLET_API_KEY: ${{ secrets.BOOKLET_API_KEY }}
          PAGE_ID: ${{ vars.RUNBOOK_PAGE_ID }}
        run: |
          set -o pipefail
          : "${PAGE_ID:?Set the RUNBOOK_PAGE_ID repository variable}"
          URL=$(npx booklet-cli --json publish docs/runbooks/payments.md --update "$PAGE_ID" | jq -er .url)
          echo "url=$URL" >> "$GITHUB_OUTPUT"

      - name: Tell Slack
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          PAGE_URL: ${{ steps.publish.outputs.url }}
        run: |
          jq -n --arg text "Payments runbook updated: $PAGE_URL" '{text: $text}' \
            | curl -fsS -X POST -H "Content-Type: application/json" --data-binary @- "$SLACK_WEBHOOK_URL"
```

## Check it worked

The channel gets the message. `set -o pipefail` and `jq -e` make the Publish step fail when the CLI fails or prints no URL, so the Slack step does not run and nobody is sent a link to a page that was not updated. Without those two, a failed publish would go unnoticed: with `--json` the CLI writes its error to stderr, and `jq` exits 0 on empty input.

## If it did not work

- **The Publish step fails.** The CLI's error is in the step's log, as JSON, with an `exit_code`: see [CLI commands](/docs/reference/cli#exit-codes).
- **Slack answers `invalid_payload`.** The body is not `{"text": "..."}`. Building it with `jq`, as above, keeps quotes in titles from breaking it.
