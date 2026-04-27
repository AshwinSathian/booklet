"use client";

import { UI } from "@/lib/constants";
import { Toast } from "primereact/toast";
import * as React from "react";

type ToastKind = "success" | "info" | "warn" | "error";

type ToastApi = Readonly<{
  show: (kind: ToastKind, summary: string, detail?: string) => void;
  showReplace: (kind: ToastKind, summary: string, detail?: string) => void;
  showCoalesced: (
    key: string,
    kind: ToastKind,
    summary: string,
    detail?: string,
  ) => void;
  clear: () => void;

  success: (summary: string, detail?: string) => void;
  info: (summary: string, detail?: string) => void;
  warn: (summary: string, detail?: string) => void;
  error: (summary: string, detail?: string) => void;
}>;

const TOAST = {
  lifeMs: 3500,
} as const;

const ToastContext = React.createContext<ToastApi | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within <ToastProvider />");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const toastRef = React.useRef<Toast>(null);
  const lastCoalescedAtRef = React.useRef<Map<string, number>>(new Map());

  const api = React.useMemo<ToastApi>(() => {
    const clear = () => {
      toastRef.current?.clear();
    };

    const show = (kind: ToastKind, summary: string, detail?: string) => {
      toastRef.current?.show({
        severity: kind,
        summary,
        detail,
        life: TOAST.lifeMs,
      });
    };

    const showReplace = (kind: ToastKind, summary: string, detail?: string) => {
      clear();
      show(kind, summary, detail);
    };

    const showCoalesced = (
      key: string,
      kind: ToastKind,
      summary: string,
      detail?: string,
    ) => {
      const now = Date.now();
      const last = lastCoalescedAtRef.current.get(key) ?? 0;
      if (now - last < UI.toastCoalesceMs) {
        // Replace instead of stacking when the same action repeats quickly.
        showReplace(kind, summary, detail);
      } else {
        show(kind, summary, detail);
      }
      lastCoalescedAtRef.current.set(key, now);
    };

    return {
      clear,
      show,
      showReplace,
      showCoalesced,

      success: (s, d) => show("success", s, d),
      info: (s, d) => show("info", s, d),
      warn: (s, d) => show("warn", s, d),
      error: (s, d) => show("error", s, d),
    };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toast ref={toastRef} position="bottom-center" />
    </ToastContext.Provider>
  );
}
