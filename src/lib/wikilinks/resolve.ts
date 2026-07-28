/** Case-insensitive, whitespace-trimmed title match — mirrors how Obsidian
 * resolves `[[Name]]` against a vault's filenames. */
export function normalizeTitleKey(title: string): string {
  return title.trim().toLowerCase();
}
