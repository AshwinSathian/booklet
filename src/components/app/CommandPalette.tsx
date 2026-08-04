"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { INSERT_ITEMS, type InsertSnippet } from "@/lib/editor/insertItems";
import { listDrafts, type DraftMeta } from "@/lib/drafts";
import { ROUTES } from "@/lib/constants";
import { navigateWithViewTransition, usePrefersReducedMotion } from "@/lib/motion";

export function CommandPalette({
  open,
  onOpenChange,
  onNew,
  onPublish,
  onUpdatePage,
  canPublish,
  isPublishing,
  publishedOwned,
  activeDraftId,
  onSwitchDraft,
  focusMode,
  onToggleFocusMode,
  onInsertSnippet,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNew: () => void;
  onPublish: () => void;
  onUpdatePage: () => void;
  canPublish: boolean;
  isPublishing: boolean;
  publishedOwned: boolean;
  activeDraftId: string | null;
  onSwitchDraft: (id: string) => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  onInsertSnippet: (snippet: InsertSnippet) => void;
}) {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const [drafts, setDrafts] = useState<DraftMeta[]>([]);

  // Refresh the drafts list every time the palette opens, not on every
  // keystroke — listDrafts() reads and JSON-parses the whole localStorage
  // blob (see src/lib/drafts/store.ts), which is unnecessary work per
  // keystroke when cmdk already filters client-side over a static list.
  useEffect(() => {
    if (open) setDrafts(listDrafts());
  }, [open]);

  const recentDrafts = useMemo(() => drafts.slice(0, 8), [drafts]);

  function go(path: string) {
    onOpenChange(false);
    navigateWithViewTransition(() => router.push(path), reducedMotion);
  }

  function createNewPage() {
    onOpenChange(false);
    onNew();
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      className="fixed left-1/2 top-24 z-50 w-full max-w-lg -translate-x-1/2 rounded-card border border-border-default bg-bg-elevated shadow-glass"
    >
      <Command.Input
        placeholder="Jump to a draft, or run a command…"
        className="w-full border-b border-border-subtle bg-transparent px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
      />
      <Command.List className="max-h-96 overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-text-muted">
          No results.
        </Command.Empty>

        {recentDrafts.length > 0 && (
          <Command.Group heading="Drafts" className="text-2xs uppercase tracking-wider text-text-muted px-2 py-1">
            {recentDrafts.map((d) => (
              <Command.Item
                key={d.id}
                value={d.title || "Untitled"}
                onSelect={() => { onOpenChange(false); onSwitchDraft(d.id); }}
                className="flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 text-sm text-text-primary aria-selected:bg-fill-2"
              >
                <Icon name="markdown" size={13} className="shrink-0 text-text-muted" />
                <span className="truncate">{d.title || "Untitled"}</span>
                {d.id === activeDraftId && (
                  <span className="ml-auto shrink-0 text-2xs text-text-muted">Current</span>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group heading="Actions" className="text-2xs uppercase tracking-wider text-text-muted px-2 py-1">
          <Command.Item
            value="New draft"
            keywords={["create", "blank"]}
            onSelect={() => { onOpenChange(false); onNew(); }}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-text-primary aria-selected:bg-fill-2"
          >
            New draft
          </Command.Item>
          {canPublish && !isPublishing && (
            <Command.Item
              value={publishedOwned ? "Update page" : "Publish"}
              keywords={["publish", "share", "update"]}
              onSelect={() => { onOpenChange(false); publishedOwned ? onUpdatePage() : onPublish(); }}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm text-text-primary aria-selected:bg-fill-2"
            >
              {publishedOwned ? "Update page" : "Publish"}
            </Command.Item>
          )}
          <Command.Item
            value={focusMode ? "Exit focus mode" : "Enter focus mode"}
            keywords={["focus", "distraction", "zen"]}
            onSelect={() => { onOpenChange(false); onToggleFocusMode(); }}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-text-primary aria-selected:bg-fill-2"
          >
            {focusMode ? "Exit focus mode" : "Enter focus mode"}
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Insert" className="text-2xs uppercase tracking-wider text-text-muted px-2 py-1">
          {INSERT_ITEMS.map((item) => (
            <Command.Item
              key={item.id}
              value={item.label}
              keywords={item.keywords}
              onSelect={() => { onOpenChange(false); onInsertSnippet(item.snippet); }}
              className="flex items-center gap-2.5 cursor-pointer rounded-lg px-3 py-2 text-sm text-text-primary aria-selected:bg-fill-2"
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-text-muted">
                {item.textGlyph ? (
                  <span className="font-mono text-2xs font-semibold">{item.textGlyph}</span>
                ) : (
                  <Icon name={item.icon} size={13} />
                )}
              </span>
              {item.label}
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Navigate" className="text-2xs uppercase tracking-wider text-text-muted px-2 py-1">
          <Command.Item
            onSelect={() => go(ROUTES.myPages)}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-text-primary aria-selected:bg-fill-2"
          >
            My Pages
          </Command.Item>
          <Command.Item
            onSelect={createNewPage}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-text-primary aria-selected:bg-fill-2"
          >
            New page
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
