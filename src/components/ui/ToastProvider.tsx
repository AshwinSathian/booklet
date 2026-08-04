"use client";

import { UI } from "@/lib/constants";
import { createPortal } from "react-dom";
import * as React from "react";

type ToastKind = "success" | "info" | "warn" | "error";

type ToastItem = {
  id: number;
  kind: ToastKind;
  summary: string;
  detail?: string;
  exiting?: boolean;
};

type ToastApi = Readonly<{
  show: (kind: ToastKind, summary: string, detail?: string) => void;
  showReplace: (kind: ToastKind, summary: string, detail?: string) => void;
  showCoalesced: (key: string, kind: ToastKind, summary: string, detail?: string) => void;
  clear: () => void;
  success: (summary: string, detail?: string) => void;
  info: (summary: string, detail?: string) => void;
  warn: (summary: string, detail?: string) => void;
  error: (summary: string, detail?: string) => void;
}>;

const LIFE_MS = 3500;
const EXIT_MS = 180;

const ToastContext = React.createContext<ToastApi | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider />");
  return ctx;
}

// ---------------------------------------------------------------------------
// Single toast item
// ---------------------------------------------------------------------------

const ICONS: Record<ToastKind, React.ReactNode> = {
  success: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  warn: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 2L14.5 13.5H1.5L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 7v3M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

const COLORS: Record<ToastKind, { icon: string; border: string; bg: string }> = {
  success: { icon: "text-emerald-400",   border: "border-emerald-500/25", bg: "bg-emerald-500/8" },
  info:    { icon: "text-accent-soft",   border: "border-accent/25",      bg: "bg-accent/8" },
  warn:    { icon: "text-sky-400",       border: "border-sky-400/30",     bg: "bg-sky-400/8" },
  error:   { icon: "text-red-400",       border: "border-red-400/30",     bg: "bg-red-400/8" },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const colors = COLORS[toast.kind];

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "flex items-start gap-3 rounded-2xl border px-4 py-3",
        "bg-bg-elevated/95 backdrop-blur-md shadow-glass",
        "min-w-65 max-w-sm w-max",
        colors.border,
        toast.exiting ? "animate-toast-out" : "animate-toast-in",
      ].join(" ")}
    >
      <span className={["mt-0.5 shrink-0", colors.icon].join(" ")}>
        {ICONS[toast.kind]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-text-primary leading-snug">{toast.summary}</div>
        {toast.detail ? (
          <div className="mt-0.5 text-xs text-text-secondary leading-relaxed">{toast.detail}</div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="mt-0.5 shrink-0 flex h-5 w-5 items-center justify-center rounded-full text-text-muted hover:text-text-primary hover:bg-fill-2 transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
          <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

let _nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const timersRef = React.useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const lastCoalescedAtRef = React.useRef<Map<string, number>>(new Map());
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => { setMounted(true); }, []);

  const dismiss = React.useCallback((id: number) => {
    const t = timersRef.current.get(id);
    if (t) { clearTimeout(t); timersRef.current.delete(id); }

    setToasts((prev) => prev.map((toast) => toast.id === id ? { ...toast, exiting: true } : toast));
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, EXIT_MS);
  }, []);

  const schedule = React.useCallback((id: number) => {
    const t = setTimeout(() => dismiss(id), LIFE_MS);
    timersRef.current.set(id, t);
  }, [dismiss]);

  const add = React.useCallback((kind: ToastKind, summary: string, detail?: string) => {
    const id = _nextId++;
    setToasts((prev) => [...prev, { id, kind, summary, detail }]);
    schedule(id);
  }, [schedule]);

  const api = React.useMemo<ToastApi>(() => ({
    show: add,
    showReplace: (kind, summary, detail) => {
      setToasts((prev) => {
        prev.forEach((t) => {
          const timer = timersRef.current.get(t.id);
          if (timer) { clearTimeout(timer); timersRef.current.delete(t.id); }
        });
        return [];
      });
      setTimeout(() => add(kind, summary, detail), 0);
    },
    showCoalesced: (key, kind, summary, detail) => {
      const now = Date.now();
      const last = lastCoalescedAtRef.current.get(key) ?? 0;
      if (now - last < UI.toastCoalesceMs) {
        setToasts((prev) => {
          prev.forEach((t) => {
            const timer = timersRef.current.get(t.id);
            if (timer) { clearTimeout(timer); timersRef.current.delete(t.id); }
          });
          return [];
        });
        setTimeout(() => add(kind, summary, detail), 0);
      } else {
        add(kind, summary, detail);
      }
      lastCoalescedAtRef.current.set(key, now);
    },
    clear: () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
      setToasts([]);
    },
    success: (s, d) => add("success", s, d),
    info:    (s, d) => add("info",    s, d),
    warn:    (s, d) => add("warn",    s, d),
    error:   (s, d) => add("error",   s, d),
  }), [add]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted ? createPortal(
        <div
          role="region"
          aria-live="polite"
          aria-label="Notifications"
          className="fixed bottom-6 left-1/2 z-200 -translate-x-1/2 flex flex-col-reverse gap-2 items-center pointer-events-none print:hidden"
        >
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem toast={toast} onDismiss={dismiss} />
            </div>
          ))}
        </div>,
        document.body,
      ) : null}
    </ToastContext.Provider>
  );
}
