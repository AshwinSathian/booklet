const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The iframe a page's "Embed" button copies and its oEmbed answer carries. `src` is the embed page's address. */
export function embedIframe(src: string, title: string): string {
  return `<iframe\n  src="${escapeAttr(src)}"\n  style="width:100%;min-height:400px;border:none;border-radius:8px;"\n  title="${escapeAttr(title)}"\n  loading="lazy"\n></iframe>`;
}
