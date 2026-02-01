"use client";

import { Toast } from "primereact/toast";
import * as React from "react";

type ToastKind = "success" | "info" | "warn" | "error";

type ToastApi = Readonly<{
  show: (kind: ToastKind, summary: string, detail?: string) => void;
  success: (summary: string, detail?: string) => void;
  info: (summary: string, detail?: string) => void;
  warn: (summary: string, detail?: string) => void;
  error: (summary: string, detail?: string) => void;
}>;

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

  const api = React.useMemo<ToastApi>(() => {
    const show = (kind: ToastKind, summary: string, detail?: string) => {
      toastRef.current?.show({
        severity: kind,
        summary,
        detail,
        life: 2500,
      });
    };

    return {
      show,
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
