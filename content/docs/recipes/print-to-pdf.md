---
title: Print a page to PDF
description: Save a published page as a PDF with the browser's print dialog and Booklet's print layout.
order: 7
---

**You end up with** a PDF of a page, without the site's header, footer or buttons.

**You need** a browser. Booklet does not generate PDF files itself: it has a print layout, and the browser makes the PDF.

## Steps

1. Open the published page.
2. Choose **Export**, then **Print to PDF**. `⌘P` or `Ctrl+P` does the same.
3. In the print dialog, set the destination to **Save as PDF**.
4. Save.

## What the print layout changes

- The page header, table of contents, footer and buttons are left out.
- Text is black on white, whichever theme you were reading in.
- A link is followed by its address in brackets, so it survives on paper.
- Code wraps instead of scrolling.

## Better results

- Turn off the browser's own "Headers and footers" option to drop the date and URL it adds to each sheet.
- Diagrams print as drawn on screen. Wait for them to finish drawing before printing.
- For a file that keeps its layout and still opens offline, **Download HTML** is the alternative: see [Export and print](/docs/guides/export).
