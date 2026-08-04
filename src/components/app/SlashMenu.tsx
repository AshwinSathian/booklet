"use client";

import { Icon } from "@/components/ui/Icon";
import type { InsertItem } from "@/lib/editor/insertItems";

export type SlashTrigger = { start: number; query: string };

/**
 * Detects "cursor is inside an open, unclosed '/query' at the start of a
 * line or after whitespace" — mirrors detectWikilinkTrigger's shape and
 * reasoning (PasteInput.tsx) but for the slash-insert menu. Only fires when
 * the "/" is the first character of a line or immediately preceded by a
 * space/tab, so a mid-word "/" (e.g. "60km/h") never opens the menu. A
 * space or newline inside the run closes/abandons the previous trigger,
 * matching how "]"/newline closes the wikilink trigger. Note this only
 * looks at the *last* "/" before the caret, so a second "/" later on the
 * line naturally re-triggers from that position rather than being detected
 * as "inside the run" of the first one — there's no actual run to abandon.
 */
export function detectSlashTrigger(value: string, caret: number): SlashTrigger | null {
  const upToCaret = value.slice(0, caret);
  const lastSlash = upToCaret.lastIndexOf("/");
  if (lastSlash === -1) return null;

  const charBefore = lastSlash === 0 ? "\n" : upToCaret[lastSlash - 1];
  if (charBefore !== "\n" && charBefore !== " " && charBefore !== "\t") return null;

  const between = upToCaret.slice(lastSlash + 1);
  if (between.includes("\n") || between.includes(" ")) return null;

  return { start: lastSlash, query: between };
}

// Must match SlashMenu's `w-60` / `max-h-72` classes below — used to clamp
// the popup's computed position so it can never render off-screen (see
// updateSlashTrigger in PasteInput.tsx). Mirrors the same pattern as
// WIKILINK_POPUP_WIDTH/WIKILINK_POPUP_MAX_HEIGHT.
export const SLASH_POPUP_WIDTH = 240;
export const SLASH_POPUP_MAX_HEIGHT = 288;
export const SLASH_POPUP_VIEWPORT_MARGIN = 8;

export function SlashMenu({
  items,
  top,
  left,
  selectedIndex,
  onSelect,
}: {
  items: InsertItem[];
  top: number;
  left: number;
  selectedIndex: number;
  onSelect: (item: InsertItem) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div
      className="fixed z-50 w-60 max-h-72 overflow-y-auto rounded-lg border border-border-subtle bg-bg-elevated py-1 shadow-xl animate-dropdown-in"
      style={{ top, left }}
    >
      {items.map((item, i) => (
        <button
          key={item.id}
          type="button"
          // Selecting must not steal focus from the textarea mid-edit —
          // same reasoning as WikilinkAutocomplete's onMouseDown pattern.
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
          className={[
            "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs",
            i === selectedIndex
              ? "bg-accent/15 text-text-primary"
              : "text-text-secondary hover:bg-fill-2",
          ].join(" ")}
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-text-muted">
            {item.textGlyph ? (
              <span className="font-mono text-2xs font-semibold">{item.textGlyph}</span>
            ) : (
              <Icon name={item.icon} size={13} />
            )}
          </span>
          <span className="truncate">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
