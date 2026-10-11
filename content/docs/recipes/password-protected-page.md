---
title: A password on a page
nav: Password on a page
description: Ask readers for a password before a page opens, without changing its link.
order: 6
---

**You end up with** a page that asks for a password before showing its content, and not again in that browser for 8 hours.

**You need** an account and a page you own. A password is set in the browser: the API, the CLI and the MCP server cannot set one.

## Steps

1. Open [My pages](/my-pages).
2. Open the menu on the page's row and choose **Password protect**.
3. Enter a password of at least 6 characters and save.
4. Send the link as before, and the password by a different route.

## What a password does and does not do

- The link does not change.
- A reader who enters the password is not asked again in that browser for 8 hours.
- The page's Markdown address (`/p/<id>.md`) stops answering.
- If the page was public, it is no longer listed among public pages or on tag pages, and is left out of the sitemap.
- It is one password for everyone. To give access per person, use a `team` page in a [team space](/docs/guides/team-spaces).

## Remove it

The same menu shows **Remove password** on a protected page.

## Check it worked

Open the link in a private window. You are asked for the password, and the page's text is not in the response until you give it.
