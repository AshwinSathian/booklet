"use client";

import { createContext, useContext, useEffect, useState } from "react";

type SessionState = {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  email: string | null;
};

const SessionContext = createContext<SessionState>({
  isLoaded: false,
  isSignedIn: false,
  userId: null,
  email: null,
});

// Client-side sign-in state, mirroring Clerk's useUser() shape closely
// enough that call sites stayed near-identical when this replaced it. The
// session cookie itself is httpOnly (unreadable from JS by design), so this
// is the one round trip that syncs auth state into the client tree — fetched
// once at the root (see src/app/layout.tsx) rather than per-component.
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({
    isLoaded: false,
    isSignedIn: false,
    userId: null,
    email: null,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data: { userId: string | null; email: string | null }) => {
        if (cancelled) return;
        setState({ isLoaded: true, isSignedIn: Boolean(data.userId), userId: data.userId, email: data.email });
      })
      .catch(() => {
        if (!cancelled) setState({ isLoaded: true, isSignedIn: false, userId: null, email: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
