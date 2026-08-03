"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type SessionState = {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  email: string | null;
};

type SessionContextValue = SessionState & {
  /**
   * Re-fetch /api/auth/me and update context state immediately. Call this
   * right after any request that changes the session cookie (sign-in,
   * sign-up, account claim, sign-out) — router.refresh() alone only
   * re-fetches server-component data, it does not re-run a client
   * component's own effects, so without this the header keeps showing the
   * pre-mutation state until an actual full page load.
   */
  refetch: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue>({
  isLoaded: false,
  isSignedIn: false,
  userId: null,
  email: null,
  refetch: async () => {},
});

// Client-side sign-in state, mirroring Clerk's useUser() shape closely
// enough that call sites stayed near-identical when this replaced it. The
// session cookie itself is httpOnly (unreadable from JS by design), so this
// is the one round trip that syncs auth state into the client tree — fetched
// once at the root (see src/app/layout.tsx) rather than per-component, and
// again on demand via refetch() whenever a caller knows the cookie changed.
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({
    isLoaded: false,
    isSignedIn: false,
    userId: null,
    email: null,
  });
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = (await res.json()) as { userId: string | null; email: string | null };
      if (!mountedRef.current) return;
      setState({ isLoaded: true, isSignedIn: Boolean(data.userId), userId: data.userId, email: data.email });
    } catch {
      if (mountedRef.current) setState({ isLoaded: true, isSignedIn: false, userId: null, email: null });
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  return (
    <SessionContext.Provider value={{ ...state, refetch }}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}
