"use client";

import { useEffect, useState } from "react";

const EMOJIS = ["👍", "🔥", "💡", "❤️"] as const;
type Emoji = typeof EMOJIS[number];

function storageKey(pageId: string) {
  return `rxn_${pageId}`;
}

function loadReacted(pageId: string): Set<Emoji> {
  try {
    const raw = localStorage.getItem(storageKey(pageId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr.filter((e): e is Emoji => (EMOJIS as readonly string[]).includes(e)));
  } catch {
    return new Set();
  }
}

function saveReacted(pageId: string, reacted: Set<Emoji>): void {
  try {
    localStorage.setItem(storageKey(pageId), JSON.stringify([...reacted]));
  } catch { /* ignore quota errors */ }
}

export function Reactions({ pageId }: { pageId: string }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [reacted, setReacted] = useState<Set<Emoji>>(new Set());
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Set<Emoji>>(new Set());

  useEffect(() => {
    setReacted(loadReacted(pageId));
    fetch(`/api/reactions/${pageId}`)
      .then((r) => r.json())
      .then((data: { counts?: Record<string, number> }) => {
        if (data.counts) setCounts(data.counts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pageId]);

  const toggle = async (emoji: Emoji) => {
    if (pending.has(emoji)) return;
    setPending((p) => new Set([...p, emoji]));

    const isReacted = reacted.has(emoji);
    const action = isReacted ? "remove" : "add";

    // Optimistic update
    const nextReacted = new Set(reacted);
    if (isReacted) nextReacted.delete(emoji); else nextReacted.add(emoji);
    setReacted(nextReacted);
    saveReacted(pageId, nextReacted);
    setCounts((c) => ({
      ...c,
      [emoji]: Math.max(0, (c[emoji] ?? 0) + (isReacted ? -1 : 1)),
    }));

    try {
      await fetch(`/api/reactions/${pageId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emoji, action }),
      });
    } catch {
      // Revert on failure
      const reverted = new Set(reacted);
      setReacted(reverted);
      saveReacted(pageId, reverted);
      setCounts((c) => ({
        ...c,
        [emoji]: Math.max(0, (c[emoji] ?? 0) + (isReacted ? 1 : -1)),
      }));
    } finally {
      setPending((p) => { const next = new Set(p); next.delete(emoji); return next; });
    }
  };

  if (loading) return null;

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0 && !reacted.size) {
    // Show prompt when no reactions yet
  }

  return (
    <div className="flex flex-col items-start gap-3 py-6 border-t border-border-subtle">
      <p className="text-xs text-text-muted">Was this useful?</p>
      <div className="flex items-center gap-2 flex-wrap">
        {EMOJIS.map((emoji) => {
          const count = counts[emoji] ?? 0;
          const active = reacted.has(emoji);
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => void toggle(emoji)}
              disabled={pending.has(emoji)}
              aria-label={`React with ${emoji}${active ? " (remove)" : ""}`}
              className={[
                "flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm transition select-none",
                "disabled:opacity-60 disabled:cursor-wait",
                active
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-outline bg-bg-soft text-text-secondary hover:border-accent-soft/30 hover:bg-fill-1",
              ].join(" ")}
            >
              <span className="text-base leading-none">{emoji}</span>
              {count > 0 && (
                <span className="text-xs font-medium tabular-nums">{count.toLocaleString()}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
