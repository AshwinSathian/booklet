---
title: An ADR log in a team space
nav: ADR log in a space
description: Publish each architecture decision record into a team space and get a decision log in ADR-number order.
order: 3
---

**You end up with** a decision log at `/t/<your-space>`: every ADR, in number order, with its status.

**You need** a team space you can publish to ([Team spaces](/docs/guides/team-spaces)) and an API key.

## Steps

1. Start an ADR from the template:

```bash
export BOOKLET_API_KEY=bklt_your_key
npx booklet-cli new adr -o adr/0012-queue-retries.md
```

2. Edit the file. Keep the frontmatter, and start the title with `ADR-` and the number:

```markdown
---
type: adr
status: Accepted
date: 2026-08-02
owners: [platform-team]
---

# ADR-012 Queue retries
```

3. Publish it into the space, for members only:

```bash
npx booklet-cli publish adr/0012-queue-retries.md --space payments --visibility team
```

4. Repeat for each record. To see the log from the terminal:

```bash
npx booklet-cli pages list --space payments --type adr
```

## Replace a decision

When ADR-019 replaces ADR-012, say so in the new record and update the old one's status:

```markdown
---
type: adr
status: Accepted
supersedes: ADR-012 Queue retries
---
```

Set `status: Superseded` in ADR-012 and publish it again with `--update <its id>`.

## Check it worked

Open `/t/payments` while signed in. The **Decision log** group lists the records in number order. Signed out, a `team` page answers 404.

## If it does not

- **Exit code 4 on publish.** There is no space with that slug, or you are not a member of it.
- **Exit code 3.** You are a viewer in the space. Publishing needs the editor role.
- **The record is listed outside the decision log.** Its frontmatter has no `type: adr`.
