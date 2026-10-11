"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useDateFormat } from "@/lib/ui/hydration";
import { useCallback, useRef, useState } from "react";

type KeyRow = {
  id: string;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
};

function useNullableDate() {
  const format = useDateFormat();
  return (iso: string | null) => (iso ? format(iso) : "Never");
}

function KeyCard({ k, onRevoked }: { k: KeyRow; onRevoked: (id: string) => void }) {
  const formatDate = useNullableDate();
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
    <div className="group flex items-center gap-3 rounded-xl border border-border-default bg-bg-elevated px-4 py-3 transition hover:border-border-strong">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-text-primary">
          {k.label ?? <span className="text-text-muted italic">Unlabeled key</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
          <span className="font-mono text-text-muted">{k.id}</span>
          <span className="h-3 w-px bg-fill-2" aria-hidden />
          <span>Created {formatDate(k.created_at)}</span>
          <span className="h-3 w-px bg-fill-2" aria-hidden />
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
          className="sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 shrink-0 hover:text-danger hover:bg-danger/8"
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
    <div className="rounded-xl border border-border-strong bg-fill-2 p-4 flex flex-col gap-3">
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
        <code className="flex-1 min-w-0 truncate rounded-lg bg-bg border border-border-default px-3 py-2 text-xs font-mono text-text-primary">
          {raw}
        </code>
        <Button
          variant="ghost"
          size="md"
          iconOnly
          onClick={() => void copy()}
          title="Copy key"
          className={`shrink-0 ${copied ? "bg-fill-2 text-text-primary" : ""}`}
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
  const [error, setError] = useState<string | null>(null);
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
      const data = (await res.json().catch(() => ({}))) as { id: string; label: string | null; key: string; detail?: string };
      // 403 here is an unconfirmed email address; the message says what to do.
      setError(res.ok ? null : (data.detail ?? "Could not create the key."));
      if (!res.ok) return;
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
    <div>
      <div className="mb-8 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-[-0.02em] sm:text-[1.75rem]">API keys</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Use these keys with the Booklet API to publish programmatically.
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
          aria-label="Label for the new key (optional)"
          maxLength={80}
          className="min-w-0 flex-1 field"
        />
        <Button variant="primary" size="lg" onClick={() => void handleCreate()} disabled={creating} className="shrink-0">
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
      {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
