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

Capture the URL the CLI prints, then post it. The publish step is run in our tests; the request to Slack is not.

```yaml
      - name: Publish
        id: publish
        env:
          BOOKLET_API_KEY: ${{ secrets.BOOKLET_API_KEY }}
        run: |
          URL=$(npx booklet-cli --json publish docs/runbooks/payments.md --update "${{ vars.RUNBOOK_PAGE_ID }}" | jq -r .url)
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

The channel gets the message. If the Publish step fails, the Slack step does not run, so nobody is sent a link to a page that was not updated.

## If it does not

- **`jq: error` in the Publish step.** The CLI failed and printed an error instead of a result. Its exit code says why: see [CLI commands](/docs/reference/cli#exit-codes).
- **Slack answers `invalid_payload`.** The body is not `{"text": "..."}`. Building it with `jq`, as above, keeps quotes in titles from breaking it.
