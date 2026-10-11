---
title: Team spaces
description: Keep a team's incident reports, decisions, RFCs and runbooks under one address, with some pages open to members only.
order: 7
---

A team space is a shared home for a team's documents at `/t/<slug>`. Members can read every page in it, including pages marked for the team alone.

## Create a space and invite people

1. Sign in and open [Spaces](/t).
2. Create a space. Its slug becomes its address.
3. On the space's admin page, invite people by email. An invited person signs in, or creates an account, and joins.

Members are editors or viewers. An editor can publish into the space. A viewer can read it.

## Publish into a space

- **Editor**: choose the space in the visibility menu beside Publish.
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
