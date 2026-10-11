/** The docs sections, in sidebar order. A page's section is its first directory; files at the root are "start". */
export const DOC_SECTIONS = [
  { id: "start", title: "Start", blurb: "Publish a first page in a couple of minutes." },
  { id: "guides", title: "Guides", blurb: "Set up each way of publishing, and the features built for engineering documents." },
  { id: "recipes", title: "Recipes", blurb: "One task each, start to finish, with the commands to run." },
  { id: "reference", title: "Reference", blurb: "Every endpoint, command, tool, frontmatter key and limit." },
] as const;

export type DocSectionId = (typeof DOC_SECTIONS)[number]["id"];

/** Components a docs page may place with a ```booklet-embed block. */
export const DOC_EMBEDS = ["mcp-client-picker"] as const;
export type DocEmbed = (typeof DOC_EMBEDS)[number];

/**
 * Where the sections of the three pages that /docs replaced now live, keyed
 * by the old fragment. A redirect cannot see a fragment (browsers do not
 * send it), so /docs and /docs/reference/api look the fragment up here
 * after they load. See LegacyHashRedirect.
 */
export const LEGACY_HASHES: Record<string, string> = {
  // /api-docs
  overview: "/docs/reference/api#base-url",
  authentication: "/docs/reference/api#authentication",
  publish: "/docs/reference/api#publish-a-page",
  frontmatter: "/docs/reference/frontmatter",
  update: "/docs/reference/api#update-a-page",
  list: "/docs/reference/api#list-pages",
  "patch-slug": "/docs/reference/api#update-a-page",
  delete: "/docs/reference/api#delete-a-page",
  idempotency: "/docs/reference/api#safe-retries",
  conditional: "/docs/reference/api#conditional-requests",
  webhooks: "/docs/guides/webhooks",
  errors: "/docs/reference/api#errors",
  "rate-limits": "/docs/reference/limits",
  "github-actions": "/docs/guides/github-action",
  mcp: "/docs/guides/mcp",
  // /integrations
  cli: "/docs/guides/cli",
  "rest-api": "/docs/reference/api",
};
