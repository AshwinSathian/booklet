"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { navigateWithViewTransition, usePrefersReducedMotion } from "@/lib/motion";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();

  function go(path: string) {
    onOpenChange(false);
    navigateWithViewTransition(() => router.push(path), reducedMotion);
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      className="fixed left-1/2 top-24 z-50 w-full max-w-lg -translate-x-1/2 rounded-card border border-border-default bg-bg-elevated shadow-glass"
    >
      <Command.Input
        placeholder="Jump to…"
        className="w-full border-b border-border-subtle bg-transparent px-4 py-3 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none"
      />
      <Command.List className="max-h-80 overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-text-muted">
          No results.
        </Command.Empty>
        <Command.Group heading="Navigate" className="text-2xs uppercase tracking-wider text-text-muted px-2 py-1">
          <Command.Item
            onSelect={() => go(ROUTES.myPages)}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-text-primary aria-selected:bg-fill-2"
          >
            My Pages
          </Command.Item>
          <Command.Item
            onSelect={() => go(ROUTES.app)}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-text-primary aria-selected:bg-fill-2"
          >
            New page
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
