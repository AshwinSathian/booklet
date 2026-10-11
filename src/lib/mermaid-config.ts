import type { MermaidConfig } from "mermaid";

/**
 * How every Mermaid diagram in Booklet is configured for safety, on the page
 * and in the HTML export. A diagram's source is whatever the page's author
 * typed, and its `%%{init: …}%%` directive or YAML frontmatter can set
 * configuration.
 *
 * - `securityLevel: "strict"`: Mermaid encodes HTML in labels it does not
 *   allow and disables click handlers.
 * - `secure`: keys a directive cannot set. Mermaid's own six, plus the ones
 *   that put raw text into the diagram's stylesheet (`themeCSS`, and
 *   `fontFamily` and `altFontFamily`, which are interpolated into a
 *   `font-family:` declaration that a `;` can end), and `dompurifyConfig`
 *   (or a directive could undo the next line).
 * - `dompurifyConfig`: what a label may contain. No element or attribute
 *   that fetches something, submits something or carries CSS. Mermaid lays
 *   a diagram out in the live document, so an `<img>` in a label is fetched
 *   while it draws, before the finished SVG can be sanitized
 *   (src/lib/svg-sanitize.ts); it has to be refused here. `style` is in the
 *   tag list because setting this option replaces Mermaid's default, which
 *   forbids it.
 *
 * Not covered, and not coverable from configuration: Mermaid's own syntax
 * for images and styles (an image shape, `A@{ img: "https://…" }`, a
 * `style`/`classDef` statement with a `url()`, or a `style` attribute in a
 * label) is fetched during layout. The
 * drawn diagram is clean of both once it is mounted. The page's
 * Content-Security-Policy allows https images, because images in Markdown
 * are a feature; these are the same request by another route.
 */
export const MERMAID_SAFETY: MermaidConfig = {
  securityLevel: "strict",
  secure: [
    "secure",
    "securityLevel",
    "startOnLoad",
    "maxTextSize",
    "suppressErrorRendering",
    "maxEdges",
    "themeCSS",
    "fontFamily",
    "altFontFamily",
    "dompurifyConfig",
  ],
  dompurifyConfig: {
    // Not `svg` and not the `style` attribute: math in a label (KaTeX) is
    // drawn with both. A `style` attribute is made inert once the diagram
    // is drawn; until then it is one more layout-time route (see above).
    FORBID_TAGS: [
      "style", "img", "image", "use", "picture", "source", "video", "audio", "track",
      "form", "input", "button", "textarea", "select", "option", "link", "meta", "base", "template",
    ],
    FORBID_ATTR: ["src", "srcset", "poster", "background", "action", "formaction", "ping"],
  },
};
