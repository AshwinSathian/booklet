---
title: Linking documents
description: Write a document's title in double square brackets and it becomes a link when you publish. The linked page lists what references it.
order: 6
---

An incident report usually points at the decision behind it, and a runbook at the incidents it was written for. Booklet links published pages by title.

## Write a link

Put the other page's title in double square brackets:

```markdown
The retry storm was made possible by the policy in `[[ADR-012 Queue retries]]`.
```

Written without the backticks, that becomes a link to the published page titled "ADR-012 Queue retries" when you publish. To show different text, add it after a bar: `[[ADR-012 Queue retries|the retry ADR]]`.

In the editor, typing `[[` opens a list of your draft titles to pick from. The link is made when you publish, if a published page has that title.

## What a title matches

Matching ignores case and surrounding spaces. Booklet looks for the title:

1. among the pages of the team space the page is published into, if any;
2. otherwise among your own published pages that are not in a team space.

A link also has to be one its readers can follow:

- A public page links to public pages.
- An unlisted page links to public and unlisted pages.
- A team page links to any page in its space.

So a public incident report that names an unlisted ADR does not link to it. Make the ADR public, or the incident unlisted.

If nothing matches, the text is left as plain text, without the brackets. Nothing is published as a broken link. Links need an account: a page published without one keeps its text and links nothing.

## Referenced by

A page that other pages link to lists them at its foot under **Referenced by**. Open the ADR and you see the incidents that cite it.

## When the target changes

A link is resolved when the linking page is published. If you rename the target or publish the target later, publish the linking page again to pick it up.
