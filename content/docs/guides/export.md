---
title: Export and print
description: Take a published page away as Markdown, as a single HTML file, or as a PDF from the print dialog.
order: 8
---

Every published page has an **Export** menu in its header.

## Markdown

**Download Markdown** saves the page's source as a `.md` file.

The source is also at the page's address with `.md` added, for any page that anyone with the link may read:

```bash
curl https://booklet.ashwinsathian.com/p/example-incident-report.md
```

## HTML

**Download HTML** saves one self-contained `.html` file. Styles are inside it, and math and diagrams are drawn into it, so it opens with no network connection.

## PDF

**Print to PDF** opens the browser's print dialog with a print layout: the site's header and footer are left out and links show their addresses. Choose "Save as PDF" as the destination. See [Print a page to PDF](/docs/recipes/print-to-pdf).

## Everything at once

[Account settings](/settings/account) has a download of every page you own as a ZIP of Markdown files, each with its frontmatter. The ZIP has each page as it is now. It does not have earlier versions, drafts, or a page that was taken down.

## Embed a page in another site

On a published page, **Embed** copies an `<iframe>` that shows the page without Booklet's header, and with a one-line "Published with Booklet" footer:

```html
<iframe
  src="https://booklet.ashwinsathian.com/p/your-page/embed"
  style="width:100%;min-height:400px;border:none;border-radius:8px;"
  title="Your page's title"
  loading="lazy"
></iframe>
```

A tool that embeds a pasted link through oEmbed finds the same frame at `/api/oembed?url=<the page's address>`. oEmbed does not answer for a page behind a password or limited to a team.
