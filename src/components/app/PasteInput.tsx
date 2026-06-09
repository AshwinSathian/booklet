"use client";

import { Icon } from "@/components/ui/Icon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

const TABLE_TEMPLATE = `| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
| Cell | Cell | Cell |
| Cell | Cell | Cell |`;

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
    const { prefix } = spec;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = value.indexOf("\n", end - 1);
    const blockEnd = lineEnd === -1 ? value.length : lineEnd;

    const block = value.slice(lineStart, blockEnd);
    const lines = block.split("\n");

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

function insertTable(ta: HTMLTextAreaElement, onChange: (v: string) => void) {
  const { selectionStart: start, value } = ta;
  const before = value.slice(0, start);
  const after = value.slice(start);

  // Ensure table is on its own line
  const needsLeadingNewline = before.length > 0 && !before.endsWith("\n");
  const needsTrailingNewline = after.length > 0 && !after.startsWith("\n");

  const insertion =
    (needsLeadingNewline ? "\n\n" : "") +
    TABLE_TEMPLATE +
    (needsTrailingNewline ? "\n\n" : "");

  const newValue = before + insertion + after;
  onChange(newValue);

  // Place cursor on the first cell
  const headerOffset = (needsLeadingNewline ? 2 : 0);
  const firstCellStart = before.length + headerOffset + 2; // after "| "
  requestAnimationFrame(() => {
    ta.focus();
    ta.setSelectionRange(firstCellStart, firstCellStart + 8); // select "Column 1"
  });
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts reference
// ---------------------------------------------------------------------------

const SHORTCUT_GROUPS = [
  {
    group: "Formatting",
    shortcuts: [
      { keys: ["⌘", "B"], label: "Bold" },
      { keys: ["⌘", "I"], label: "Italic" },
      { keys: ["⌘", "`"], label: "Inline code" },
      { keys: ["⌘", "K"], label: "Focus editor" },
    ],
  },
  {
    group: "Editor",
    shortcuts: [
      { keys: ["⌘", "F"], label: "Find & replace" },
      { keys: ["⌘", "↵"], label: "Publish" },
      { keys: ["Tab"], label: "Indent (2 spaces)" },
      { keys: ["⇧", "Tab"], label: "Unindent" },
    ],
  },
  {
    group: "Toolbar",
    shortcuts: [
      { keys: ["H1", "H2", "H3"], label: "Heading buttons" },
      { keys: [">"], label: "Blockquote button" },
      { keys: ["-"], label: "Bullet list" },
      { keys: ["1."], label: "Ordered list" },
    ],
  },
];

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border-subtle bg-bg shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <span className="text-sm font-semibold text-text-primary">Keyboard shortcuts</span>
          <button
            type="button"
            onClick={onClose}
            className="h-6 w-6 flex items-center justify-center rounded text-text-muted transition hover:text-text-primary hover:bg-fill-2"
            aria-label="Close shortcuts"
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 12 12" aria-hidden>
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-4 py-4 flex flex-col gap-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.group}>
              <p className="text-2xs font-semibold uppercase tracking-widest text-text-muted mb-2">{group.group}</p>
              <div className="flex flex-col gap-1">
                {group.shortcuts.map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">{s.label}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k) => (
                        <kbd
                          key={k}
                          className="inline-flex h-5 min-w-5 px-1 items-center justify-center rounded border border-border-subtle bg-fill-2 text-2xs font-mono text-text-muted"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Find & Replace panel
// ---------------------------------------------------------------------------

function getAllMatches(text: string, query: string, caseSensitive: boolean): number[] {
  if (!query) return [];
  const positions: number[] = [];
  const haystack = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  let idx = 0;
  while (idx < haystack.length) {
    const pos = haystack.indexOf(needle, idx);
    if (pos === -1) break;
    positions.push(pos);
    idx = pos + Math.max(1, needle.length);
  }
  return positions;
}

function FindReplaceBar({
  value,
  onChange,
  textareaRef,
  onClose,
}: {
  value: string;
  onChange: (v: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onClose: () => void;
}) {
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matchIdx, setMatchIdx] = useState(0);
  const findInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    findInputRef.current?.focus();
    findInputRef.current?.select();
  }, []);

  const matches = useMemo(
    () => getAllMatches(value, findText, caseSensitive),
    [value, findText, caseSensitive],
  );

  const safeMatchIdx = matches.length > 0 ? matchIdx % matches.length : 0;

  // Scroll textarea to and select the current match
  const jumpToMatch = useCallback(
    (idx: number, positions: number[]) => {
      const ta = textareaRef.current;
      if (!ta || positions.length === 0) return;
      const pos = positions[idx % positions.length];
      const needle = findText;
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(pos, pos + needle.length);
        // Scroll the textarea to show the selection
        const linesBefore = value.slice(0, pos).split("\n").length;
        const lineHeight = 21; // ~1.65 * 13px font
        ta.scrollTop = Math.max(0, (linesBefore - 3) * lineHeight);
      });
    },
    [textareaRef, findText, value],
  );

  const handlePrev = useCallback(() => {
    if (!matches.length) return;
    const next = (safeMatchIdx - 1 + matches.length) % matches.length;
    setMatchIdx(next);
    jumpToMatch(next, matches);
  }, [matches, safeMatchIdx, jumpToMatch]);

  const handleNext = useCallback(() => {
    if (!matches.length) return;
    const next = (safeMatchIdx + 1) % matches.length;
    setMatchIdx(next);
    jumpToMatch(next, matches);
  }, [matches, safeMatchIdx, jumpToMatch]);

  useEffect(() => {
    if (matches.length > 0) {
      setMatchIdx(0);
      jumpToMatch(0, matches);
    }
  // Only run when findText or caseSensitive changes, not on every value change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findText, caseSensitive]);

  const handleReplace = useCallback(() => {
    if (!matches.length || !findText) return;
    const pos = matches[safeMatchIdx];
    const before = value.slice(0, pos);
    const after = value.slice(pos + findText.length);
    onChange(before + replaceText + after);
    // matchIdx stays the same; next match will be at updated positions
  }, [matches, safeMatchIdx, findText, replaceText, value, onChange]);

  const handleReplaceAll = useCallback(() => {
    if (!findText) return;
    const flags = caseSensitive ? "g" : "gi";
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    onChange(value.replace(new RegExp(escaped, flags), replaceText));
    onClose();
    textareaRef.current?.focus();
  }, [findText, replaceText, caseSensitive, value, onChange, onClose, textareaRef]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        textareaRef.current?.focus();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) handlePrev();
        else handleNext();
      }
    },
    [onClose, textareaRef, handlePrev, handleNext],
  );

  return (
    <div className="shrink-0 border-b border-border-subtle bg-bg-elevated px-2 py-2 flex flex-col gap-1.5">
      {/* Find row */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <input
            ref={findInputRef}
            type="text"
            value={findText}
            onChange={(e) => { setFindText(e.target.value); setMatchIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Find…"
            spellCheck={false}
            className="w-full h-6 rounded border border-border-subtle bg-bg px-2 py-0 text-xs font-mono text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:ring-1 focus:ring-accent-soft pr-14"
          />
          {findText && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs tabular-nums text-text-muted pointer-events-none">
              {matches.length === 0
                ? "0/0"
                : `${safeMatchIdx + 1}/${matches.length}`}
            </span>
          )}
        </div>

        {/* Case toggle */}
        <button
          type="button"
          title="Case sensitive"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setCaseSensitive((p) => !p)}
          className={[
            "h-6 w-6 shrink-0 rounded flex items-center justify-center text-2xs font-mono font-semibold border transition",
            caseSensitive
              ? "border-accent/50 bg-accent/10 text-accent"
              : "border-border-subtle bg-bg text-text-muted hover:text-text-primary hover:bg-fill-2",
          ].join(" ")}
        >
          Aa
        </button>

        {/* Prev / Next */}
        <button
          type="button"
          title="Previous match (Shift+Enter)"
          onClick={handlePrev}
          disabled={matches.length === 0}
          className="h-6 w-6 shrink-0 rounded flex items-center justify-center text-text-muted transition hover:text-text-primary hover:bg-fill-2 disabled:opacity-30"
        >
          <svg width="10" height="10" fill="none" viewBox="0 0 10 10" aria-hidden>
            <path d="M2 6.5l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          title="Next match (Enter)"
          onClick={handleNext}
          disabled={matches.length === 0}
          className="h-6 w-6 shrink-0 rounded flex items-center justify-center text-text-muted transition hover:text-text-primary hover:bg-fill-2 disabled:opacity-30"
        >
          <svg width="10" height="10" fill="none" viewBox="0 0 10 10" aria-hidden>
            <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Close */}
        <button
          type="button"
          title="Close (Escape)"
          onClick={() => { onClose(); textareaRef.current?.focus(); }}
          className="h-6 w-6 shrink-0 rounded flex items-center justify-center text-text-muted transition hover:text-text-primary hover:bg-fill-2"
        >
          <svg width="10" height="10" fill="none" viewBox="0 0 10 10" aria-hidden>
            <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Replace row */}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={replaceText}
          onChange={(e) => setReplaceText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Replace with…"
          spellCheck={false}
          className="flex-1 h-6 rounded border border-border-subtle bg-bg px-2 py-0 text-xs font-mono text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:ring-1 focus:ring-accent-soft"
        />
        <button
          type="button"
          onClick={handleReplace}
          disabled={!findText || matches.length === 0}
          className="h-6 shrink-0 px-2 rounded border border-border-subtle bg-bg text-2xs text-text-muted transition hover:text-text-primary hover:bg-fill-2 disabled:opacity-30"
        >
          Replace
        </button>
        <button
          type="button"
          onClick={handleReplaceAll}
          disabled={!findText || matches.length === 0}
          className="h-6 shrink-0 px-2 rounded border border-border-subtle bg-bg text-2xs text-text-muted transition hover:text-text-primary hover:bg-fill-2 disabled:opacity-30"
        >
          All
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Assist button + popover
// ---------------------------------------------------------------------------

const AI_ACTIONS = [
  { key: "improve",     label: "Improve writing",  desc: "Clearer, more concise" },
  { key: "fix_grammar", label: "Fix grammar",       desc: "Spelling & punctuation" },
  { key: "summarize",   label: "Summarize",         desc: "3–5 bullet summary" },
  { key: "shorten",     label: "Make shorter",      desc: "Remove verbosity" },
  { key: "expand",      label: "Make longer",       desc: "Add detail & context" },
] as const;

type AiActionKey = (typeof AI_ACTIONS)[number]["key"];

function AiAssistButton({
  textareaRef,
  value,
  onChange,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<AiActionKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
        setError(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleAction = async (actionKey: AiActionKey) => {
    const ta = textareaRef.current;
    if (!ta) return;

    const { selectionStart: start, selectionEnd: end } = ta;
    const hasSelection = start !== end;
    const text = hasSelection ? value.slice(start, end) : value;

    if (!text.trim()) {
      setError("Nothing to process");
      return;
    }

    setLoading(actionKey);
    setError(null);

    try {
      const res = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionKey, text }),
      });

      if (res.status === 401) {
        setError("Sign in to use AI features");
        setLoading(null);
        return;
      }

      const data = await res.json() as { result?: string; error?: string };

      if (!res.ok || !data.result) {
        setError(data.error ?? "AI request failed");
        setLoading(null);
        return;
      }

      if (hasSelection) {
        const newValue = value.slice(0, start) + data.result + value.slice(end);
        onChange(newValue);
        requestAnimationFrame(() => {
          ta.focus();
          ta.setSelectionRange(start, start + data.result!.length);
        });
      } else {
        onChange(data.result);
      }

      setOpen(false);
    } catch {
      setError("Network error");
    } finally {
      setLoading(null);
    }
  };

  const isLoading = loading !== null;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        title="AI writing assistant"
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((p) => !p);
          if (open) setError(null);
        }}
        className={[
          "shrink-0 h-6 px-1.5 flex items-center gap-1 rounded transition",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft",
          isLoading
            ? "text-accent bg-accent/10 border border-accent/30 animate-pulse"
            : open
            ? "text-accent bg-accent/10 border border-accent/20"
            : "text-text-muted hover:text-accent hover:bg-accent/8 border border-transparent",
        ].join(" ")}
      >
        <svg width="12" height="12" fill="none" viewBox="0 0 16 16" aria-hidden>
          <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
        <span className="text-2xs font-semibold hidden sm:inline">AI</span>
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute top-full right-0 mt-1 z-30 w-52 rounded-xl border border-border-subtle bg-bg shadow-xl py-1"
        >
          <p className="px-3 py-1.5 text-2xs font-semibold uppercase tracking-widest text-text-muted border-b border-border-subtle mb-1">
            AI assist
            {textareaRef.current?.selectionStart !== textareaRef.current?.selectionEnd
              ? " · selection"
              : " · full doc"}
          </p>
          {AI_ACTIONS.map((action) => (
            <button
              key={action.key}
              type="button"
              disabled={isLoading}
              onMouseDown={(e) => {
                e.preventDefault();
                handleAction(action.key);
              }}
              className={[
                "w-full flex flex-col px-3 py-2 text-left transition",
                loading === action.key
                  ? "bg-accent/10 text-accent"
                  : "text-text-primary hover:bg-fill-1",
                isLoading && loading !== action.key ? "opacity-40" : "",
              ].join(" ")}
            >
              <span className="text-xs font-medium">{action.label}</span>
              <span className="text-2xs text-text-muted">{action.desc}</span>
            </button>
          ))}
          {error && (
            <p className="px-3 py-2 text-2xs text-red-400 border-t border-border-subtle mt-1">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

type ToolbarBtn =
  | { type: "format"; key: string; label: string; title: string; textLabel?: string }
  | { type: "action"; key: string; title: string; icon: React.ReactNode }
  | { type: "sep" };

const TOOLBAR_TABLE_ICON = (
  <svg width="13" height="13" fill="none" viewBox="0 0 16 16" aria-hidden>
    <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M1.5 6.5h13M6.5 2.5v11" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

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
  { type: "sep" },
  { type: "action", key: "table",     title: "Insert table",  icon: TOOLBAR_TABLE_ICON },
];

function FormatToolbar({
  textareaRef,
  value,
  onChange,
  onOpenFind,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  onOpenFind: () => void;
}) {
  const handleClick = useCallback(
    (key: string) => {
      if (!textareaRef.current) return;
      if (key === "table") {
        insertTable(textareaRef.current, onChange);
      } else {
        applyFormat(textareaRef.current, key, onChange);
      }
    },
    [textareaRef, onChange],
  );

  return (
    <div className="shrink-0 flex items-center gap-0.5 px-1.5 py-1 border-b border-border-subtle overflow-x-auto">
      {TOOLBAR.map((item, i) => {
        if (item.type === "sep") {
          return <div key={i} className="w-px h-3.5 bg-border-subtle mx-0.5 shrink-0" />;
        }

        if (item.type === "action") {
          return (
            <button
              key={item.key}
              type="button"
              title={item.title}
              onMouseDown={(e) => {
                e.preventDefault();
                handleClick(item.key);
              }}
              className="shrink-0 h-6 w-6 flex items-center justify-center rounded transition text-text-muted hover:text-text-primary hover:bg-fill-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft"
            >
              {item.icon}
            </button>
          );
        }

        const hasTextLabel = Boolean(item.textLabel);

        return (
          <button
            key={item.key}
            type="button"
            title={item.title}
            onMouseDown={(e) => {
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
              item.type === "format"
                ? <Icon name={item.label as Parameters<typeof Icon>[0]["name"]} size={12} />
                : null
            )}
          </button>
        );
      })}

      {/* Spacer pushes right-side buttons to the far right */}
      <div className="flex-1" />
      <AiAssistButton textareaRef={textareaRef} value={value} onChange={onChange} />
      <div className="w-px h-3.5 bg-border-subtle mx-0.5 shrink-0" />
      <button
        type="button"
        title="Find & replace (⌘F)"
        onMouseDown={(e) => { e.preventDefault(); onOpenFind(); }}
        className="shrink-0 h-6 w-6 flex items-center justify-center rounded transition text-text-muted hover:text-text-primary hover:bg-fill-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft"
      >
        <svg width="12" height="12" fill="none" viewBox="0 0 16 16" aria-hidden>
          <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
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
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    if (onFocusShortcutRequested) {
      onFocusShortcutRequested(() => ref.current?.focus());
    }
  }, [onFocusShortcutRequested]);

  // Cmd/Ctrl+F opens find & replace
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        // Only intercept if the textarea (or toolbar) is the active area
        const active = document.activeElement;
        if (active === ref.current || ref.current?.contains(active)) {
          e.preventDefault();
          setShowFindReplace(true);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const wordCount = useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }, [value]);

  const charCount = value.length;
  const readingMins = Math.max(1, Math.round(wordCount / 200));

  return (
    <>
      <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden w-full">
        {/* Formatting toolbar */}
        <FormatToolbar
          textareaRef={ref}
          value={value}
          onChange={onChange}
          onOpenFind={() => setShowFindReplace(true)}
        />

        {/* Find & replace panel */}
        {showFindReplace && (
          <FindReplaceBar
            value={value}
            onChange={onChange}
            textareaRef={ref}
            onClose={() => setShowFindReplace(false)}
          />
        )}

        {/* Textarea */}
        <div className="flex-1 min-h-0 overflow-hidden w-full">
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Tab") return;
              e.preventDefault();
              const ta = e.currentTarget;
              const { selectionStart: start, selectionEnd: end, value: v } = ta;

              if (!e.shiftKey) {
                if (start === end) {
                  const next = v.slice(0, start) + "  " + v.slice(end);
                  onChange(next);
                  requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + 2, start + 2); });
                } else {
                  const lineStart = v.lastIndexOf("\n", start - 1) + 1;
                  const lineEnd = v.indexOf("\n", end - 1);
                  const blockEnd = lineEnd === -1 ? v.length : lineEnd;
                  const block = v.slice(lineStart, blockEnd);
                  const newBlock = block.split("\n").map((l) => "  " + l).join("\n");
                  const delta = newBlock.length - block.length;
                  onChange(v.slice(0, lineStart) + newBlock + v.slice(blockEnd));
                  requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + 2, end + delta); });
                }
              } else {
                const lineStart = v.lastIndexOf("\n", start - 1) + 1;
                const lineEnd = v.indexOf("\n", end - 1);
                const blockEnd = lineEnd === -1 ? v.length : lineEnd;
                const block = v.slice(lineStart, blockEnd);
                const lines = block.split("\n");
                const newLines = lines.map((l) =>
                  l.startsWith("  ") ? l.slice(2) : l.startsWith(" ") ? l.slice(1) : l,
                );
                const newBlock = newLines.join("\n");
                const delta = newBlock.length - block.length;
                const removedFirst = lines[0].startsWith("  ") ? 2 : lines[0].startsWith(" ") ? 1 : 0;
                onChange(v.slice(0, lineStart) + newBlock + v.slice(blockEnd));
                requestAnimationFrame(() => {
                  ta.focus();
                  ta.setSelectionRange(Math.max(lineStart, start - removedFirst), end + delta);
                });
              }
            }}
            placeholder="Write or paste Markdown…"
            spellCheck={false}
            className={[
              "h-full w-full min-h-0 min-w-0",
              "resize-none overflow-y-auto",
              "bg-bg text-text-primary",
              "font-mono text-sm leading-[1.65]",
              "px-5 py-4",
              "placeholder:text-text-muted/40",
              "focus:outline-none",
              "caret-accent",
            ].join(" ")}
          />
        </div>

        {/* Status bar */}
        <div className="shrink-0 flex items-center justify-between border-t border-border-subtle px-3 py-1">
          <div className="flex items-center gap-2">
            <span className="text-2xs text-text-muted tabular-nums">
              {wordCount.toLocaleString()} {wordCount === 1 ? "word" : "words"}
            </span>
            <span className="text-2xs text-text-muted/30" aria-hidden>·</span>
            <span className="text-2xs text-text-muted tabular-nums">
              {charCount.toLocaleString()} chars
            </span>
            {wordCount > 50 && (
              <>
                <span className="text-2xs text-text-muted/30" aria-hidden>·</span>
                <span className="text-2xs text-text-muted tabular-nums">
                  {readingMins} min read
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xs text-text-muted/50 hidden sm:inline">
              <kbd className="font-mono">⌘K</kbd> focus · <kbd className="font-mono">⌘↵</kbd> publish
            </span>
            <button
              type="button"
              title="Keyboard shortcuts"
              onClick={() => setShowShortcuts(true)}
              className="h-5 w-5 flex items-center justify-center rounded border border-border-subtle text-2xs font-mono text-text-muted/50 transition hover:text-text-muted hover:border-border-default hover:bg-fill-2"
            >
              ?
            </button>
          </div>
        </div>
      </div>

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </>
  );
}
