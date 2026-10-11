// Starting points for `booklet new <template>`: the six engineering
// templates shared with the web editor and the MCP prompts
// (booklet-api-client), each under a frontmatter block.

import { CORE_TEMPLATES, coreTemplateMarkdown, frontmatterBlock } from "booklet-api-client";

const today = () => new Date().toISOString().slice(0, 10);

// The frontmatter is what Booklet shows in the page's header strip and what
// a team space groups by. `owners` starts empty for the author to fill in.
export const TEMPLATES: Record<string, { description: string; body: () => string }> = Object.fromEntries(
  CORE_TEMPLATES.map((template) => [
    template.key,
    {
      description: `${template.name}: ${template.description.charAt(0).toLowerCase()}${template.description.slice(1)}`,
      body: () => coreTemplateMarkdown(template.key, frontmatterBlock({ date: today(), owners: [], ...template.doc })),
    },
  ]),
);
