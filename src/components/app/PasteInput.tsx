"use client";

import { Icon } from "@/components/ui/Icon";
import { useCallback, useEffect, useMemo, useRef } from "react";

// ---------------------------------------------------------------------------
// Format actions
// ---------------------------------------------------------------------------

type WrapFormat = {
  kind: "wrap";
  prefix: string;
  suffix: string;
  placeholder: string;
};

type LineFormat = {
  kind: "line";
  prefix: string;
};

type FormatSpec = WrapFormat | LineFormat;

const FORMATS: Record<string, FormatSpec> = {
  bold:       { kind: "wrap", prefix: "**", suffix: "**", placeholder: "bold text" },
  italic:     { kind: "wrap", prefix: "*",  suffix: "*",  placeholder: "italic text" },
  strike:     { kind: "wrap", prefix: "~~", suffix: "~~", placeholder: "strikethrough" },
  code:       { kind: "wrap", prefix: "`",  suffix: "`",  placeholder: "code" },
  codeblock:  { kind: "wrap", prefix: "```\n", suffix: "\n```", placeholder: "code here" },
  link:       { kind: "wrap", prefix: "[",  suffix: "](url)", placeholder: "link text" },
  h1:         { kind: "line", prefix: "# " },
  h2:         { kind: "line", prefix: "## " },
  h3:         { kind: "line", prefix: "### " },
  quote:      { kind: "line", prefix: "> " },
  bullet:     { kind: "line", prefix: "- " },
  ordered:    { kind: "line", prefix: "1. " },
};

function applyFormat(
  ta: HTMLTextAreaElement,
  formatKey: string,
  onChange: (v: string) => void,
) {
  const spec = FORMATS[formatKey];
  if (!spec) return;

  const { selectionStart: start, selectionEnd: end, value } = ta;
  const selected = value.slice(start, end);

  if (spec.kind === "wrap") {
    const { prefix, suffix, placeholder } = spec;
    const inner = selected || placeholder;
    const newValue = value.slice(0, start) + prefix + inner + suffix + value.slice(end);

    const cursorStart = start + prefix.length;
    const cursorEnd = cursorStart + inner.length;

    onChange(newValue);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(cursorStart, cursorEnd);
    });
  } else {
    // Line prefix: apply to every line in the selection.
    const { prefix } = spec;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = value.indexOf("\n", end - 1);
    const blockEnd = lineEnd === -1 ? value.length : lineEnd;

    const block = value.slice(lineStart, blockEnd);
    const lines = block.split("\n");

    // Toggle: if every line already has this prefix, remove it; otherwise add it.
    const allHavePrefix = lines.every((l) => l.startsWith(prefix));
    const newLines = allHavePrefix
      ? lines.map((l) => l.slice(prefix.length))
      : lines.map((l) => prefix + l);

    const newBlock = newLines.join("\n");
    const newValue = value.slice(0, lineStart) + newBlock + value.slice(blockEnd);

    const delta = newBlock.length - block.length;
    onChange(newValue);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + (allHavePrefix ? -prefix.length : prefix.length), end + delta);
    });
  }
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

type ToolbarBtn =
  | { type: "format"; key: string; label: string; title: string; textLabel?: string }
  | { type: "sep" };

const TOOLBAR: ToolbarBtn[] = [
  { type: "format", key: "bold",      label: "bold",      title: "Bold (wrap in **)",        textLabel: "B"  },
  { type: "format", key: "italic",    label: "italic",    title: "Italic (wrap in *)",        textLabel: "I"  },
  { type: "format", key: "strike",    label: "strikethrough", title: "Strikethrough (~~)",    textLabel: "S"  },
  { type: "sep" },
  { type: "format", key: "h1",        label: "h1",        title: "Heading 1 (# )",            textLabel: "H1" },
  { type: "format", key: "h2",        label: "h2",        title: "Heading 2 (## )",           textLabel: "H2" },
  { type: "format", key: "h3",        label: "h3",        title: "Heading 3 (### )",          textLabel: "H3" },
  { type: "sep" },
  { type: "format", key: "code",      label: "code",      title: "Inline code (`)",           textLabel: "`"  },
  { type: "format", key: "codeblock", label: "code-block",title: "Code block (```)" },
  { type: "sep" },
  { type: "format", key: "link",      label: "link",      title: "Link ([text](url))" },
  { type: "format", key: "quote",     label: "quote",     title: "Blockquote (>)" },
  { type: "format", key: "bullet",    label: "list",      title: "Bullet list (- )" },
  { type: "format", key: "ordered",   label: "list-ordered", title: "Ordered list (1. )",     textLabel: "1." },
];

function FormatToolbar({
  textareaRef,
  onChange,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (v: string) => void;
}) {
  const handleClick = useCallback(
    (key: string) => {
      if (textareaRef.current) applyFormat(textareaRef.current, key, onChange);
    },
    [textareaRef, onChange],
  );

  return (
    <div className="shrink-0 flex items-center gap-0.5 px-1.5 py-1 border-b border-border-subtle overflow-x-auto">
      {TOOLBAR.map((item, i) => {
        if (item.type === "sep") {
          return <div key={i} className="w-px h-3.5 bg-border-subtle mx-0.5 shrink-0" />;
        }

        const hasTextLabel = Boolean(item.textLabel);

        return (
          <button
            key={item.key}
            type="button"
            title={item.title}
            onMouseDown={(e) => {
              // Prevent textarea from losing focus before we read selection.
              e.preventDefault();
              handleClick(item.key);
            }}
            className={[
              "shrink-0 flex items-center justify-center rounded transition",
              "text-text-muted hover:text-text-primary hover:bg-fill-2",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft",
              hasTextLabel
                ? "h-6 min-w-5 px-1 font-mono text-2xs font-semibold"
                : "h-6 w-6",
              item.key === "bold"   ? "font-bold"   : "",
              item.key === "italic" ? "italic"       : "",
              item.key === "strike" ? "line-through" : "",
            ].join(" ")}
          >
            {hasTextLabel ? (
              <span>{item.textLabel}</span>
            ) : (
              <Icon name={item.label as Parameters<typeof Icon>[0]["name"]} size={12} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PasteInput
// ---------------------------------------------------------------------------

export function PasteInput({
  value,
  onChange,
  onFocusShortcutRequested,
}: {
  value: string;
  onChange: (v: string) => void;
  onFocusShortcutRequested?: (focusFn: () => void) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (onFocusShortcutRequested) {
      onFocusShortcutRequested(() => ref.current?.focus());
    }
  }, [onFocusShortcutRequested]);

  const wordCount = useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }, [value]);

  const charCount = value.length;

  return (
    <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden w-full">
      {/* Pane label */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border-subtle">
        <span className="text-2xs font-semibold uppercase tracking-widest text-text-muted">
          Editor
        </span>
        <span className="text-2xs text-text-muted">
          <kbd className="rounded border border-border-default bg-fill-2 px-1 py-0.5 font-mono text-2xs">⌘K</kbd>
          {" "}focus
        </span>
      </div>

      {/* Formatting toolbar */}
      <FormatToolbar textareaRef={ref} onChange={onChange} />

      {/* Textarea */}
      <div className="flex-1 min-h-0 overflow-hidden w-full">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste anything Markdown-shaped: notes, READMEs, incident summaries, tables, code…"
          spellCheck={false}
          className={[
            "h-full w-full min-h-0 min-w-0",
            "resize-none overflow-y-auto",
            "bg-bg text-text-primary",
            "font-mono text-sm leading-[1.65]",
            "p-4",
            "placeholder:text-text-muted/60",
            "focus:outline-none",
            "caret-accent",
          ].join(" ")}
        />
      </div>

      {/* Footer: word/char count */}
      <div className="shrink-0 flex items-center gap-1.5 border-t border-border-subtle px-3 py-1.5">
        <span className="text-2xs text-text-muted">
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
        <span className="text-2xs text-text-muted opacity-40">·</span>
        <span className="text-2xs text-text-muted">{charCount} chars</span>
      </div>
    </div>
  );
}
