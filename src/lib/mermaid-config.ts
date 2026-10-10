import type { MermaidConfig } from "mermaid";

/**
 * How every Mermaid diagram in Booklet is configured for safety, on the page
 * and in the HTML export. A diagram's source is whatever the page's author
 * typed, and its `%%{init: …}%%` directive can set configuration.
 *
 * - `securityLevel: "strict"`: Mermaid encodes HTML in labels it does not
 *   allow and disables click handlers.
 * - `secure`: keys a directive cannot set. Mermaid's own six, plus
 *   `themeCSS` (raw CSS, which can `url()` another host) and
 *   `dompurifyConfig` (or a directive could undo the next line).
 * - `dompurifyConfig`: what a label may contain. No element or attribute
 *   that fetches something or submits something. Mermaid lays a diagram out
 *   in the live document, so an `<img>` in a label is fetched while it draws,
 *   before the finished SVG can be sanitized (src/lib/svg-sanitize.ts);
 *   it has to be refused here. `style` is in the list because setting this
 *   option replaces Mermaid's default, which forbids it.
 *
 * Not covered, and not coverable from configuration: an image shape
 * (`A@{ img: "https://…" }`) is fetched during layout. The page's
 * Content-Security-Policy allows https images, because images in Markdown
 * are a feature; a diagram's image shape is the same request by another
 * route.
 */
export const MERMAID_SAFETY: MermaidConfig = {
  securityLevel: "strict",
  secure: ["secure", "securityLevel", "startOnLoad", "maxTextSize", "suppressErrorRendering", "maxEdges", "themeCSS", "dompurifyConfig"],
  dompurifyConfig: {
    FORBID_TAGS: ["style", "img", "picture", "source", "video", "audio", "track", "form", "input", "button", "textarea", "select", "option", "link", "meta", "base"],
    FORBID_ATTR: ["src", "srcset", "poster", "background", "action", "formaction", "ping"],
  },
};
