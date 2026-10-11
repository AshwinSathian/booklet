---
title: Team spaces
description: Keep a team's incident reports, decisions, RFCs and runbooks under one address, with some pages open to members only.
order: 7
---

A team space is a shared home for a team's documents at `/t/<slug>`. Members can read every page in it, including pages marked for the team alone.

## Create a space and invite people

1. Sign in and open [Spaces](/t).
2. Create a space. Its slug becomes its address.
3. On the space's admin page, enter a colleague's email address. Booklet emails them an invite, and shows you the same link in case you would rather send it yourself. The link works for 72 hours and only for an account with that address. They sign in, or create that account, and join as an editor.

An editor can read every page in the space and publish into it. The owner can remove a member from the same admin page; the invites sent to that person before then stop working. Deleting a space keeps its pages: they leave the space, and a Team only page can then be opened by its author alone.

## Publish into a space

- **Web editor**: in the visibility menu beside Publish, choose "Team only" for the space.
- **Frontmatter**: `space: payments`.
- **CLI**: `booklet publish adr.md --space payments`.
- **API**: `"space": "payments"` in the request body.
- **MCP**: ask for the page to be published to the payments space.

## Who can read a page

| Visibility | Who can open it |
| --- | --- |
| `team` | Members of the space. Everyone else gets a 404, and the page is never indexed. |
| `unlisted` | Anyone with the link. Not indexed. |
| `public` | Anyone. Indexed, and listed on the space's public home and in its feed. |

`team` is only available for a page in a space.

## The space's home

The home lists pages by [document type](/docs/guides/document-types): a decision log in ADR-number order, incidents by date, then RFCs, runbooks and release notes. A member sees every page. A visitor sees the public ones.

A space with public pages has an Atom feed at `/t/<slug>/feed.xml`.

## Move a page

```bash
booklet pages move Ab3k91QxZp --space payments
booklet pages move Ab3k91QxZp --no-space
```

The API does the same with `space` on `PATCH /api/v1/pages/{id}`.
