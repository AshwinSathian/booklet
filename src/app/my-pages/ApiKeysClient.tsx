"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useCallback, useRef, useState } from "react";

type KeyRow = {
  id: string;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function KeyCard({ k, onRevoked }: { k: KeyRow; onRevoked: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const revoke = useCallback(async () => {
    setRevoking(true);
    try {
      const res = await fetch(`/api/v1/keys/${k.id}`, { method: "DELETE" });
      if (res.ok || res.status === 404) onRevoked(k.id);
    } catch {
      // ignore
    } finally {
      setRevoking(false);
      setConfirming(false);
    }
  }, [k.id, onRevoked]);

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-outline bg-bg-elevated px-4 py-3 transition hover:border-accent-soft/30">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-text-primary">
          {k.label ?? <span className="text-text-muted italic">Unlabeled key</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
          <span className="font-mono text-text-muted/60">{k.id}</span>
          <span className="h-3 w-px bg-outline" aria-hidden />
          <span>Created {formatDate(k.created_at)}</span>
          <span className="h-3 w-px bg-outline" aria-hidden />
          <span>Last used {formatDate(k.last_used_at)}</span>
        </div>
      </div>

      {confirming ? (
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="danger" size="md" onClick={() => void revoke()} disabled={revoking}>
            {revoking ? (
              <svg width="12" height="12" viewBox="0 0 13 13" fill="none" className="animate-spin" aria-hidden>
                <path d="M6.5 1a5.5 5.5 0 1 0 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : null}
            Revoke
          </Button>
          <Button variant="ghost" size="md" iconOnly onClick={() => setConfirming(false)}>
            <Icon name="close" size={13} />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="md"
          iconOnly
          onClick={() => setConfirming(true)}
          title="Revoke key"
          className="sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 shrink-0 hover:text-red-400 hover:bg-red-400/8"
        >
          <Icon name="trash" size={14} />
        </Button>
      )}
    </div>
  );
}

function NewKeyReveal({ raw, onDismiss }: { raw: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-xl border border-accent/30 bg-accent-dim p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">Your new API key</p>
          <p className="mt-0.5 text-xs text-text-secondary">Copy it now — it won&apos;t be shown again.</p>
        </div>
        <Button variant="ghost" size="sm" iconOnly onClick={onDismiss}>
          <Icon name="close" size={12} />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate rounded-lg bg-bg border border-outline px-3 py-2 text-xs font-mono text-text-primary">
          {raw}
        </code>
        <Button
          variant="ghost"
          size="md"
          iconOnly
          onClick={() => void copy()}
          title="Copy key"
          className={`shrink-0 ${copied ? "text-accent bg-accent-dim" : ""}`}
        >
          <Icon name={copied ? "check" : "copy"} size={14} />
        </Button>
      </div>
    </div>
  );
}

export function ApiKeysSection({ initialKeys }: { initialKeys: KeyRow[] }) {
  const [keys, setKeys] = useState<KeyRow[]>(initialKeys);
  const [creating, setCreating] = useState(false);
  const [newRaw, setNewRaw] = useState<string | null>(null);
  const labelRef = useRef<HTMLInputElement>(null);

  const handleRevoked = useCallback((id: string) => {
    setKeys((prev) => prev.filter((k) => k.id !== id));
  }, []);

  const handleCreate = async () => {
    const label = labelRef.current?.value.trim() || null;
    setCreating(true);
    try {
      const res = await fetch("/api/v1/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { id: string; label: string | null; key: string; created_at?: string };
      const newKey: KeyRow = {
        id: data.id,
        label: data.label,
        created_at: new Date().toISOString(),
        last_used_at: null,
      };
      setKeys((prev) => [newKey, ...prev]);
      setNewRaw(data.key);
      if (labelRef.current) labelRef.current.value = "";
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mt-12">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-base">API keys</h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            Use these keys with the Readable API to publish programmatically.
          </p>
        </div>
      </div>

      {newRaw && (
        <div className="mb-3">
          <NewKeyReveal raw={newRaw} onDismiss={() => setNewRaw(null)} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        {keys.map((k) => (
          <KeyCard key={k.id} k={k} onRevoked={handleRevoked} />
        ))}
      </div>

      {/* Create new key */}
      <div className="mt-3 flex items-center gap-2">
        <input
          ref={labelRef}
          type="text"
          placeholder="Label (optional)"
          maxLength={80}
          className="min-w-0 flex-1 rounded-lg border border-outline bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
        />
        <Button variant="primary" size="md" onClick={() => void handleCreate()} disabled={creating} className="shrink-0">
          {creating ? (
            <svg width="12" height="12" viewBox="0 0 13 13" fill="none" className="animate-spin" aria-hidden>
              <path d="M6.5 1a5.5 5.5 0 1 0 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          ) : (
            <Icon name="plus" size={12} />
          )}
          Create key
        </Button>
      </div>
    </div>
  );
}
