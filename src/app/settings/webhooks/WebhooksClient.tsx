"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatUpdatedAtLong, formatUpdatedAtLongUTC } from "@/lib/ui/time";
import { useCallback, useEffect, useRef, useState } from "react";

type DeliveryRow = {
  id: string;
  event: string;
  page_id: string;
  status_code: number | null;
  ok: boolean;
  error: string | null;
  created_at: string;
};

type WebhookRow = {
  id: string;
  url: string;
  events: string[];
  created_at: string;
  last_triggered_at: string | null;
  deliveries: DeliveryRow[];
};

const MAX_DELIVERIES = 50;

/**
 * The last 50 attempts for one webhook, newest first. "Resend" sends the
 * logged body again; the new attempt is added as its own row.
 */
function DeliveryLog({ webhookId, initial }: { webhookId: string; initial: DeliveryRow[] }) {
  const [rows, setRows] = useState(initial);
  const [resending, setResending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Server and browser may format a time differently: see formatUpdatedAtLongUTC.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const resend = async (deliveryId: string) => {
    setResending(deliveryId);
    setError(null);
    try {
      const res = await fetch(`/api/webhooks/${webhookId}/deliveries/${deliveryId}/resend`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { delivery?: DeliveryRow; error?: string };
      if (!res.ok || !data.delivery) {
        setError(data.error ?? "Could not resend.");
        return;
      }
      setRows((prev) => [data.delivery!, ...prev].slice(0, MAX_DELIVERIES));
    } catch {
      setError("Could not resend.");
    } finally {
      setResending(null);
    }
  };

  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer select-none py-1 text-text-secondary hover:text-text-primary">
        Deliveries ({rows.length})
      </summary>
      {error && <p role="alert" className="mt-1 text-danger">{error}</p>}
      {rows.length === 0 ? (
        <p className="mt-1 text-text-secondary">Nothing sent yet. A delivery appears here when a page is published or updated.</p>
      ) : (
        <ul className="mt-1 divide-y divide-border-subtle" data-testid="webhook-deliveries">
          {rows.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
              <span className={`font-mono font-semibold ${d.ok ? "text-success" : "text-danger"}`}>
                {d.status_code ?? "No response"}
              </span>
              <span className="text-text-secondary">{d.ok ? "Delivered" : (d.error ?? "Failed")}</span>
              <code className="font-mono text-2xs text-text-secondary">{d.event}</code>
              <a href={`/p/${d.page_id}`} className="font-mono text-2xs text-text-secondary underline hover:text-text-primary">
                {d.page_id}
              </a>
              <time dateTime={d.created_at} className="text-text-secondary">
                {mounted ? formatUpdatedAtLong(d.created_at) : formatUpdatedAtLongUTC(d.created_at)}
              </time>
              <Button
                variant="secondary"
                size="sm"
                className="ml-auto"
                disabled={resending !== null}
                onClick={() => void resend(d.id)}
              >
                {resending === d.id ? "Sending…" : "Resend"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

type SecretReveal = { id: string; secret: string };

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function WebhookCard({
  wh,
  onDeleted,
}: {
  wh: WebhookRow;
  onDeleted: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/webhooks/${wh.id}`, { method: "DELETE" });
      if (res.ok || res.status === 404) onDeleted(wh.id);
    } catch {
      // ignore
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }, [wh.id, onDeleted]);

  return (
    <div className="group flex items-start gap-3 rounded-xl border border-border-default bg-bg-elevated px-4 py-3 transition hover:border-accent-soft/30">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-text-primary truncate">{wh.url}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
          <div className="flex items-center gap-1 flex-wrap">
            {wh.events.map((e) => (
              <span
                key={e}
                className="rounded-pill bg-fill-2 border border-border-default px-1.5 py-0.5 text-2xs font-mono"
              >
                {e}
              </span>
            ))}
          </div>
          <span className="h-3 w-px bg-fill-2" aria-hidden />
          <span>Created {formatDate(wh.created_at)}</span>
          <span className="h-3 w-px bg-fill-2" aria-hidden />
          <span>Last fired {formatDate(wh.last_triggered_at)}</span>
        </div>
        <DeliveryLog webhookId={wh.id} initial={wh.deliveries} />
      </div>

      {confirming ? (
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="danger"
            size="md"
            onClick={() => void handleDelete()}
            disabled={deleting}
          >
            {deleting ? (
              <svg
                width="12"
                height="12"
                viewBox="0 0 13 13"
                fill="none"
                className="animate-spin"
                aria-hidden
              >
                <path
                  d="M6.5 1a5.5 5.5 0 1 0 5.5 5.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            ) : null}
            Delete
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
          title="Delete webhook"
          className="sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 shrink-0 hover:text-danger hover:bg-danger/8"
        >
          <Icon name="trash" size={14} />
        </Button>
      )}
    </div>
  );
}

function SecretBanner({ reveal, onDismiss }: { reveal: SecretReveal; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reveal.secret);
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
          <p className="text-sm font-semibold text-text-primary">Webhook signing secret</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            Copy it now — it won&apos;t be shown again. Use it to verify{" "}
            <code className="text-xs font-mono">X-Booklet-Signature</code> on incoming requests.
          </p>
        </div>
        <Button variant="ghost" size="sm" iconOnly onClick={onDismiss}>
          <Icon name="close" size={12} />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate rounded-lg bg-bg border border-border-default px-3 py-2 text-xs font-mono text-text-primary">
          {reveal.secret}
        </code>
        <Button
          variant="ghost"
          size="md"
          iconOnly
          onClick={() => void copy()}
          title="Copy secret"
          className={`shrink-0 ${copied ? "text-accent bg-accent-dim" : ""}`}
        >
          <Icon name={copied ? "check" : "copy"} size={14} />
        </Button>
      </div>
    </div>
  );
}

const EVENT_OPTIONS: { value: string; label: string }[] = [
  { value: "page.published", label: "page.published" },
  { value: "page.updated", label: "page.updated" },
];

export function WebhooksSection({ initialWebhooks }: { initialWebhooks: WebhookRow[] }) {
  const [webhooks, setWebhooks] = useState<WebhookRow[]>(initialWebhooks);
  const [creating, setCreating] = useState(false);
  const [secretReveal, setSecretReveal] = useState<SecretReveal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(
    new Set(["page.published"]),
  );

  const toggleEvent = (value: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const handleDeleted = useCallback((id: string) => {
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const handleCreate = async () => {
    const url = urlRef.current?.value.trim() ?? "";
    if (!url) {
      setError("A URL is required.");
      urlRef.current?.focus();
      return;
    }
    if (selectedEvents.size === 0) {
      setError("Select at least one event.");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, events: [...selectedEvents] }),
      });
      const data = (await res.json()) as {
        id?: string;
        url?: string;
        events?: string[];
        secret?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Failed to create webhook.");
        return;
      }
      const newWh: WebhookRow = {
        id: data.id!,
        url: data.url!,
        events: data.events!,
        created_at: new Date().toISOString(),
        last_triggered_at: null,
        deliveries: [],
      };
      setWebhooks((prev) => [newWh, ...prev]);
      setSecretReveal({ id: newWh.id, secret: data.secret! });
      setError(null);
      if (urlRef.current) urlRef.current.value = "";
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium">Webhooks</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Get notified when pages are published or updated.
          </p>
        </div>
      </div>

      {secretReveal && (
        <div className="mb-3">
          <SecretBanner reveal={secretReveal} onDismiss={() => setSecretReveal(null)} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        {webhooks.map((wh) => (
          <WebhookCard key={wh.id} wh={wh} onDeleted={handleDeleted} />
        ))}
      </div>

      {/* Create new webhook */}
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            ref={urlRef}
            type="url"
            placeholder="https://your-server.com/webhook"
            aria-label="Webhook URL"
            className="min-w-0 flex-1 rounded-lg border border-border-default bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
          />
          <Button
            variant="primary"
            size="md"
            onClick={() => void handleCreate()}
            disabled={creating}
            className="shrink-0"
          >
            {creating ? (
              <svg
                width="12"
                height="12"
                viewBox="0 0 13 13"
                fill="none"
                className="animate-spin"
                aria-hidden
              >
                <path
                  d="M6.5 1a5.5 5.5 0 1 0 5.5 5.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <Icon name="plus" size={12} />
            )}
            Add webhook
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {EVENT_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-1.5 cursor-pointer text-xs text-text-secondary select-none"
            >
              <input
                type="checkbox"
                checked={selectedEvents.has(opt.value)}
                onChange={() => toggleEvent(opt.value)}
                className="accent-[var(--color-accent)]"
              />
              <code className="font-mono text-2xs">{opt.label}</code>
            </label>
          ))}
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
}
